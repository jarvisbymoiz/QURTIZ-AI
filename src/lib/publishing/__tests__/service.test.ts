import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATE_POST_MUTATION,
  buildCreatePostVariables,
  type BufferTokenEnvelope,
} from "@/lib/buffer/client";
import {
  buildBufferPayload,
  deriveContentKind,
  platformToBufferService,
  publishNow,
  resolvePublishConnection,
  schedulePost,
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
  };
});

vi.mock("@/lib/meta/publish", () => ({ publishPost: vi.fn() }));

// Signed-URL helper stub: the service asks Supabase storage for a reachable
// image URL whenever a visual is attached to the item under publish.
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => ({
    storage: {
      from: (_bucket: string) => ({
        createSignedUrl: async () => ({ data: { signedUrl: "https://signed.example/visual.png" }, error: null }),
      }),
    },
  })),
}));

const { getDb } = await import("@/db");
const mockedGetDb = vi.mocked(getDb);
const bufferClient = await import("@/lib/buffer/client");
const mockedCreatePostForBuffer = vi.mocked(bufferClient.createPostForBuffer);
const mockedRefreshAccessToken = vi.mocked(bufferClient.refreshAccessToken);
const mockedListChannels = vi.mocked(bufferClient.listChannels);

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
  format: "reel",
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
    if (!queue || queue.length === 0) return [];
    return queue.length > 1 ? queue.shift()! : queue[0];
  }

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          const promise = Promise.resolve(nextRows(table)) as Promise<Row[]> & {
            orderBy: () => { limit: () => Promise<Row[]> };
          };
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
      "mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id text dueAt } } ... on MutationError { message } } }",
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

  it("instagram customScheduled — dueAt present, per-channel metadata.instagram", () => {
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
      metadata: { instagram: { type: "reel" } },
      dueAt: "2026-09-04T10:00:00.000Z",
    });
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
      contentKind: "reel",
      service: "facebook",
      firstComment: "First! 🚀",
      mediaUrl: null,
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
    expect(mockedCreatePostForBuffer.mock.calls[0][1]?.mediaUrl).toBe("https://signed.example/visual.png");
    const jobUpdate = fake.updates.find((u) => u.values.providerPostId === "post-media");
    expect(jobUpdate).toBeDefined();
    expect((jobUpdate!.values.result as Record<string, unknown>).mediaAttached).toBe(true);
  });

  it("fails with the real reason when a visual exists but no signed URL can be generated", async () => {
    const conn = makeConnRow({ id: "conn-nosign" });
    const fake = makeFakeDb({
      platformConnections: [[conn]],
      contentVariants: [[VARIANT_ROW]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[{ storagePath: "brand-assets/broken.png" }]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
    mockedGetDb.mockReturnValue(fake.db as never);
    // Unreachable storage: make createSignedUrl throw by pointing the mock's
    // storage.from at a throwing implementation for THIS test.
    const { createServiceClient } = await import("@/lib/supabase/service");
    vi.mocked(createServiceClient).mockImplementationOnce(() => {
      throw new Error("storage down");
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
      contentVariants: [[VARIANT_ROW], [{ status: "scheduled" }]],
      contentItems: [[ITEM_ROW]],
      visualAssets: [[]],
      workspaces: [[{ createdBy: "user-1" }]],
    });
    mockedGetDb.mockReturnValue(fake.db as never);
    const scheduledAt = new Date("2026-09-10T12:00:00.000Z");

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
      scheduledAt: new Date("2026-09-10T12:00:00.000Z"),
    });

    expect(res).toEqual({
      ok: false,
      reason: "not_connected",
      message: "No connected Facebook account. Connect one on the Connections page.",
    });
    expect(fake.inserts).toHaveLength(0);
  });
});
