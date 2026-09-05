import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishingJobs } from "@/db/schema";

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
const { attemptPublish } = await import("@/lib/jobs/workflows");
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
      from: () => ({
        where: async () => [{ createdBy: "user-1" }], // workspaces → recipient
      }),
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
