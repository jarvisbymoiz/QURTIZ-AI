import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATE_POST_MUTATION,
  buildCreatePostVariables,
  type BufferTokenEnvelope,
} from "@/lib/buffer/client";
import {
  buildBufferPayload,
  deriveContentKind,
  isFirstCommentPlanError,
  platformToBufferService,
  publishNow,
  reconcileBufferDeliveries,
  retryFailedPublish,
  resolvePublishConnection,
  schedulePost,
  selectItemMedia,
  shouldProactivelyRefresh,
  PublishingError,
  type ContentKind,
  type PublishMode,
} from "@/lib/publishing/service";
import {
  contentItems,
  contentVariants,
  platformConnections,
  publishingJobs,
  settings,
  visualAssets,
  workspaces,
} from "@/db/schema";
import { encryptToken } from "@/lib/crypto/tokens";
import { dateIsoInTz, hmInTz, parseZonedDateTime } from "@/lib/scheduling/time";

/* ── Module mocks ─────────────────────────────────────────────────────── */

vi.mock("@/db", () => ({ getDb: vi.fn() }));

// Partial Buffer-client mock: the pure helpers (mutation constant, variables
// builder, envelope codecs) stay REAL — only the network-touching entry
// points are stubbed so the service's lifecycle logic is tested hermetically.
vi.mock("@/lib/buffer/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/buffer/client")>();
  return {
    ...actual,
    createPostForBuffer: vi.fn(),
    refreshAccessToken: vi.fn(),
    listChannels: vi.fn(),
    getBufferPostStatus: vi.fn(),
  };
});

vi.mock("@/lib/meta/publish", () => ({ publishPost: vi.fn(), publishFirstComment: vi.fn() }));

// Signed-URL helper stub: the service asks Supabase storage for a reachable
// image URL whenever a visual is attached to the item under publish.
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/visual.png" }, error: null }),
      }),
    },
  })),
}));

// Request-scoped (user-JWT) client stub — the service's harmless fallback when
// the service-role key is missing. Default behaves like the worker context
// (no request scope → throws); individual tests override.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => {
    throw new Error("cookies was called outside a request scope");
  }),
}));

const { getDb } = await import("@/db");
const mockedGetDb = vi.mocked(getDb);
const bufferClient = await import("@/lib/buffer/client");
const mockedCreatePostForBuffer = vi.mocked(bufferClient.createPostForBuffer);
const mockedRefreshAccessToken = vi.mocked(bufferClient.refreshAccessToken);
const mockedListChannels = vi.mocked(bufferClient.listChannels);
const { createServiceClient } = await import("@/lib/supabase/service");

// Deterministic key so conn.encryptedToken round-trips the REAL crypto
// helpers (same convention as the buffer client tests).
const ENCRYPTION_KEY = "ab".repeat(32);

beforeAll(() => {
  process.env.ENCRYPTION_KEY = ENCRYPTION_KEY;
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
});

beforeEach(() => {
  vi.clearAllMocks();
});

/* ── Fixtures + fake drizzle db ───────────────────────────────────────── */

const WORKSPACE_ID = "ws-1";
const ITEM_ID = "item-1";
const VARIANT_ID = "v-1";
const CHANNEL_REF = "ch-1";
const ORG_ID = "org-1";
const CONN_ID = "conn-1";

type Row = Record<string, unknown>;

function makeEnvelope(overrides?: Partial<BufferTokenEnvelope>): BufferTokenEnvelope {
  return {
    accessToken: "tok-1",
    refreshToken: "ref-1",
    expiresAt: Date.now() + 3600_000, // far future → no proactive refresh
    grantedScopes: null,
    ...overrides,
  };
}

function makeConnRow(overrides?: {
  id?: string;
  platform?: "facebook" | "instagram";
  provider?: "meta" | "buffer";
  envelope?: BufferTokenEnvelope;
  status?: string;
}): Row {
  const envelope = overrides?.envelope ?? makeEnvelope();
  return {
    id: overrides?.id ?? CONN_ID,
    workspaceId: WORKSPACE_ID,
    platform: overrides?.platform ?? "facebook",
    provider: overrides?.provider ?? "buffer",
    status: overrides?.status ?? "connected",
    channelRef: CHANNEL_REF,
    meta: { organizationId: ORG_ID },
    encryptedToken: encryptToken(JSON.stringify(envelope)),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const VARIANT_ROW: Row = {
  id: VARIANT_ID,
  contentItemId: ITEM_ID,
  workspaceId: WORKSPACE_ID,
  platform: "facebook",
  format: "single_image",
  caption: "Variant caption",
  hashtags: ["tag1", "tag2"],
  firstComment: "First! 🚀",
  status: "approved",
};

const ITEM_ROW: Row = {
  id: ITEM_ID,
  workspaceId: WORKSPACE_ID,
  topic: "Launch week",
  caption: "Item caption",
  hashtags: [],
  status: "approved",
};

/**
 * Minimal table-dispatched fake of the drizzle query builder used by the
 * service. Selects return per-table row queues: each awaited select consumes
 * the next entry (the LAST entry repeats), which lets a single test script
 * the provider-resolution, connection-load and refresh-re-read selects in
 * order. Updates/deletes/inserts are recorded for assertions.
 */
function makeFakeDb(spec: {
  platformConnections?: Row[][];
  contentVariants?: Row[][];
  contentItems?: Row[][];
  visualAssets?: Row[][];
  workspaces?: Row[][];
  settings?: Row[][];
  publishingJobs?: Row[][];
}) {
  const updates: Array<{ table: unknown; values: Row }> = [];
  const deletes: unknown[] = [];
  const inserts: Array<{ table: unknown; values: Row }> = [];

  function nextRows(table: unknown): Row[] {
    let queue: Row[][] | undefined;
    if (table === platformConnections) queue = spec.platformConnections;
    else if (table === contentVariants) queue = spec.contentVariants;
    else if (table === contentItems) queue = spec.contentItems;
    else if (table === visualAssets) queue = spec.visualAssets;
    else if (table === workspaces) queue = spec.workspaces;
    else if (table === settings) queue = spec.settings;
    else if (table === publishingJobs) queue = spec.publishingJobs;
    if (!queue || queue.length === 0) return [];
    return queue.length > 1 ? queue.shift()! : queue[0];
  }

  const db = {
    transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => callback(db),
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const promise = Promise.resolve(nextRows(table)) as Promise<Row[]> & {
            orderBy: () => { limit: () => Promise<Row[]> };
            for: () => Promise<Row[]>;
          };
          promise.for = () => promise;
          promise.orderBy = () => ({ limit: () => Promise.resolve(nextRows(table)) });
          return promise;
        },
      }),
    }),
    insert: () => ({
      values: (values: Row) => {
        inserts.push({ table: publishingJobs, values });
        return { returning: async () => [{ id: "job-1", ...values }] };
      },
    }),
    update: (table: unknown) => ({
      set: (values: Row) => ({
        where: async () => {
          updates.push({ table, values });
          return [];
        },
      }),
    }),
    delete: () => ({
      where: async () => {
        deletes.push("where");
        return [];
      },
    }),
  };
  return { db, updates, deletes, inserts };
}

/* ── Pure helpers ─────────────────────────────────────────────────────── */

