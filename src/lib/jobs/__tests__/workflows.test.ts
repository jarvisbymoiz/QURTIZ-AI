import { beforeEach, describe, expect, it, vi } from "vitest";
import { campaigns, jobs, notifications, publishingJobs } from "@/db/schema";

/**
 * Hermetic worker tests for `attemptPublish` (lib/jobs/workflows.ts).
 *
 * Only attemptPublish's claim → re-resolve → publish → notify flow is under
 * test here; every collaborator with its own suite or a heavy dependency
 * tree is stubbed. The fake db covers exactly the chain shapes the function
 * uses: update().set().where() (provider stamp / failure), update().set()
 * .where().returning() (the atomic claim), select().from().where() (the
 * notification recipient), insert().values() (notifications).
 */

vi.mock("@/db", () => ({ getDb: vi.fn() }));

vi.mock("@/lib/publishing/service", () => ({ publishNow: vi.fn() }));
vi.mock("@/lib/publish/provider", () => ({ resolvePublishProviderForPlatform: vi.fn() }));

// Heavy collaborators of the workflows module — stubbed so importing the
// module stays cheap and side-effect-free.
vi.mock("@/lib/jobs/boss", () => ({
  QUEUES: {
    publishScan: "publish-due-scan",
    bulkGenerate: "bulk-generate",
    campaignGenerate: "campaign-generate",
    syncInsights: "sync-insights",
    autopilotLoop: "autopilot-loop",
  },
}));
vi.mock("@/lib/analytics/sync", () => ({ syncInsightsForWorkspace: vi.fn() }));
vi.mock("@/lib/ai/config", () => ({ hasWorkspaceAIConfig: vi.fn() }));
vi.mock("@/lib/ai/research", () => ({ researchTopics: vi.fn() }));
vi.mock("@/lib/ai/content", () => ({ generateAndPersistContent: vi.fn() }));
vi.mock("@/lib/visuals/generate", () => ({ generateVisual: vi.fn() }));

const { getDb } = await import("@/db");
const mockedGetDb = vi.mocked(getDb);
const { attemptPublish, recoverStuckGenerationJobs } = await import("@/lib/jobs/workflows");
const { publishNow } = await import("@/lib/publishing/service");
const { resolvePublishProviderForPlatform } = await import("@/lib/publish/provider");
const mockedPublishNow = vi.mocked(publishNow);
const mockedResolveProvider = vi.mocked(resolvePublishProviderForPlatform);

type Row = Record<string, unknown>;

const JOB: Row = {
  id: "pj-1",
  workspaceId: "ws-1",
  contentItemId: "item-1",
  contentVariantId: "v-1",
  platform: "facebook",
  provider: "meta", // creation-time snapshot — the stale stamp under test
  status: "pending",
  attempts: 0,
  scheduledAt: new Date(),
};

/** Fake db for attemptPublish. Updates are recorded when `.where()` is
 *  called (the claim ALSO flows through here — its `.returning()` replay
 *  returns the claimed row without re-recording). */
