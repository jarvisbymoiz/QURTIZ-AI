import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentItems, contentVariants } from "@/db/schema";
import { scheduleItem } from "@/lib/scheduling/engine";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

const { getDb } = await import("@/db");
const mockedGetDb = vi.mocked(getDb);

type Row = Record<string, unknown>;
type Call = { kind: "insert" | "update" | "delete"; values?: Row };

/** Minimal fake of the drizzle query builder used by the engine. */
function makeDb(overrides: { item?: Row; variants?: Row[] }) {
  const calls: Call[] = [];
  const db = {
    select: vi.fn(() => ({
      from: (table: unknown) => ({
        where: async () => {
          if (table === contentItems) return overrides.item ? [overrides.item] : [];
          if (table === contentVariants) return overrides.variants ?? [];
          return [];
        },
      }),
    })),
    insert: vi.fn(() => ({
      values: async (values: Row) => {
        calls.push({ kind: "insert", values });
        return [];
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

describe("scheduleItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates jobs only for unpublished variants and never flips published variants back", async () => {
    const publishedVariant = { id: "v-published", platform: "facebook", status: "published" };
    const pendingVariant = { id: "v-pending", platform: "instagram", status: "approved" };
    const { db, calls } = makeDb({
      item: { id: "item-1", status: "approved" },
      variants: [publishedVariant, pendingVariant],
    });
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({ workspaceId: "ws-1", itemId: "item-1", dateIso: "2026-09-10", timezone: "Asia/Karachi" });

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
        { id: "v-fb", platform: "facebook", status: "published" },
        { id: "v-ig", platform: "instagram", status: "published" },
      ],
    });
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({ workspaceId: "ws-1", itemId: "item-1", dateIso: "2026-09-10", timezone: "Asia/Karachi" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("already_published");
    expect(calls.filter((c) => c.kind === "insert")).toHaveLength(0);
  });

  it("reschedules: deletes the old pending job and re-creates it at the new time", async () => {
    const { db, calls } = makeDb({
      item: { id: "item-1", status: "scheduled" },
      variants: [{ id: "v-fb", platform: "facebook", status: "scheduled" }],
    });
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({
      workspaceId: "ws-1",
      itemId: "item-1",
      dateIso: "2026-09-10",
      timeStr: "09:15",
      timezone: "Asia/Karachi",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    // The stale pending job is deleted before the new one is inserted
    // (Asia/Karachi is UTC+5, so 09:15 local = 04:15 UTC).
    expect(calls.filter((c) => c.kind === "delete")).toHaveLength(1);
    const inserts = calls.filter((c) => c.kind === "insert");
    expect(inserts).toHaveLength(1);
    expect((inserts[0].values?.scheduledAt as Date).toISOString()).toBe("2026-09-10T04:15:00.000Z");
    expect(res.scheduledAt.toISOString()).toBe("2026-09-10T04:15:00.000Z");
  });

  it("rejects items that are not in a reviewable state", async () => {
    const { db } = makeDb({ item: { id: "item-1", status: "draft" }, variants: [] });
    mockedGetDb.mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await scheduleItem({ workspaceId: "ws-1", itemId: "item-1", dateIso: "2026-09-10", timezone: "Asia/Karachi" });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_reviewable");
  });
});
