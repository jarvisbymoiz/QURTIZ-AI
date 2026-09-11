import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { createCipheriv, randomBytes } from "node:crypto";
import {
  legacyDecryptToken,
  migrateLegacyEncryptedCredentials,
} from "@/lib/crypto/key-migration";
import { workspaceAiConfig } from "@/db/schema";
import { decryptToken, encryptToken, getEncryptionKey } from "@/lib/crypto/tokens";

/**
 * DB stub mirroring the workspace-config.test.ts pattern: key-migration uses
 * drizzle chains - select().from().limit() / select().from().where().limit()
 * and update().set().where(). Updates are captured for assertions.
 */
const dbMock = vi.hoisted(() => {
  const state = {
    aiRows: [] as Record<string, unknown>[],
    connectionRows: [] as Record<string, unknown>[],
    updates: [] as { table: string; set: Record<string, unknown> }[],
  };
  const getDb = () => ({
    select: () => ({
      from: (table: unknown) => {
        const isAi = table === workspaceAiConfig;
        return {
          where: () => ({
            limit: async () => (isAi ? state.aiRows : state.connectionRows),
          }),
          limit: async () => state.aiRows,
        };
      },
    }),
    update: (table: unknown) => {
      const tableName = table === workspaceAiConfig ? "workspace_ai_config" : "platform_connections";
      return {
        set: (obj: Record<string, unknown>) => ({
          where: async () => {
            state.updates.push({ table: tableName, set: obj });
          },
        }),
      };
    },
  });
  return { getDb, state };
});

vi.mock("@/db", () => ({ getDb: dbMock.getDb }));

/** v1-format AES-256-GCM encrypt with an explicit key (mirrors encryptToken). */
function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return "v1." + iv.toString("base64") + "." + cipher.getAuthTag().toString("base64") + "." + enc.toString("base64");
}

/** The removed dev-fallback derivation - fixture key for legacy ciphertext. */
function legacyFixtureKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update("qurtiz-dev::" + (process.env.DATABASE_URL ?? "no-db"))
    .digest();
}

function makeAiRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    workspaceId: "00000000-0000-0000-0000-0000000000a1",
    textApiKeyEnc: "v1.x",
    imageApiKeyEnc: "v1.x",
    ...over,
  };
}