function makeAttemptDb(job: Row) {
  const updates: Array<{ table: unknown; values: Row }> = [];
  const inserts: Row[] = [];
  const db = {
    select: () => ({
      from: (table: unknown) => {
        void table; // Match the real query signature and table-aware overrides.
        // Default rows for EVERY select: the recipient lookup consumes
        // createdBy; the item-topic/sibling selects tolerate the extra keys.
        const rows: Row[] = [{ createdBy: "user-1" }];
        // Awaitable AND chainable: .limit(1) (topic/item selects),
        // .orderBy(...).limit(1) (notification-consolidation lookup → none → insert).
        const whereResult = Object.assign(Promise.resolve(rows), {
          limit: async () => rows.slice(0, 1),
          orderBy: () => ({ limit: async () => [] as Row[] }),
        });
        return { where: () => whereResult };
      },
    }),
    update: (table: unknown) => ({
      set: (values: Row) => ({
        where: () => {
          updates.push({ table, values });
          const promise = Promise.resolve([]) as unknown as Promise<Row[]> & { returning: () => Promise<Row[]> };
          promise.returning = async () => [{ ...job }]; // claim replay
          return promise;
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Row) => {
        inserts.push({ __table: table, ...values });
        return { returning: async () => [{ id: "n-1", ...values }] };
      },
    }),
  };
  return { db, updates, inserts };
}

function okResult(provider: "meta" | "buffer") {
  return {
    ok: true as const,
    provider,
    mode: "shareNow" as const,
    providerPostId: "post-1",
    scheduledAt: new Date(),
    mediaAttached: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("attemptPublish — provider re-resolution at fire time", () => {
  it("does not replay a lost provider response", async () => {
    const { db, updates, inserts } = makeAttemptDb(JOB);
    mockedGetDb.mockReturnValue(db as never);
    mockedResolveProvider.mockResolvedValue("meta");
    mockedPublishNow.mockResolvedValue({ ok: false, reason: "unknown_outcome", message: "Network timed out; delivery requires verification." });
    await attemptPublish("pj-1");
    expect(mockedPublishNow).toHaveBeenCalledTimes(1);
    expect(updates.some(write => write.values.status === "pending")).toBe(false);
    expect(inserts[0].kind).toBe("publishing_failed");
  });
  it("re-resolves the provider from the ACTIVE connection and UPDATEs the stale job stamp (meta-stamped + live buffer → buffer)", async () => {
    const { db, updates, inserts } = makeAttemptDb(JOB);
    mockedGetDb.mockReturnValue(db as never);
    mockedResolveProvider.mockResolvedValue("buffer");
    mockedPublishNow.mockResolvedValue(okResult("buffer"));

    await attemptPublish("pj-1");

    // Fired against the ACTIVE connection's provider.
    expect(mockedResolveProvider).toHaveBeenCalledWith("ws-1", "facebook");
    expect(mockedPublishNow).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "pj-1", workspaceId: "ws-1", platform: "facebook" }),
    );
    // The stale "meta" stamp was corrected on the job row.
    const stamp = updates.find((u) => u.table === publishingJobs && "provider" in u.values);
    expect(stamp).toBeDefined();
    expect(stamp!.values.provider).toBe("buffer");
    // Success notification recorded.
    expect(inserts).toHaveLength(1);
    expect(inserts[0].kind).toBe("publishing_completed");
  });

  it("does NOT touch the job row when the persisted provider still matches the active connection", async () => {
    const { db, updates } = makeAttemptDb(JOB);
    mockedGetDb.mockReturnValue(db as never);
    mockedResolveProvider.mockResolvedValue("meta"); // matches the snapshot
    mockedPublishNow.mockResolvedValue(okResult("meta"));

    await attemptPublish("pj-1");

    expect(updates.filter((u) => "provider" in u.values)).toHaveLength(0);
    expect(mockedPublishNow).toHaveBeenCalledTimes(1);
  });

  it("keeps the honest failure when no connection exists (job failed + notification, no retry storm)", async () => {
    const { db, updates, inserts } = makeAttemptDb(JOB);
    mockedGetDb.mockReturnValue(db as never);
    mockedResolveProvider.mockResolvedValue("buffer");
    mockedPublishNow.mockResolvedValue({
      ok: false as const,
      reason: "not_connected",
      message: "No connected Facebook account. Connect one on the Connections page.",
    });

    await attemptPublish("pj-1");

    const failure = updates.find((u) => u.table === publishingJobs && u.values.status === "failed");
    expect(failure).toBeDefined();
    expect(failure!.values.lastError).toBe("No connected Facebook account. Connect one on the Connections page.");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].kind).toBe("publishing_failed");
    // Not requeued: the row was NOT flipped back to pending.
    expect(updates.some((u) => u.values.status === "pending")).toBe(false);
  });
});

