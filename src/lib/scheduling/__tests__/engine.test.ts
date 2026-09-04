import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentItems, contentVariants } from "@/db/schema";
import { scheduleItem } from "@/lib/scheduling/engine";
import { dateIsoInTz, parseZonedDateTime } from "@/lib/scheduling/time";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

const { getDb } = await import("@/db");
const mockedGetDb = vi.mocked(getDb);

const TZ = "Asia/Karachi";

/**
 * YYYY-MM-DD `days` away from TODAY in the test timezone. The engine now
 * rejects past dates, so fixed calendar literals would silently break on the
 * first run after that literal's date — every scenario must be derived from
 * the current date instead.
 */
function isoIn(days: number): string {
  const [y, m, d] = dateIsoInTz(TZ).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const YESTERDAY = isoIn(-1);
const TODAY = isoIn(0);
const FUTURE = isoIn(3);

type Row = Record<string, unknown>;
type Call = { kind: "insert" | "update" | "delete"; values?: Row };

/** Walk a drizzle SQL condition tree looking for an `eq(<col>, <value>)`
 *  whose column name matches `wantedColumn`. Returns the RHS value as a
 *  string, or null when no such clause exists. drizzle wraps each `eq`
 *  in an SQL chunk of shape: [Column<wantedColumn>, " = ", Param<value>].
 *  Used by the mock to filter variant rows by id without misreading
 *  `eq(contentItemId, ...)` as an id filter. */
function extractEqForColumn(condition: unknown, wantedColumn: string): string | null {
  if (!condition || typeof condition !== "object") return null;
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks;
  if (!Array.isArray(chunks)) return null;
  const stack: unknown[] = [...chunks];
  while (stack.length > 0) {
    const c = stack.shift();
    if (!c || typeof c !== "object") continue;
    const name = (c as { constructor?: { name?: string } }).constructor?.name;
    const cname = (c as { name?: unknown }).name;
    if (name && name !== "StringChunk" && name !== "Param" && name !== "SQL" && typeof cname === "string" && cname === wantedColumn) {
      // Found the requested column. Look forward in the same chunk array
      // for the next Param chunk — that is the RHS literal. drizzle emits
      // `[Column, " = ", Param]` in this order for plain `eq(col, val)`.
      const idx = chunks.indexOf(c);
      for (let j = idx + 1; j < chunks.length; j++) {
        const next = chunks[j];
        if (next && typeof next === "object" && (next as { constructor?: { name?: string } }).constructor?.name === "Param") {
          const v = (next as { value?: unknown }).value;
          if (typeof v === "string") return v;
        }
      }
    }
    const inner = (c as { queryChunks?: unknown[] }).queryChunks;
    if (Array.isArray(inner)) stack.push(...inner);
  }
  return null;
}

/** Minimal fake of the drizzle query builder used by the engine. The
 *  engine now delegates to the centralized publishing service, so the mock
 *  has to support extra queries the service runs:
 *    - `select().from(visualAssets).where().orderBy().limit(1)`
 *    - `insert(publishingJobs).values(...).returning()`
 *  Plus the service's variant ownership check requires the variant row to
 *  carry `contentItemId` and `workspaceId` (matched against the args). The
 *  mock DOES filter by id when the where condition is `eq(id, X)` so the
 *  service's variant-by-id lookup returns the right row even when the test
 *  seeds multiple variants. */
function makeDb(overrides: { item?: Row; variants?: Row[] }) {
  const calls: Call[] = [];

  function rowsFor(table: unknown, whereCondition?: unknown): Row[] {
    const rows = (() => {
      if (table === contentItems) return overrides.item ? [overrides.item] : [];
      if (table === contentVariants) return overrides.variants ?? [];
      return [];
    })();
    // Filter variant rows ONLY when the where condition compares `id` (the
    // service's variant-by-id lookup). Engine variant-list queries compare
    // `contentItemId` and `workspaceId` — those must pass through unchanged.
    if (table === contentVariants && whereCondition) {
      const id = extractEqForColumn(whereCondition, "id");
      if (id) return rows.filter((r) => r.id === id);
    }
    return rows;
  }

  const db = {
    select: vi.fn(() => ({
      from: (table: unknown) => {
        const chain = {
          orderBy: () => ({ limit: async () => [] }),
          where: (cond?: unknown) => {
            const promise = Promise.resolve(rowsFor(table, cond)) as Promise<Row[]> & {
              orderBy?: () => { limit: () => Promise<Row[]> };
            };
            promise.orderBy = () => ({ limit: async () => [] });
            return promise;
          },
        };
        return chain;
      },
    })),
    insert: vi.fn(() => ({
      values: (values: Row) => {
        calls.push({ kind: "insert", values });
        // Centralized publishing service uses .returning() on the insert
        // chain to fetch the new publishing_jobs row. Synthesize a job id
        // here so the service's `if (!job) return db_error` guard does not
        // fire spuriously under the mock.
        const row = { id: "job-mock", ...values };
        return {
          returning: async () => [row],
        };
      },
    })),
    update: vi.fn(() => ({
      set: (values: Row) => ({
        where: async () => {
          calls.push({ kind: "update", values });
          return [];
        },
      }),
    })),
    delete: vi.fn(() => ({
      where: async () => {
        calls.push({ kind: "delete" });
        return [];
      },
    })),
  };
  return { db, calls };
}

/** A reviewable item with one schedulable variant. The service's variant
 *  ownership check requires the variant row to carry `contentItemId` and
 *  `workspaceId`; pad the default row so it survives that guard. */
function reviewableDb() {
  return makeDb({
    item: { id: "item-1", status: "approved" },
    variants: [{ id: "v-1", contentItemId: "item-1", workspaceId: "ws-1", platform: "facebook", status: "approved" }],
  });
}

describe("scheduleItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates jobs only for unpublished variants and never flips published variants back", async () => {
    const publishedVariant = { id: "v-published", contentItemId: "item-1", workspaceId: "ws-1", platform: "facebook", status: "published" };
    const pendingVariant = { id: "v-pending", contentItemId: "item-1", workspaceId: "ws-1", platform: "instagram", status: "approved" };
    const { db, calls } = makeDb({
      item: { id: "item-1", status: "approved" },
      variants: [publishedVariant, pendingVariant],
    });
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({ workspaceId: "ws-1", itemId: "item-1", dateIso: FUTURE, timezone: TZ });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // Only the non-published variant receives a publish job.
    const inserts = calls.filter((c) => c.kind === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values?.contentVariantId).toBe("v-pending");

    // Only the non-published variant is flipped to scheduled (the item-level
    // update is the one carrying scheduledAt).
    const variantFlips = calls.filter(
      (c) => c.kind === "update" && c.values?.status === "scheduled" && c.values?.scheduledAt === undefined,
    );
    expect(variantFlips).toHaveLength(1);

    expect(res.variants).toBe(1);
  });

  it("returns already_published when every variant is already live", async () => {
    const { db, calls } = makeDb({
      item: { id: "item-1", status: "scheduled" },
      variants: [
        { id: "v-fb", contentItemId: "item-1", workspaceId: "ws-1", platform: "facebook", status: "published" },
        { id: "v-ig", contentItemId: "item-1", workspaceId: "ws-1", platform: "instagram", status: "published" },
      ],
    });
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({ workspaceId: "ws-1", itemId: "item-1", dateIso: FUTURE, timezone: TZ });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("already_published");
    expect(calls.filter((c) => c.kind === "insert")).toHaveLength(0);
  });

  it("reschedules: deletes the old pending job and re-creates it at the new time", async () => {
    const { db, calls } = makeDb({
      item: { id: "item-1", status: "scheduled" },
      variants: [{ id: "v-fb", contentItemId: "item-1", workspaceId: "ws-1", platform: "facebook", status: "scheduled" }],
    });
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({
      workspaceId: "ws-1",
      itemId: "item-1",
      dateIso: FUTURE,
      timeStr: "09:15",
      timezone: TZ,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // The stale pending job is deleted before the new one is inserted
    // (Asia/Karachi is UTC+5, so 09:15 local = 04:15 UTC).
    expect(calls.filter((c) => c.kind === "delete")).toHaveLength(1);
    const inserts = calls.filter((c) => c.kind === "insert");
    expect(inserts).toHaveLength(1);
    const expected = parseZonedDateTime(FUTURE, "09:15", TZ).toISOString();
    expect((inserts[0].values?.scheduledAt as Date).toISOString()).toBe(expected);
    expect(res.scheduledAt.toISOString()).toBe(expected);
  });

  it("rejects items that are not in a reviewable state", async () => {
    const { db } = makeDb({ item: { id: "item-1", status: "draft" }, variants: [] });
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({ workspaceId: "ws-1", itemId: "item-1", dateIso: FUTURE, timezone: TZ });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_reviewable");
  });
});

describe("scheduleItem past-date guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a past calendar day before touching the database", async () => {
    const { db, calls } = reviewableDb();
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({ workspaceId: "ws-1", itemId: "item-1", dateIso: YESTERDAY, timezone: TZ });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("past_date");
    expect(res.message).toContain("today or a future date");
    expect(calls).toHaveLength(0); // guard fires before any read or write
  });

  it("accepts today even at an earlier wall-clock time (calendar-day guard only)", async () => {
    const { db, calls } = reviewableDb();
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({
      workspaceId: "ws-1",
      itemId: "item-1",
      dateIso: TODAY,
      timeStr: "00:01",
      timezone: TZ,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.scheduledAt.toISOString()).toBe(parseZonedDateTime(TODAY, "00:01", TZ).toISOString());
    expect(calls.filter((c) => c.kind === "insert")).toHaveLength(1);
  });

  it("accepts a future date at the default slot", async () => {
    const { db, calls } = reviewableDb();
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({ workspaceId: "ws-1", itemId: "item-1", dateIso: FUTURE, timezone: TZ });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.scheduledAt.toISOString()).toBe(parseZonedDateTime(FUTURE, "18:30", TZ).toISOString());
    expect(calls.filter((c) => c.kind === "insert")).toHaveLength(1);
  });
});