describe("legacy credential migration", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dbMock.state.aiRows = [];
    dbMock.state.connectionRows = [];
    dbMock.state.updates = [];
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("migrates legacy-encrypted AI keys to the current key, preserving plaintext", async () => {
    const legacyText = encryptWithKey("sk-text-legacy-123", legacyFixtureKey());
    const legacyImage = encryptWithKey("sk-image-legacy-456", legacyFixtureKey());
    dbMock.state.aiRows = [
      makeAiRow({ textApiKeyEnc: legacyText, imageApiKeyEnc: legacyImage }),
    ];

    const summary = await migrateLegacyEncryptedCredentials();

    expect(summary.migrated).toBe(2);
    expect(summary.alreadyCurrent).toBe(0);
    expect(summary.unrecoverable).toBe(0);
    expect(dbMock.state.updates).toHaveLength(2);
    // Plaintext survives; the new ciphertext no longer decrypts with the legacy key.
    const textUpdate = dbMock.state.updates.find((u) => u.set.textApiKeyEnc !== undefined);
    expect(decryptToken(String(textUpdate!.set.textApiKeyEnc))).toBe("sk-text-legacy-123");
    expect(legacyDecryptToken(String(textUpdate!.set.textApiKeyEnc))).toBeNull();
    const imageUpdate = dbMock.state.updates.find((u) => u.set.imageApiKeyEnc !== undefined);
    expect(decryptToken(String(imageUpdate!.set.imageApiKeyEnc))).toBe("sk-image-legacy-456");
  });

  it("migrates a legacy platform token envelope", async () => {
    const envelope = JSON.stringify({ accessToken: "buf-at", refreshToken: "buf-rt" });
    dbMock.state.connectionRows = [
      { id: "conn-1", encryptedToken: encryptWithKey(envelope, legacyFixtureKey()) },
    ];

    const summary = await migrateLegacyEncryptedCredentials();

    expect(summary.migrated).toBe(1);
    expect(dbMock.state.updates).toHaveLength(1);
    expect(dbMock.state.updates[0].table).toBe("platform_connections");
    expect(decryptToken(String(dbMock.state.updates[0].set.encryptedToken))).toBe(envelope);
  });

  it("skips values already encrypted with the current key (no rewrite)", async () => {
    const current = encryptToken("already-fresh-key");
    dbMock.state.aiRows = [makeAiRow({ textApiKeyEnc: current, imageApiKeyEnc: current })];

    const summary = await migrateLegacyEncryptedCredentials();

    expect(summary.alreadyCurrent).toBe(2);
    expect(summary.migrated).toBe(0);
    expect(dbMock.state.updates).toHaveLength(0);
  });

  it("counts corrupt values unrecoverable and leaves them untouched", async () => {
    dbMock.state.aiRows = [
      makeAiRow({ textApiKeyEnc: "v1.not-a-real-payload", imageApiKeyEnc: "garbage" }),
    ];

    const summary = await migrateLegacyEncryptedCredentials();

    expect(summary.unrecoverable).toBe(2);
    expect(summary.migrated).toBe(0);
    expect(dbMock.state.updates).toHaveLength(0);
    // Rows keep their original (broken) values.
    expect(dbMock.state.aiRows[0].textApiKeyEnc).toBe("v1.not-a-real-payload");
  });

  it("is idempotent: a second run over migrated rows migrates nothing", async () => {
    const legacy = encryptWithKey("sk-legacy", legacyFixtureKey());
    dbMock.state.aiRows = [makeAiRow({ textApiKeyEnc: legacy, imageApiKeyEnc: legacy })];

    const first = await migrateLegacyEncryptedCredentials();
    expect(first.migrated).toBe(2);

    // Apply the captured rewrites to the stub state, like the real DB would.
    for (const u of dbMock.state.updates) {
      const row = dbMock.state.aiRows[0];
      for (const [k, v] of Object.entries(u.set)) row[k] = v;
    }
    dbMock.state.updates = [];

    const second = await migrateLegacyEncryptedCredentials();
    expect(second.migrated).toBe(0);
    expect(second.alreadyCurrent).toBe(2);
    expect(dbMock.state.updates).toHaveLength(0);
  });

  it("handles a mixed batch with correct summary counts and a single sanitized line", async () => {
    dbMock.state.aiRows = [
      makeAiRow({
        textApiKeyEnc: encryptWithKey("legacy-one", legacyFixtureKey()),
        imageApiKeyEnc: encryptToken("current-one"),
      }),
    ];
    dbMock.state.connectionRows = [
      { id: "c1", encryptedToken: encryptWithKey("legacy-token", legacyFixtureKey()) },
      { id: "c2", encryptedToken: encryptToken("current-token") },
      { id: "c3", encryptedToken: "broken" },
    ];

    const summary = await migrateLegacyEncryptedCredentials();

    expect(summary.migrated).toBe(2);
    expect(summary.alreadyCurrent).toBe(2);
    expect(summary.unrecoverable).toBe(1);
    const lines = logSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((s) => s.includes("[qurtiz] encryption:"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/migrated 2 legacy credential\(s\), 2 already current, 1 unrecoverable/);
  });
});

describe("removed dev fallback (fail-fast key handling)", () => {
  const original = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.ENCRYPTION_KEY = original;
  });

  it("getEncryptionKey throws on a missing key (dev included)", () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => getEncryptionKey()).toThrow(/ENCRYPTION_KEY is missing or invalid/);
  });

  it("getEncryptionKey throws on an invalid (non-64-hex) key", () => {
    process.env.ENCRYPTION_KEY = "not-a-valid-key";
    expect(() => getEncryptionKey()).toThrow(/ENCRYPTION_KEY is missing or invalid/);
  });

  it("getEncryptionKey accepts a valid 64-hex key and decrypt round-trips", () => {
    process.env.ENCRYPTION_KEY = "ab".repeat(32);
    expect(getEncryptionKey()).toHaveLength(32);
    // Restore the suite key before using encryptToken (it reads the env).
    process.env.ENCRYPTION_KEY = original;
    expect(decryptToken(encryptToken("round-trip"))).toBe("round-trip");
  });

  it("legacyDecryptToken still reads a fixture encrypted with the old derivation", () => {
    const legacy = encryptWithKey("old-world-secret", legacyFixtureKey());
    expect(legacyDecryptToken(legacy)).toBe("old-world-secret");
    expect(decryptToken(legacy)).toBeNull();
  });
});