describe("attemptPublish — firstComment skipped note", () => {
  it("appends the skipped-first-comment note to the success notification", async () => {
    const { db, inserts } = makeAttemptDb(JOB);
    mockedGetDb.mockReturnValue(db as never);
    mockedResolveProvider.mockResolvedValue("buffer");
    mockedPublishNow.mockResolvedValue({ ...okResult("buffer"), firstCommentSkipped: true });

    await attemptPublish("pj-1");

    expect(inserts).toHaveLength(1);
    expect(inserts[0].kind).toBe("publishing_completed");
    expect(String(inserts[0].body)).toContain("First Comment: Skipped (unavailable on current Buffer plan)");
    expect(inserts[0].userId).toBe("user-1"); // workspace creator, not the ws UUID
  });
});

describe("attemptPublish — published-post destinations", () => {
  it("links the notification to the live platform permalink stored on the job row (never Content Studio)", async () => {
    const { db, inserts } = makeAttemptDb(JOB);
    // The sibling/permalink select for THIS run: table-aware fake rows.
    const originalFrom = db.select;
    db.select = () => ({
      from: (table: unknown) => {
        if (table === publishingJobs) {
          // flipToPublished already persisted the real Meta permalink.
          const rows: Row[] = [{ platform: "facebook", result: { permalink: "https://www.facebook.com/123/posts/456" } }];
          const whereResult = Object.assign(Promise.resolve(rows), {
            limit: async () => rows.slice(0, 1),
            orderBy: () => ({ limit: async () => [] as Row[] }),
          });
          return { where: () => whereResult };
        }
        return originalFrom().from(table);
      },
    });
    mockedGetDb.mockReturnValue(db as never);
    mockedResolveProvider.mockResolvedValue("meta");
    mockedPublishNow.mockResolvedValue(okResult("meta"));

    await attemptPublish("pj-1");

    expect(inserts).toHaveLength(1);
    expect(inserts[0].kind).toBe("publishing_completed");
    // The resolver-facing contract: destinations carry the REAL permalink and
    // the stored link is null — the UI renders "View on Facebook", not a
    // Content Studio redirect.
    expect(inserts[0].link).toBeNull();
    const meta = inserts[0].meta as { destinations?: Array<{ platform: string; permalink: string }> };
    expect(meta.destinations).toEqual([{ platform: "facebook", permalink: "https://www.facebook.com/123/posts/456" }]);
  });
});

describe("recoverStuckGenerationJobs", () => {
  it("fails the stale job, cancels its generating campaign, and notifies the initiating user", async () => {
    const staleJob = {
      id: "job-1",
      workspaceId: "ws-1",
      userId: "user-1",
      type: "campaign",
      status: "running",
      input: { campaignId: "campaign-1" },
      result: { createdIds: ["item-1"] },
      updatedAt: new Date(0),
    };
    const updates: Array<{ table: unknown; values: Row }> = [];
    const inserts: Array<{ table: unknown; values: Row }> = [];
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [staleJob] }),
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Row) => ({
          where: () => {
            updates.push({ table, values });
            const result = Promise.resolve([]) as unknown as Promise<Row[]> & { returning: () => Promise<Row[]> };
            result.returning = async () => table === jobs ? [{ id: staleJob.id }] : [];
            return result;
          },
        }),
      }),
      insert: (table: unknown) => ({
        values: async (values: Row) => { inserts.push({ table, values }); },
      }),
    };
    mockedGetDb.mockReturnValue(db as never);

    await recoverStuckGenerationJobs();

    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: jobs, values: expect.objectContaining({ status: "failed" }) }),
      expect.objectContaining({ table: campaigns, values: expect.objectContaining({ status: "cancelled" }) }),
    ]));
    expect(inserts).toEqual([
      expect.objectContaining({
        table: notifications,
        values: expect.objectContaining({ userId: "user-1", title: "Campaign generation stopped" }),
      }),
    ]);
  });
});