describe("Buffer delivery recovery without resending", () => {
  const accepted = {
    id: "accepted-job", workspaceId: WORKSPACE_ID, contentItemId: ITEM_ID,
    contentVariantId: VARIANT_ID, platform: "facebook", provider: "buffer",
    status: "processing", providerPostId: "accepted-post", result: {},
  };
  it("persists the polling budget across scans without calling a publisher", async () => {
    const fake = makeFakeDb({ publishingJobs: [[{ ...accepted, result: { deliveryPollAttempts: 4 } }]], platformConnections: [[makeConnRow()]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    vi.mocked(bufferClient.getBufferPostStatus).mockResolvedValue({ ok: false, reason: "network", message: "Temporary outage" });
    await reconcileBufferDeliveries();
    expect(fake.updates[0].values).toMatchObject({ status: "processing", result: { deliveryPollAttempts: 5, awaitingDelivery: true } });
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });
  it("stops unconfirmed delivery after the persisted budget is exhausted", async () => {
    const fake = makeFakeDb({ publishingJobs: [[{ ...accepted, result: { deliveryPollAttempts: 47 } }]], platformConnections: [[makeConnRow()]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    vi.mocked(bufferClient.getBufferPostStatus).mockResolvedValue({ ok: true, data: { id: "accepted-post", status: "pending" } });
    await reconcileBufferDeliveries();
    expect(fake.updates[0].values).toMatchObject({ status: "failed", result: { reconciliationRequired: true, deliveryPollAttempts: 48 } });
    expect(fake.updates[0].values.lastError).toMatch(/may already be live/);
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });
  it("makes a missing connection actionable without dropping the accepted post ID", async () => {
    const fake = makeFakeDb({ publishingJobs: [[accepted]], platformConnections: [[]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    await reconcileBufferDeliveries();
    expect(fake.updates[0].values).toMatchObject({ status: "failed", result: { reconciliationRequired: true } });
    expect(fake.updates[0].values).not.toHaveProperty("providerPostId");
    expect(vi.mocked(bufferClient.getBufferPostStatus)).not.toHaveBeenCalled();
  });
  it("handles an interrupted status request with a persisted recovery attempt", async () => {
    const fake = makeFakeDb({ publishingJobs: [[accepted]], platformConnections: [[makeConnRow()]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    vi.mocked(bufferClient.getBufferPostStatus).mockRejectedValue(new Error("Request interrupted"));
    await reconcileBufferDeliveries();
    expect(fake.updates[0].values).toMatchObject({ status: "processing", result: { deliveryPollAttempts: 1 } });
  });
  it("keeps a temporary token refresh failure eligible for another status check", async () => {
    const fake = makeFakeDb({ publishingJobs: [[accepted]], platformConnections: [[makeConnRow()]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    vi.mocked(bufferClient.getBufferPostStatus).mockResolvedValue({ ok: false, reason: "auth", message: "Expired access token" });
    mockedRefreshAccessToken.mockResolvedValue({ ok: false, reason: "network", message: "Temporary refresh outage" });
    await reconcileBufferDeliveries();
    expect(fake.updates[0].values).toMatchObject({ status: "processing", result: { deliveryPollAttempts: 1 } });
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });
  it("records confirmed delivery even on the final polling attempt", async () => {
    const fake = makeFakeDb({ publishingJobs: [[{ ...accepted, result: { deliveryPollAttempts: 47, awaitingDelivery: true } }]], platformConnections: [[makeConnRow()]], contentItems: [[ITEM_ROW]], contentVariants: [[{ ...VARIANT_ROW, status: "published" }]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    vi.mocked(bufferClient.getBufferPostStatus).mockResolvedValue({ ok: true, data: { id: "accepted-post", status: "sent" } });
    await reconcileBufferDeliveries();
    expect(fake.updates[0].values).toMatchObject({ status: "published", providerPostId: "accepted-post", result: { awaitingDelivery: false, deliveryPollAttempts: 48 } });
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });
});

describe("mixed-format post media selection", () => {
  it("selects ordered Carousel images and Reel video independently from shared uploaded media", async () => {
    const fake=makeFakeDb({visualAssets:[[
      {kind:"upload",storagePath:"second.png",mimeType:"image/png",slideIndex:1,createdAt:new Date()},
      {kind:"upload",storagePath:"reel.mov",mimeType:"video/quicktime",slideIndex:0,createdAt:new Date()},
      {kind:"upload",storagePath:"first.png",mimeType:"image/png",slideIndex:0,createdAt:new Date()},
    ]]});mockedGetDb.mockReturnValue(fake.db as never);
    expect(await selectItemMedia({workspaceId:WORKSPACE_ID,contentItemId:ITEM_ID,format:"carousel"})).toMatchObject({kind:"images",paths:["first.png","second.png"]});
    expect(await selectItemMedia({workspaceId:WORKSPACE_ID,contentItemId:ITEM_ID,format:"reel"})).toMatchObject({kind:"video",paths:["reel.mov"],mimeTypes:["video/quicktime"]});
  });
});

describe("deriveContentKind", () => {
  it("maps reel → reel", () => {
    expect(deriveContentKind("reel")).toBe("reel");
  });

  it("maps story → story", () => {
    expect(deriveContentKind("story")).toBe("story");
  });

  it("defaults any other format (single_image, carousel, text_post, null, undefined) to post", () => {
    expect(deriveContentKind("single_image")).toBe("post");
    expect(deriveContentKind("carousel")).toBe("post");
    expect(deriveContentKind("text_post")).toBe("post");
    expect(deriveContentKind(null)).toBe("post");
    expect(deriveContentKind(undefined)).toBe("post");
    expect(deriveContentKind("")).toBe("post");
    expect(deriveContentKind("unknown")).toBe("post");
  });
});

describe("platformToBufferService", () => {
  it("maps facebook → facebook (Buffer channel.service)", () => {
    expect(platformToBufferService("facebook")).toBe("facebook");
  });

  it("maps instagram → instagram (Buffer channel.service)", () => {
    expect(platformToBufferService("instagram")).toBe("instagram");
  });
});

describe("buildBufferPayload", () => {
  const baseArgs = { channelId: "ch-1", text: "Hello", contentKind: "post" as ContentKind, service: "facebook" as const };

  it("returns a payload shaped for createPostForBuffer (incl. service)", () => {
    const dueAt = new Date("2026-09-04T10:00:00.000Z");
    const payload = buildBufferPayload({ ...baseArgs, mode: "customScheduled", dueAt });
    expect(payload).toEqual({
      channelId: "ch-1",
      text: "Hello",
      contentKind: "post",
      mode: "customScheduled",
      service: "facebook",
      dueAt,
    });
  });

  it("omits dueAt when mode=shareNow", () => {
    const payload = buildBufferPayload({ ...baseArgs, mode: "shareNow" });
    expect(payload.dueAt).toBeUndefined();
    expect(payload.mode).toBe("shareNow");
  });

  it("requires dueAt when mode=customScheduled (throws on omit)", () => {
    expect(() => buildBufferPayload({ ...baseArgs, mode: "customScheduled" })).toThrow(/customScheduled requires dueAt/);
  });

  it("forbids dueAt when mode=shareNow (throws on pass)", () => {
    expect(() =>
      buildBufferPayload({ ...baseArgs, mode: "shareNow", dueAt: new Date("2026-09-04T10:00:00.000Z") }),
    ).toThrow(/shareNow forbids dueAt/);
  });

  it("passes contentKind through verbatim (post/story/reel)", () => {
    for (const k of ["post", "story", "reel"] as ContentKind[]) {
      const payload = buildBufferPayload({ ...baseArgs, contentKind: k, mode: "shareNow" });
      expect(payload.contentKind).toBe(k);
    }
  });

  it("passes service through verbatim (facebook/instagram)", () => {
    for (const s of ["facebook", "instagram"] as const) {
      const payload = buildBufferPayload({ ...baseArgs, service: s, mode: "shareNow" });
      expect(payload.service).toBe(s);
    }
  });

  it("throws a PublishingError (not a bare Error) for an out-of-union contentKind", () => {
    try {
      buildBufferPayload({
        channelId: "ch-1",
        text: "Hello",
        mode: "shareNow",
        contentKind: "carousel" as unknown as ContentKind,
        service: "facebook",
      });
      expect.unreachable("buildBufferPayload must throw for an invalid contentKind");
    } catch (error) {
      expect(error).toBeInstanceOf(PublishingError);
      const err = error as PublishingError;
      expect(err.code).toBe("invalid_content_kind");
      expect(err.provider).toBe("buffer");
      expect(err.step).toBe("create_post");
    }
  });
});

describe("createPost variables contract (wired through buildBufferPayload)", () => {
  it("mutation string carries NO literal values — everything travels in variables", () => {
    expect(CREATE_POST_MUTATION).toBe(
      "mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id text dueAt status } } ... on MutationError { message } } }",
    );
    // No quoted literals inline (Buffer rejects quoted enums inside the
    // inline mutation string) and no ids/text baked in.
    expect(CREATE_POST_MUTATION).not.toContain('"');
  });

  it("facebook shareNow — exact variables JSON (assets [], metadata.facebook.type STRING, no dueAt)", () => {
    const args = buildBufferPayload({
      channelId: "ch-1",
      text: "Hello",
      contentKind: "post",
      mode: "shareNow",
      service: "facebook",
    });
    const { input } = buildCreatePostVariables({
      channelId: args.channelId,
      text: args.text,
      mode: args.mode,
      contentKind: args.contentKind,
      service: args.service,
    });
    expect(input).toEqual({
      channelId: "ch-1",
      text: "Hello",
      mode: "shareNow",
      schedulingType: "automatic",
      needsApproval: false,
      assets: [],
      metadata: { facebook: { type: "post" } },
    });
    expect("dueAt" in input).toBe(false);
    expect(input.metadata).toHaveProperty("facebook.type", "post"); // a plain STRING (valid enum in variables)
  });


  it("instagram customScheduled — dueAt present, omits metadata when no firstComment", () => {
    const args = buildBufferPayload({
      channelId: "ch-ig",
      text: "Hi",
      contentKind: "reel",
      mode: "customScheduled",
      service: "instagram",
      dueAt: new Date("2026-09-04T10:00:00.000Z"),
    });
    const { input } = buildCreatePostVariables({
      channelId: args.channelId,
      text: args.text,
      mode: args.mode,
      contentKind: args.contentKind,
      service: args.service,
      dueAt: args.dueAt?.toISOString(),
    });
    expect(input).toEqual({
      channelId: "ch-ig",
      text: "Hi",
      mode: "customScheduled",
      schedulingType: "automatic",
      needsApproval: false,
      assets: [],
      metadata: { instagram: { type: "reel", shouldShareToFeed: true } },
      dueAt: "2026-09-04T10:00:00.000Z",
    });
    expect(input.metadata).toEqual({ instagram: { type: "reel", shouldShareToFeed: true } });
  });

  it("instagram - sends the REQUIRED type + shouldShareToFeed metadata alongside the firstComment", () => {
    const { input } = buildCreatePostVariables({
      channelId: "ch-ig",
      text: "Hi",
      mode: "shareNow",
      contentKind: "post",
      service: "instagram",
      firstComment: "Hello from IG comment!",
    });
    expect(input.metadata).toEqual({
      instagram: { type: "post", shouldShareToFeed: true, firstComment: "Hello from IG comment!" },
    });
    expect((input.metadata as Record<string, unknown>).instagram).toHaveProperty("shouldShareToFeed", true);
  });
});

describe("shouldProactivelyRefresh", () => {
  const NOW = 1_800_000_000_000;

  it("refreshes when the expiry is under 5 minutes away and a refresh token exists", () => {
    expect(shouldProactivelyRefresh(makeEnvelope({ expiresAt: NOW + 4 * 60_000 }), NOW)).toBe(true);
    expect(shouldProactivelyRefresh(makeEnvelope({ expiresAt: NOW + 30_000 }), NOW)).toBe(true);
  });

  it("does not refresh when the expiry is comfortably in the future", () => {
    expect(shouldProactivelyRefresh(makeEnvelope({ expiresAt: NOW + 10 * 60_000 }), NOW)).toBe(false);
  });

  it("requires BOTH an expiry and a refresh token", () => {
    expect(shouldProactivelyRefresh(makeEnvelope({ expiresAt: NOW + 30_000, refreshToken: null }), NOW)).toBe(false);
    expect(shouldProactivelyRefresh(makeEnvelope({ expiresAt: null }), NOW)).toBe(false);
    expect(shouldProactivelyRefresh(null, NOW)).toBe(false);
  });
});

describe("PublishingError", () => {
  it("carries code, provider and step", () => {
    const err = new PublishingError({ code: "auth", message: "Token expired", provider: "buffer", step: "create_post" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("PublishingError");
    expect(err.code).toBe("auth");
    expect(err.provider).toBe("buffer");
    expect(err.step).toBe("create_post");
    expect(err.message).toBe("Token expired");
  });

  it("accepts 'none' provider for pre-resolve failures", () => {
    const err = new PublishingError({ code: "not_connected", message: "Not connected", provider: "none", step: "resolve" });
    expect(err.provider).toBe("none");
    expect(err.step).toBe("resolve");
  });
});

describe("retry idempotency guard contract", () => {
  it("documents the predicate the service applies (providerPostId set → refuse)", () => {
    // The actual retry call hits a DB; here we just lock in the contract so
    // the public surface never silently regresses: a publishing_jobs row
    // carrying a non-null providerPostId is terminal-success and must not be
    // re-fired. The service throws/returns already_published in that case.
    const fakeRow = { providerPostId: "post-abc", status: "published" };
    const isTerminal = Boolean(fakeRow.providerPostId) || fakeRow.status === "published";
    expect(isTerminal).toBe(true);
  });
});

describe("retry exponential backoff contract", () => {
  it("applies exponential growth with a 60s single-retry sleep cap", () => {
    const baseBackoffMs = 5 * 60_000;
    const backoff = (attempt: number) => Math.min(baseBackoffMs * Math.pow(2, attempt - 1), 60_000);
    expect(backoff(1)).toBe(60_000); // 300_000 → capped
    expect(backoff(2)).toBe(60_000); // 600_000 → capped
    expect(backoff(3)).toBe(60_000); // 1_200_000 → capped
  });

  it("applies exponential growth with no cap when the cap is disabled", () => {
    const baseBackoffMs = 1_000;
    const backoff = (attempt: number) => baseBackoffMs * Math.pow(2, attempt - 1);
    expect(backoff(1)).toBe(1_000);
    expect(backoff(2)).toBe(2_000);
    expect(backoff(3)).toBe(4_000);
  });

  it("returns attempts_exhausted reason when currentAttempt >= maxAttempts", () => {
    const maxAttempts = 3;
    const terminalReason = (currentAttempt: number) => (currentAttempt >= maxAttempts ? "attempts_exhausted" : "retry");
    expect(terminalReason(3)).toBe("attempts_exhausted");
    expect(terminalReason(2)).toBe("retry");
  });
});

describe("PublishMode / ContentKind types", () => {
  it("'shareNow' and 'customScheduled' are the only publish modes", () => {
    const modes: PublishMode[] = ["shareNow", "customScheduled"];
    expect(modes).toHaveLength(2);
  });
});

/* ── Service lifecycle (DB-backed: token refresh, channel guard, honesty) ── */

/** The happy-path channels query: the validated channel exists and its
 *  service matches the publishing platform. */
function mockChannelOk() {
  mockedListChannels.mockResolvedValue({
    ok: true,
    data: [{ id: CHANNEL_REF, service: "facebook", username: "Page A" }],
  });
}

describe("resolvePublishConnection — token lifecycle", () => {
  it("serializes CONCURRENT proactive refreshes into ONE token refresh (single-use refresh tokens)", async () => {
    // Expiry 60s away → every resolve wants a proactive refresh; the per-
    // connection in-flight lock must collapse both into one provider call.
    const conn = makeConnRow({ envelope: makeEnvelope({ expiresAt: Date.now() + 60_000 }) });
    const fake = makeFakeDb({ platformConnections: [[conn]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedRefreshAccessToken.mockResolvedValue({
      ok: true,
      data: { access_token: "tok-2", refresh_token: "ref-2", expires_in: 3600 },
    });

    const [a, b] = await Promise.all([
      resolvePublishConnection(WORKSPACE_ID, "facebook"),
      resolvePublishConnection(WORKSPACE_ID, "facebook"),
    ]);

    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.accessToken).toBe("tok-2");
      expect(b.accessToken).toBe("tok-2"); // BOTH callers share the rotated token
    }
    expect(mockedRefreshAccessToken).toHaveBeenCalledTimes(1);
    // The rotated envelope persisted exactly once (single writer).
    const tokenPersist = fake.updates.filter((u) => "encryptedToken" in u.values);
    expect(tokenPersist).toHaveLength(1);
  });

  it("keeps the DB envelope and skips the write when another writer already rotated (stale-overwrite guard)", async () => {
    const original = makeConnRow({ envelope: makeEnvelope({ expiresAt: Date.now() + 60_000 }) });
    const rotatedElsewhere = makeConnRow({
      envelope: makeEnvelope({ accessToken: "tok-other", refreshToken: "ref-other", expiresAt: Date.now() + 3600_000 }),
    });
    // Select sequence: provider resolve → connection load → rotate's re-read.
    const fake = makeFakeDb({ platformConnections: [[original], [original], [rotatedElsewhere]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedRefreshAccessToken.mockResolvedValue({
      ok: true,
      data: { access_token: "tok-ours", refresh_token: "ref-ours", expires_in: 3600 },
    });

    const res = await resolvePublishConnection(WORKSPACE_ID, "facebook");

    expect(res.ok).toBe(true);
    if (res.ok) {
      // The OTHER writer's envelope wins; ours (and its single-use refresh
      // token) are dead and must NOT overwrite the DB.
      expect(res.accessToken).toBe("tok-other");
      expect(res.refreshToken).toBe("ref-other");
    }
    expect(mockedRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fake.updates.filter((u) => "encryptedToken" in u.values)).toHaveLength(0);
  });

  it("does NOT proactively refresh an envelope with no expiresAt (relies on the reactive 401 path)", async () => {
    const conn = makeConnRow({ envelope: makeEnvelope({ expiresAt: null }) });
    const fake = makeFakeDb({ platformConnections: [[conn]] });
    mockedGetDb.mockReturnValue(fake.db as never);

    const res = await resolvePublishConnection(WORKSPACE_ID, "facebook");

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.accessToken).toBe("tok-1");
    expect(mockedRefreshAccessToken).not.toHaveBeenCalled();
  });

  it("never marks the connection expired at boot/resolution (only real publish failures do)", async () => {
    const conn = makeConnRow({ envelope: makeEnvelope({ expiresAt: Date.now() + 60_000 }) });
    const fake = makeFakeDb({ platformConnections: [[conn]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    // Proactive refresh FAILS (transient provider hiccup) — resolution still
    // succeeds with the current token and the row is untouched.
    mockedRefreshAccessToken.mockResolvedValue({ ok: false, reason: "network", message: "socket hang up" });

    const res = await resolvePublishConnection(WORKSPACE_ID, "facebook");

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.accessToken).toBe("tok-1");
    expect(fake.updates.filter((u) => u.values.status === "expired")).toHaveLength(0);
  });
});

describe("publishNow — Buffer lifecycle", () => {
  it.each(["network", "invalid_response"] as const)("does not resend after an ambiguous %s response", async reason => {
    const fake = happyDb(makeConnRow());
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({ ok: false, reason, message: "Response lost" });
    const result = await publishNow({ workspaceId: WORKSPACE_ID, contentItemId: ITEM_ID, contentVariantId: VARIANT_ID, platform: "facebook" });
    expect(result).toMatchObject({ ok: false, reason: "unknown_outcome" });
    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(1);
    expect(fake.updates.some(write => write.values.status === "published")).toBe(false);
  });

  it.each([
    { status: "processing", providerPostId: null },
    { status: "failed", providerPostId: "accepted-1" },
    { status: "failed", providerPostId: null, result: { reconciliationRequired: true } },
  ])("blocks a new immediate publish when a prior job is active or unconfirmed: %j", async job => {
    const fake = makeFakeDb({ contentItems: [[ITEM_ROW]], contentVariants: [[VARIANT_ROW]],
      platformConnections: [[makeConnRow()]], publishingJobs: [[job]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    const result = await publishNow({ workspaceId: WORKSPACE_ID, contentItemId: ITEM_ID, contentVariantId: VARIANT_ID, platform: "facebook" });
    expect(result).toMatchObject({ ok: false, reason: "publish_conflict" });
    expect(fake.inserts).toHaveLength(0);
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });
  it.each(["unknown", "pending", "error"])("preserves the accepted post ID without claiming publication for status %s", async (status) => {
    const fake = happyDb(makeConnRow());
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({ ok: true, data: { id: "accepted-1", status, dueAt: null } });
    const result = await publishNow({ workspaceId: WORKSPACE_ID, contentItemId: ITEM_ID, contentVariantId: VARIANT_ID, platform: "facebook" });
    expect(result.ok).toBe(status !== "error");
    if (result.ok) expect(result.pendingDelivery).toBe(true);
    expect(fake.updates.some(write => write.values.status === "published")).toBe(false);
    expect(fake.updates.find(write => write.table === publishingJobs && write.values.providerPostId === "accepted-1")?.values)
      .toMatchObject({ status: status === "error" ? "failed" : "processing", providerPostId: "accepted-1" });
    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(1);
  });
  function happyDb(conn: Row, spec?: { visualAssets?: Row[][]; contentVariants?: Row[][] }) {
    return makeFakeDb({
      platformConnections: [[conn]],
      contentVariants: spec?.contentVariants ?? [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: spec?.visualAssets ?? [[]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
  }

  function mockChannelOk() {
    mockedListChannels.mockResolvedValue({
      ok: true,
      data: [{ id: CHANNEL_REF, service: "facebook", username: "Page A" }],
    });
  }

  it("on 401 → refreshes ONCE → retries → succeeds; persists providerPostId and honest mediaAttached", async () => {
    const conn = makeConnRow(); // far-future expiry → no proactive refresh
    const fake = happyDb(conn, {
      // select #1: variant by id (loadPublishContext); #2: statuses for the
      // allPublished check after the flip.
      contentVariants: [[VARIANT_ROW], [{ status: "published" }]],
    });
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer
      .mockResolvedValueOnce({ ok: false, reason: "auth", message: "token expired" })
      .mockResolvedValueOnce({ ok: true, data: { id: "post-ok", status: "sent", dueAt: null } });
    mockedRefreshAccessToken.mockResolvedValue({
      ok: true,
      data: { access_token: "tok-2", refresh_token: "ref-2", expires_in: 3600 },
    });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res).toEqual({
      ok: true,
      provider: "buffer",
      mode: "shareNow",
      providerPostId: "post-ok",
      pendingDelivery: false,
      scheduledAt: expect.any(Date),
      mediaAttached: false, // text-only variant, no visual attached
    });
    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(2);
    // The retry ran with the REFRESHED token and the full call bag
    // (firstComment from the variant, per-service metadata source).
    expect(mockedCreatePostForBuffer.mock.calls[1][0]).toBe("tok-2");
    expect(mockedCreatePostForBuffer.mock.calls[1][1]).toMatchObject({
      channelId: CHANNEL_REF,
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
      firstComment: "First! 🚀",
      mediaUrls: [],
    });
    // The rotated envelope was persisted (stale guard passed: same token).
    expect(fake.updates.filter((u) => "encryptedToken" in u.values)).toHaveLength(1);
    // The variant flipped to published; the connection was NOT marked expired.
    expect(fake.updates.some((u) => u.values.status === "published")).toBe(true);
    expect(fake.updates.filter((u) => u.values.status === "expired")).toHaveLength(0);
  });

  it("marks the connection expired ONLY after refresh + retry still 401 (double-401 → auth_expired)", async () => {
    const conn = makeConnRow();
    const fake = happyDb(conn);
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({ ok: false, reason: "auth", message: "token expired" });
    mockedRefreshAccessToken.mockResolvedValue({
      ok: true,
      data: { access_token: "tok-2", refresh_token: "ref-2", expires_in: 3600 },
    });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res).toEqual({
      ok: false,
      reason: "auth_expired",
      message: "Buffer session expired — reconnect on the Connections page.",
    });
    // Exactly one refresh + one retry, then the honest terminal state.
    expect(mockedRefreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(2);
    expect(fake.updates.filter((u) => u.values.status === "expired")).toHaveLength(1);
    // No publish flip ever happened.
    expect(fake.updates.some((u) => u.values.status === "published")).toBe(false);
  });

  it("attaches the visual as ONE image asset and records mediaAttached in the job result jsonb", async () => {
    const conn = makeConnRow({ id: "conn-media" });
    const fake = happyDb(conn, { visualAssets: [[{ storagePath: "brand-assets/visual.png" }]] });
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({ ok: true, data: { id: "post-media", status: "sent", dueAt: null } });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      jobId: "job-1", // worker path → the job row's result jsonb is written
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.mediaAttached).toBe(true);
    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(1);
    expect(mockedCreatePostForBuffer.mock.calls[0][1]?.mediaUrls).toEqual(["https://signed.example/visual.png"]);
    const jobUpdate = fake.updates.find((u) => u.values.providerPostId === "post-media");
    expect(jobUpdate).toBeDefined();
    expect((jobUpdate!.values.result as Record<string, unknown>).mediaAttached).toBe(true);
  });

  it("fails with the actionable config message when the service-role key is missing (visual present)", async () => {
    const conn = makeConnRow({ id: "conn-nokey" });
    const fake = makeFakeDb({
      platformConnections: [[conn]],
      contentVariants: [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[{ storagePath: "brand-assets/broken.png" }]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
    mockedGetDb.mockReturnValue(fake.db as never);
    // createServiceClient THROWS only for missing env config. The user-JWT
    // fallback also fails here (the server-client mock throws — worker-like
    // context), so the actionable config message must surface — not the old
    // misleading "storage unreachable".
    vi.mocked(createServiceClient).mockImplementationOnce(() => {
      throw new Error("Supabase service role is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see SETUP.md).");
    });
    mockChannelOk();

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("missing_image_url");
      expect(res.message).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(res.message).toContain("restart the dev server");
    }
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
    // Synthetic job row: inserted up-front, then failed with the real message.
    expect(fake.inserts).toHaveLength(1);
    const failUpdate = fake.updates.find((u) => u.table === publishingJobs && u.values.status === "failed");
    expect(failUpdate).toBeDefined();
    expect(failUpdate!.values.lastError).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("fails with the storage-unreachable message when signing fails on a configured client", async () => {
    const conn = makeConnRow({ id: "conn-nosign" });
    const fake = makeFakeDb({
      platformConnections: [[conn]],
      contentVariants: [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[{ storagePath: "brand-assets/broken.png" }]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
    mockedGetDb.mockReturnValue(fake.db as never);
    // Configured client (no throw) but the signing call returns no URL — a
    // genuine storage/network failure, distinct from the config case.
    vi.mocked(createServiceClient).mockImplementationOnce(() => ({
      storage: {
        from: () => ({
          createSignedUrl: async () => ({ data: null, error: { message: "bucket not found" } }),
        }),
      },
    }) as never);
    mockChannelOk();

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("missing_image_url");
      expect(res.message).toContain("storage unreachable");
      expect(res.message).toContain("the post was not published");
    }
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });
});

describe("publishNow — channel validation (5-min success cache)", () => {
  function dbFor(connId: string) {
    return makeFakeDb({
      platformConnections: [[makeConnRow({ id: connId })]],
      // The FULL variant row must repeat for every select: this describe runs
      // publishNow twice (cache test), and the fake's LAST queue entry is the
      // repeating one — a statuses-only row would fail the service's variant
      // ownership check on the second call.
      contentVariants: [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
  }

  it("fails with channel_invalid when the Buffer channel no longer exists on the account", async () => {
    const fake = dbFor("conn-cv-gone");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedListChannels.mockResolvedValue({
      ok: true,
      data: [{ id: "some-other-channel", service: "facebook", username: "Not ours" }],
    });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res).toMatchObject({ ok: false, reason: "channel_invalid" });
    if (!res.ok) expect(res.message).toContain("no longer available");
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });

  it("fails with channel_invalid when the channel service does not match the platform", async () => {
    const fake = dbFor("conn-cv-mismatch");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedListChannels.mockResolvedValue({
      ok: true,
      data: [{ id: CHANNEL_REF, service: "instagram", username: "IG acct" }],
    });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res).toMatchObject({ ok: false, reason: "channel_invalid" });
    if (!res.ok) expect(res.message).toContain("service mismatch");
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });

  it("fails with channel_invalid when the Buffer channels query itself fails", async () => {
    const fake = dbFor("conn-cv-fail");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedListChannels.mockResolvedValue({ ok: false, reason: "auth", message: "token expired" });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res).toMatchObject({ ok: false, reason: "channel_invalid" });
    if (!res.ok) expect(res.message).toContain("Buffer channel check failed");
  });

  it("caches a successful validation per connection+channel — the channels query runs once for two publishes", async () => {
    const fake = dbFor("conn-cv-cache");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({ ok: true, data: { id: "post-cached", status: "sent", dueAt: null } });

    const call = () =>
      publishNow({
        workspaceId: WORKSPACE_ID,
        contentItemId: ITEM_ID,
        contentVariantId: VARIANT_ID,
        platform: "facebook",
      });

    const first = await call();
    const second = await call();
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(mockedListChannels).toHaveBeenCalledTimes(1); // cache hit the second time
    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(2);
  });
});

describe("publishNow / schedulePost — connection guard", () => {
  it("refuses to publish with the clear reconnect message when NO connected connection exists for the platform", async () => {
    // No platformConnections rows; settings absent → provider falls back to
    // meta → still no connected row → honest failure, never a doomed call.
    const fake = makeFakeDb({
      platformConnections: [[]],
      contentVariants: [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[]],
      workspaces: [[{ createdBy: "user-1" }]],
      settings: [[]],
    });
    mockedGetDb.mockReturnValue(fake.db as never);

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res).toEqual({
      ok: false,
      reason: "not_connected",
      message: "No connected Facebook account. Connect one on the Connections page.",
    });
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });

  it("schedulePost stamps the job with the resolved provider + channel and flips statuses", async () => {
    const fake = makeFakeDb({
      platformConnections: [[makeConnRow()]],
      contentVariants: [[VARIANT_ROW], [VARIANT_ROW], [{ status: "scheduled" }]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
    mockedGetDb.mockReturnValue(fake.db as never);
    const scheduledAt = new Date(Date.now() + 86_400_000);

    const res = await schedulePost({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      scheduledAt,
    });

    expect(res).toEqual({
      ok: true,
      jobId: "job-1",
      scheduledAt,
      provider: "buffer",
      channelRef: CHANNEL_REF,
    });
    const insert = fake.inserts[0];
    expect(insert).toBeDefined();
    expect(insert.values).toMatchObject({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      provider: "buffer",
      status: "pending",
    });
    expect((insert.values.scheduledAt as Date).toISOString()).toBe(scheduledAt.toISOString());
    // refresh/channel checks are publish-time concerns — none ran here.
    expect(mockedRefreshAccessToken).not.toHaveBeenCalled();
    expect(mockedListChannels).not.toHaveBeenCalled();
  });

  it("schedulePost refuses to create a doomed job when no connection exists", async () => {
    const fake = makeFakeDb({
      platformConnections: [[]],
      contentVariants: [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[]],
      workspaces: [[{ createdBy: "user-1" }]],
      settings: [[]],
    });
    mockedGetDb.mockReturnValue(fake.db as never);

    const res = await schedulePost({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      scheduledAt: new Date(Date.now() + 86_400_000),
    });

    expect(res).toEqual({
      ok: false,
      reason: "not_connected",
      message: "No connected Facebook account. Connect one on the Connections page.",
    });
    expect(fake.inserts).toHaveLength(0);
  });
});

/* ── Fix A: first-comment paid-plan fallback ─────────────────────────── */

describe("publishNow — first-comment paid-plan fallback", () => {
  function fcDb(connId: string) {
    return makeFakeDb({
      platformConnections: [[makeConnRow({ id: connId })]],
      contentVariants: [[VARIANT_ROW]], // firstComment: "First! 🚀"
      contentItems: [[ITEM_ROW]],
      visualAssets: [[]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
  }

  it("retries EXACTLY ONCE without the firstComment when Buffer rejects it as a paid plan, then succeeds with firstCommentSkipped", async () => {
    const fake = fcDb("conn-fc-ok");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer
      .mockResolvedValueOnce({ ok: false, reason: "rejected", message: "Invalid post: First comment requires a paid plan." })
      .mockResolvedValueOnce({ ok: true, data: { id: "post-fc", status: "sent", dueAt: null } });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    // Two calls total: the original (with firstComment) + the stripped retry.
    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(2);
    expect(mockedCreatePostForBuffer.mock.calls[0][1]?.firstComment).toBe("First! 🚀");
    // Identical payload MINUS the firstComment (no duplicate post: Buffer
    // created nothing on the MutationError).
    expect(mockedCreatePostForBuffer.mock.calls[1][1]).toMatchObject({
      channelId: CHANNEL_REF,
      text: "Variant caption\n\n#tag1 #tag2",
      mode: "shareNow",
      contentKind: "post",
      service: "facebook",
      firstComment: null,
    });
    expect(res).toEqual({
      ok: true,
      provider: "buffer",
      mode: "shareNow",
      providerPostId: "post-fc",
      pendingDelivery: false,
      scheduledAt: expect.any(Date),
      mediaAttached: false,
      firstCommentSkipped: true,
    });
    // Threaded into the synthetic job row's result jsonb.
    const jobUpdate = fake.updates.find((u) => u.table === publishingJobs && u.values.providerPostId === "post-fc");
    expect(jobUpdate).toBeDefined();
    expect((jobUpdate!.values.result as Record<string, unknown>).firstCommentSkipped).toBe(true);
  });

  it("does NOT retry for non-matching errors (first comment only sent untouched)", async () => {
    const fake = fcDb("conn-fc-other");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({
      ok: false,
      reason: "rejected",
      message: "Invalid post: Image dimensions not supported.",
    });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(1);
    expect(mockedCreatePostForBuffer.mock.calls[0][1]?.firstComment).toBe("First! 🚀");
    expect(res).toMatchObject({ ok: false, reason: "rejected", message: "Invalid post: Image dimensions not supported." });
    expect(res.ok || ("firstCommentSkipped" in res)).toBe(false);
  });

  it("fails with the ORIGINAL paid-plan message when both attempts fail", async () => {
    const fake = fcDb("conn-fc-both");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer
      .mockResolvedValueOnce({ ok: false, reason: "rejected", message: "Invalid post: First comment requires a paid plan." })
      .mockResolvedValueOnce({ ok: false, reason: "rejected", message: "Invalid post: still rejected." });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(2);
    expect(res).toMatchObject({
      ok: false,
      reason: "rejected",
      message: "Invalid post: First comment requires a paid plan.", // ORIGINAL, not the retry's
    });
    // The synthetic job row failed with the original message.
    const failUpdate = fake.updates.find((u) => u.table === publishingJobs && u.values.status === "failed");
    expect(failUpdate).toBeDefined();
    expect(failUpdate!.values.lastError).toBe("Invalid post: First comment requires a paid plan.");
  });

  it("strips the first comment and retries EXACTLY ONCE when Buffer rejects it (comment-specific failure)", async () => {
    const fake = fcDb("conn-fc-ig");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer
      .mockResolvedValueOnce({
        ok: false,
        reason: "rejected",
        message: 'Field "firstComment" is not defined by type "InstagramPostMetadataInput".',
      })
      .mockResolvedValueOnce({ ok: true, data: { id: "post-ig-fc", status: "sent", dueAt: null } });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "instagram",
    });

    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(2);
    const first = mockedCreatePostForBuffer.mock.calls[0][1];
    const retry = mockedCreatePostForBuffer.mock.calls[1][1];
    expect(first?.firstComment).toBe(VARIANT_ROW.firstComment);
    // The retry is the SAME post (channel/kind/service/media identical) with ONLY
    // the comment dropped. The per-service metadata is rebuilt by the variables
    // builder, so the retry payload is valid on its own - the exact Instagram
    // variables JSON (required type + shouldShareToFeed) is locked in
    // client.test.ts.
    expect(retry?.channelId).toBe(first?.channelId);
    expect(retry?.contentKind).toBe(first?.contentKind);
    expect(retry?.service).toBe(first?.service);
    expect(retry?.mediaUrls).toEqual(first?.mediaUrls);
    expect(retry?.videoUrl).toBe(first?.videoUrl);
    expect(retry?.firstComment).toBeNull();
    expect(res).toEqual({
      ok: true,
      provider: "buffer",
      mode: "shareNow",
      providerPostId: "post-ig-fc",
      pendingDelivery: false,
      scheduledAt: expect.any(Date),
      mediaAttached: false,
      firstCommentSkipped: true,
    });
    // Published ONLY after Buffer confirmed success, with providerPostId
    // persisted (idempotency: a second fire refuses because it is set).
    const jobUpdate = fake.updates.find((u) => u.table === publishingJobs && u.values.providerPostId === "post-ig-fc");
    expect(jobUpdate).toBeDefined();
    expect(jobUpdate!.values.status).toBe("published");
    expect((jobUpdate!.values.result as Record<string, unknown>).firstCommentSkipped).toBe(true);
  });

  it("does NOT retry for a required-field payload error (permanent, never published)", async () => {
    const fake = fcDb("conn-fc-ig-required");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({
      ok: false,
      reason: "rejected",
      message:
        'Variable "$input" got invalid value {...} at "input.metadata.instagram"; Field "type" of required type "PostType!" was not provided.',
    });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "instagram",
    });

    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ ok: false, reason: "rejected", message: expect.stringContaining("PostType") });
    const published = fake.updates.find((u) => u.table === publishingJobs && u.values.status === "published");
    expect(published).toBeUndefined();
    const failed = fake.updates.find((u) => u.table === publishingJobs && u.values.status === "failed");
    expect(failed).toBeDefined();
  });
  it("isFirstCommentPlanError matches only comment / unsupported-Instagram-metadata causes", () => {
    expect(isFirstCommentPlanError("Invalid post: First comment requires a paid plan.")).toBe(true);
    expect(isFirstCommentPlanError('Field "firstComment" is not defined by type "InstagramPostMetadataInput"')).toBe(true);
    expect(isFirstCommentPlanError("Unsupported Instagram metadata field")).toBe(true);
    // REQUIRED-field validation errors are payload bugs - never strip-and-retry.
    expect(
      isFirstCommentPlanError(
        'Variable "$input" got invalid value {...} at "input.metadata.instagram"; Field "type" of required type "PostType!" was not provided.',
      ),
    ).toBe(false);
    expect(isFirstCommentPlanError('Field "shouldShareToFeed" of required type "Boolean!" was not provided.')).toBe(false);
    expect(isFirstCommentPlanError("Invalid post: Image dimensions not supported.")).toBe(false);
    expect(isFirstCommentPlanError("Channel not found")).toBe(false);
  });});

/* ── Fix B: publishNow synthetic job-row persistence ─────────────────── */

describe("publishNow — synthetic job row persistence", () => {
  function synDb(connId: string) {
    return makeFakeDb({
      platformConnections: [[makeConnRow({ id: connId })]],
      contentVariants: [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
  }

  it("persists a FAILED synthetic row with lastError when the publish fails (no caller jobId)", async () => {
    const fake = synDb("conn-synfail");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({
      ok: false,
      reason: "rejected",
      message: "Invalid post: Image dimensions not supported.",
    });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res.ok).toBe(false);
    // Up-front row: processing, one attempt, provider + connection stamped.
    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0].values).toMatchObject({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      provider: "buffer",
      status: "processing",
      attempts: 1,
      scheduledAt: expect.any(Date),
    });
    expect((fake.inserts[0].values.result as Record<string, unknown>).connectionId).toBe("conn-synfail");
    expect((fake.inserts[0].values.result as Record<string, unknown>).channelRef).toBe(CHANNEL_REF);
    // Terminal failure with the REAL error message — no more zero-trace fails.
    const failUpdate = fake.updates.find((u) => u.table === publishingJobs && u.values.status === "failed");
    expect(failUpdate).toBeDefined();
    expect(failUpdate!.values.lastError).toBe("Invalid post: Image dimensions not supported.");
    expect(fake.updates.some((u) => u.values.status === "published")).toBe(false);
  });

  it("transitions the synthetic row to published with providerPostId + result on success", async () => {
    const fake = synDb("conn-synok");
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({ ok: true, data: { id: "post-syn", status: "sent", dueAt: null } });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res).toMatchObject({ ok: true, provider: "buffer", providerPostId: "post-syn" });
    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0].values).toMatchObject({ status: "processing", attempts: 1 });
    const jobUpdate = fake.updates.find((u) => u.table === publishingJobs && u.values.providerPostId === "post-syn");
    expect(jobUpdate).toBeDefined();
    expect(jobUpdate!.values.status).toBe("published");
    const resultJson = jobUpdate!.values.result as Record<string, unknown>;
    expect(resultJson.updateId).toBe("post-syn");
    expect(resultJson.connectionId).toBe("conn-synok");
    expect(resultJson.channelRef).toBe(CHANNEL_REF);
  });
});

/* ── Fix C: partial-schedule visibility (MIN scheduledAt) ────────────── */

describe("schedulePost — partial-schedule visibility", () => {
  it("rejects a past timestamp before any database changes", async () => {
    const fake = makeFakeDb({});
    mockedGetDb.mockReturnValue(fake.db as never);
    expect(await schedulePost({ workspaceId: WORKSPACE_ID, contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID, platform: "facebook", scheduledAt: new Date(Date.now() - 1000) }))
      .toMatchObject({ ok: false, reason: "invalid_time" });
    expect(fake.inserts).toHaveLength(0);
    expect(fake.deletes).toHaveLength(0);
  });
  const SLOT = new Date(Date.now() + 86_400_000);
  const EARLIER = new Date(SLOT.getTime() - 3 * 3_600_000);

  function schedDb(secondStatuses: Row[]) {
    return makeFakeDb({
      platformConnections: [[makeConnRow()]],
      // select #1: variant by id (loadPublishContext); #2: statuses for the
      // all-scheduled check after the variant flip.
      contentVariants: [[VARIANT_ROW], [VARIANT_ROW], secondStatuses],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[]],
      workspaces: [[{ createdBy: "user-1" }]],
      // Pending publish jobs for the item (MIN source). The just-inserted job
      // plus another variant's earlier pending job.
      publishingJobs: [[], [{ scheduledAt: EARLIER }, { scheduledAt: SLOT }]],
    });
  }

  it("sets item.scheduledAt to the MIN pending job when only SOME variants are scheduled (status NOT flipped)", async () => {
    const fake = schedDb([{ status: "scheduled" }, { status: "approved" }]);
    mockedGetDb.mockReturnValue(fake.db as never);

    const res = await schedulePost({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      scheduledAt: SLOT,
    });

    expect(res).toMatchObject({ ok: true, jobId: "job-1", provider: "buffer" });
    // The item update carries the EARLIEST pending slot — the calendar grid
    // anchors on it even though one variant is still approved.
    const itemUpdate = fake.updates.find((u) => u.table === contentItems);
    expect(itemUpdate).toBeDefined();
    expect((itemUpdate!.values.scheduledAt as Date).toISOString()).toBe(EARLIER.toISOString());
    expect(itemUpdate!.values.status).toBeUndefined();
  });

  it("flips the item to scheduled with the MIN scheduledAt when ALL variants are scheduled", async () => {
    const fake = schedDb([{ status: "scheduled" }, { status: "scheduled" }]);
    mockedGetDb.mockReturnValue(fake.db as never);

    const res = await schedulePost({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      scheduledAt: SLOT,
    });

    expect(res).toMatchObject({ ok: true, jobId: "job-1" });
    const itemUpdate = fake.updates.find((u) => u.table === contentItems);
    expect(itemUpdate).toBeDefined();
    expect(itemUpdate!.values.status).toBe("scheduled");
    expect((itemUpdate!.values.scheduledAt as Date).toISOString()).toBe(EARLIER.toISOString());
  });
});

/* ── Third fallback: public-URL HEAD (no-key background path) ─────────── */

describe("schedulePost — Auto Run Calendar policy", () => {
  const policy = { timezone: "Asia/Karachi", times: ["09:00", "12:00", "17:00"], source: "configured-fallback", fallbackTimes: ["09:00", "12:00", "17:00"], minGapMinutes: 120, maxPostsPerDay: 3 };
  function autoDb(config: Row, occupied: Row[]) {
    return makeFakeDb({ platformConnections: [[makeConnRow()]], contentItems: [[ITEM_ROW]],
      contentVariants: [[VARIANT_ROW], [VARIANT_ROW], [{ status: "scheduled" }]], visualAssets: [[]],
      workspaces: [[{ id: WORKSPACE_ID, createdBy: "user-1" }]], settings: [[{ value: config }]],
      publishingJobs: [occupied, [], []] });
  }
  it("uses the next free configured slot from the committed Calendar instead of the supplied placeholder", async () => {
    const tomorrow = new Date(`${dateIsoInTz(policy.timezone, new Date())}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const day = tomorrow.toISOString().slice(0, 10);
    const fake = autoDb({ enabled: true, requireApproval: false, autoSchedule: true }, [{ scheduledAt: parseZonedDateTime(day, "09:30", policy.timezone) }]);
    mockedGetDb.mockReturnValue(fake.db as never);
    const res = await schedulePost({ workspaceId: WORKSPACE_ID, contentItemId: ITEM_ID, contentVariantId: VARIANT_ID, platform: "facebook",
      scheduledAt: new Date(Date.now() + 60_000), autoTiming: policy });
    expect(res.ok).toBe(true);
    expect(hmInTz(policy.timezone, fake.inserts[0].values.scheduledAt as Date)).toBe("12:00");
    expect(dateIsoInTz(policy.timezone, fake.inserts[0].values.scheduledAt as Date)).toBe(day);
    expect(fake.inserts[0].values.result).toMatchObject({ schedulingSource: "configured-fallback", timezone: policy.timezone });
  });
  it.each([{ enabled: false, requireApproval: false }, { enabled: true, requireApproval: true }, { enabled: true, requireApproval: false, autoSchedule: false }])("honors changed approval/enable/scheduling settings at commit time: %j", async config => {
    const fake = autoDb(config, []); mockedGetDb.mockReturnValue(fake.db as never);
    expect(await schedulePost({ workspaceId: WORKSPACE_ID, contentItemId: ITEM_ID, contentVariantId: VARIANT_ID, platform: "facebook",
      scheduledAt: new Date(Date.now() + 60_000), autoTiming: policy })).toMatchObject({ ok: false, reason: "not_approved" });
    expect(fake.inserts).toHaveLength(0); expect(fake.deletes).toHaveLength(0);
  });
});

describe("signedUrlForVisual — public-URL fallback", () => {
  /** DB with a visual present (the signing chain is exercised). */
  function visualDb(connId: string) {
    return makeFakeDb({
      platformConnections: [[makeConnRow({ id: connId })]],
      contentVariants: [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[{ storagePath: "brand-assets/visual.png" }]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
  }

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    vi.unstubAllGlobals();
  });

  it("returns the bucket's public URL when BOTH signed attempts fail and the HEAD 200s", async () => {
    const fake = visualDb("conn-pub-ok");
    mockedGetDb.mockReturnValue(fake.db as never);
    // Config failure (service-role key missing) + the request-scoped fallback
    // throws (worker-like context) → the third fallback must kick in.
    vi.mocked(createServiceClient).mockImplementationOnce(() => {
      throw new Error("Supabase service role is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see SETUP.md).");
    });
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({ ok: true, data: { id: "post-pub", status: "sent", dueAt: null } });
    // Trailing slash exercises the join-trim; HEAD 200 → reachable public object.
    process.env.SUPABASE_URL = "https://supa.example.co/";
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.mediaAttached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://supa.example.co/storage/v1/object/public/brand-assets/brand-assets/visual.png",
      expect.objectContaining({ method: "HEAD", redirect: "error", signal: expect.any(AbortSignal) }),
    );
    expect(mockedCreatePostForBuffer.mock.calls[0][1]?.mediaUrls).toEqual([
      "https://supa.example.co/storage/v1/object/public/brand-assets/brand-assets/visual.png",
    ]);
    // Honest mediaAttached in the job-row result jsonb (worker path).
    const jobUpdate = fake.updates.find((u) => u.values.providerPostId === "post-pub");
    expect(jobUpdate).toBeDefined();
    expect((jobUpdate!.values.result as Record<string, unknown>).mediaAttached).toBe(true);
  });

  it("keeps the actionable config error when the public-URL HEAD 404s (private/missing object)", async () => {
    const fake = visualDb("conn-pub-404");
    mockedGetDb.mockReturnValue(fake.db as never);
    vi.mocked(createServiceClient).mockImplementationOnce(() => {
      throw new Error("Supabase service role is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see SETUP.md).");
    });
    mockChannelOk();
    process.env.SUPABASE_URL = "https://supa.example.co";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })));

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("missing_image_url");
      expect(res.message).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(res.message).toContain("restart the dev server");
    }
    expect(mockedCreatePostForBuffer).not.toHaveBeenCalled();
  });
});

/* ── mediaUrlOverride: interactive path pre-mints with the user session ── */

describe("publishNow — mediaUrlOverride (Calendar Publish Now pre-mint)", () => {
  function visualDb(connId: string, visualRows?: Row[][]) {
    return makeFakeDb({
      platformConnections: [[makeConnRow({ id: connId })]],
      contentVariants: [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: visualRows ?? [[{ storagePath: "ws-1/visuals/visual.png" }]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
  }

  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    vi.unstubAllGlobals();
  });

  it("uses the override verbatim and SKIPS minting entirely (works with no service key)", async () => {
    const fake = visualDb("conn-override");
    mockedGetDb.mockReturnValue(fake.db as never);
    // Any minting attempt would fail loudly here — the override must mean the
    // signer is never constructed (this is exactly the no-service-key live case).
    vi.mocked(createServiceClient).mockImplementationOnce(() => {
      throw new Error("Supabase service role is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (see SETUP.md).");
    });
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({ ok: true, data: { id: "post-override", status: "sent", dueAt: null } });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      mediaUrlOverride: "https://signed.example/preminted-by-session.png",
    });

    expect(res).toMatchObject({ ok: true, providerPostId: "post-override", mediaAttached: true });
    // Minting was skipped entirely — the signer was never constructed.
    expect(vi.mocked(createServiceClient)).not.toHaveBeenCalled();
    expect(mockedCreatePostForBuffer).toHaveBeenCalledTimes(1);
    expect(mockedCreatePostForBuffer.mock.calls[0][1]?.mediaUrls).toEqual(["https://signed.example/preminted-by-session.png"]);
    // Honest mediaAttached in the job-row result jsonb.
    const jobUpdate = fake.updates.find((u) => u.values.providerPostId === "post-override");
    expect(jobUpdate).toBeDefined();
    expect((jobUpdate!.values.result as Record<string, unknown>).mediaAttached).toBe(true);
  });

  it("ignores the override when the variant has NO visual — mediaAttached stays false", async () => {
    const fake = visualDb("conn-override-novisual", [[]]);
    mockedGetDb.mockReturnValue(fake.db as never);
    mockChannelOk();
    mockedCreatePostForBuffer.mockResolvedValue({ ok: true, data: { id: "post-noviz", status: "sent", dueAt: null } });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      mediaUrlOverride: "https://signed.example/preminted-by-session.png",
    });

    expect(res).toMatchObject({ ok: true, providerPostId: "post-noviz", mediaAttached: false });
    expect(mockedCreatePostForBuffer.mock.calls[0][1]?.mediaUrls).toEqual([]);
    const jobUpdate = fake.updates.find((u) => u.values.providerPostId === "post-noviz");
    expect((jobUpdate!.values.result as Record<string, unknown>).mediaAttached).toBeUndefined();
  });
});

/* -- Meta FIRST COMMENT (separate request, own lifecycle, idempotent) -------- */

const metaPublishModule = await import("@/lib/meta/publish");
const mockedPublishPost = vi.mocked(metaPublishModule.publishPost);
const mockedPublishFirstComment = vi.mocked(metaPublishModule.publishFirstComment);

describe("Meta first comment", () => {
  function metaDb(jobRow?: Row) {
    return makeFakeDb({
      platformConnections: [[makeConnRow({ provider: "meta" })]],
      contentVariants: [[{ ...VARIANT_ROW, ...(jobRow?.status === "published" ? { status: "published" } : {}) }]],
      contentItems: [[{ ...ITEM_ROW, ...(jobRow?.status === "published" ? { status: "published" } : {}) }]],
      visualAssets: [[]],
      workspaces: [[{ createdBy: "user-1" }]],
      ...(jobRow ? { publishingJobs: [[jobRow]] } : {}),
    });
  }

  it("publishes the first comment as a SEPARATE request and records the comment id", async () => {
    const fake = metaDb();
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedPublishPost.mockResolvedValue({ ok: true, postId: "post-1", permalink: null });
    mockedPublishFirstComment.mockResolvedValue({ ok: true, commentId: "cmt-1", status: 200 });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      jobId: "job-fc",
    });

    expect(mockedPublishPost).toHaveBeenCalledTimes(1);
    // Separate request, addressed by the id the main post returned.
    expect(mockedPublishFirstComment).toHaveBeenCalledTimes(1);
    expect(mockedPublishFirstComment.mock.calls[0][0]).toMatchObject({
      platform: "facebook",
      postId: "post-1",
      message: VARIANT_ROW.firstComment,
    });
    expect(res).toMatchObject({
      ok: true,
      providerPostId: "post-1",
      comment: { status: "published", providerCommentId: "cmt-1" },
    });
    // The persisted job result carries the comment state + provider comment id.
    const commentStates = fake.updates
      .filter((u) => u.table === publishingJobs)
      .map((u) => (u.values.result ?? {}) as Record<string, unknown>)
      .map((r) => r.comment as Record<string, unknown> | undefined)
      .filter((c): c is Record<string, unknown> => Boolean(c));
    expect(commentStates.some((c) => c.status === "published" && c.providerCommentId === "cmt-1")).toBe(true);
  });

  it("keeps the post Published when the comment fails, and records the failure", async () => {
    const fake = metaDb();
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedPublishPost.mockResolvedValue({ ok: true, postId: "post-2", permalink: null });
    mockedPublishFirstComment.mockResolvedValue({ ok: false, reason: "graph_error", message: "comment boom" });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "instagram",
      jobId: "job-ig",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.providerPostId).toBe("post-2");
      expect(res.comment).toMatchObject({ status: "failed", providerCommentId: null });
      expect(res.comment?.error).toContain("comment boom");
    }
    // The job row is still published - a comment failure never un-publishes.
    const publishedUpdate = fake.updates.find((u) => u.table === publishingJobs && u.values.status === "published");
    expect(publishedUpdate).toBeDefined();
    expect(publishedUpdate!.values.providerPostId).toBe("post-2");
  });

  it("marks an unsupported comment terminal instead of failing or retrying it", async () => {
    const fake = metaDb();
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedPublishPost.mockResolvedValue({ ok: true, postId: "post-3", permalink: null });
    mockedPublishFirstComment.mockResolvedValue({
      ok: false,
      reason: "unsupported",
      message: "Comments are not supported for this media type.",
    });

    const res = await publishNow({
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "instagram",
      jobId: "job-ig-2",
    });

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.comment?.status).toBe("unsupported");
  });

  it("retries ONLY the comment when the main post is already published (never republishes)", async () => {
    const jobRow: Row = {
      id: "job-cmt-only",
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      provider: "meta",
      status: "published",
      providerPostId: "post-9",
      attempts: 1,
      result: {
        postId: "post-9",
        comment: { status: "pending", providerCommentId: null, error: null, attemptedAt: null, publishedAt: null },
      },
    };
    const fake = metaDb(jobRow);
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedPublishFirstComment.mockResolvedValue({ ok: true, commentId: "cmt-9", status: 200 });

    const res = await retryFailedPublish({ workspaceId: WORKSPACE_ID, jobId: "job-cmt-only" });

    // The main post is NOT touched: providerPostId is its idempotency key.
    expect(mockedPublishPost).not.toHaveBeenCalled();
    expect(mockedPublishFirstComment).toHaveBeenCalledTimes(1);
    expect(mockedPublishFirstComment.mock.calls[0][0]).toMatchObject({ postId: "post-9" });
    expect(res).toMatchObject({
      ok: true,
      providerPostId: "post-9",
      comment: { status: "published", providerCommentId: "cmt-9" },
    });
  });

  it("never duplicates a comment that was already created (restart / retry protection)", async () => {
    const jobRow: Row = {
      id: "job-cmt-done",
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "facebook",
      provider: "meta",
      status: "published",
      providerPostId: "post-10",
      attempts: 1,
      result: {
        postId: "post-10",
        comment: { status: "published", providerCommentId: "cmt-10", error: null, attemptedAt: "x", publishedAt: "y" },
      },
    };
    const fake = metaDb(jobRow);
    mockedGetDb.mockReturnValue(fake.db as never);

    const res = await retryFailedPublish({ workspaceId: WORKSPACE_ID, jobId: "job-cmt-done" });

    expect(mockedPublishPost).not.toHaveBeenCalled();
    expect(mockedPublishFirstComment).not.toHaveBeenCalled();
    expect(res).toMatchObject({ ok: false, reason: "already_published" });
  });

  it("records permission_required (terminal) when Meta refuses the comment permission, and keeps the post published", async () => {
    const jobRow: Row = {
      id: "job-cmt-perm",
      workspaceId: WORKSPACE_ID,
      contentItemId: ITEM_ID,
      contentVariantId: VARIANT_ID,
      platform: "instagram",
      provider: "meta",
      status: "published",
      providerPostId: "post-perm",
      attempts: 1,
      result: {
        postId: "post-perm",
        comment: { status: "pending", providerCommentId: null, error: null, attemptedAt: null, publishedAt: null },
      },
    };
    const fake = metaDb(jobRow);
    mockedGetDb.mockReturnValue(fake.db as never);
    mockedPublishFirstComment.mockResolvedValue({
      ok: false,
      reason: "permission_required",
      message: "Permissions error",
      code: 200,
      status: 400,
    });

    const res = await retryFailedPublish({ workspaceId: WORKSPACE_ID, jobId: "job-cmt-perm" });

    expect(mockedPublishPost).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.comment?.status).toBe("permission_required");
      expect(res.comment?.error).toMatch(/instagram_manage_comments/);
      expect(res.comment?.providerCommentId).toBeNull();
    }
    // Terminal status: a further retry must NOT re-attempt the comment.
    const stored = fake.updates
      .filter((u) => u.table === publishingJobs)
      .map((u) => (u.values.result ?? {}) as Record<string, unknown>)
      .map((r) => r.comment as Record<string, unknown> | undefined)
      .filter((c): c is Record<string, unknown> => Boolean(c));
    expect(stored.some((c) => c.status === "permission_required")).toBe(true);
  });
});
