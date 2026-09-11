import "server-only";

import crypto from "node:crypto";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { platformConnections, workspaceAiConfig } from "@/db/schema";
import {
  decryptToken,
  decryptWithKey,
  encryptToken,
  getEncryptionKey,
} from "@/lib/crypto/tokens";

/**
 * One-time migration for credentials written under the REMOVED deterministic
 * dev fallback key. The fallback is gone (getEncryptionKey now throws in every
 * environment), so any surviving dev-key ciphertext — encrypted AI keys and
 * platform tokens — would be unreadable without this pass. It runs once at
 * server boot from instrumentation.ts.
 *
 * Legacy key is used for DECRYPT ONLY; everything rewritten is re-encrypted
 * with the real ENCRYPTION_KEY.
 */

/** Cap the boot-time scan so a large table can never delay startup. */
const MIGRATION_ROW_LIMIT = 500;

export interface LegacyMigrationSummary {
  /** Legacy ciphertext re-encrypted with the current key. */
  migrated: number;
  /** Already readable with the current key — left byte-for-byte untouched. */
  alreadyCurrent: number;
  /** Undecryptable with either key — left untouched, reported, never logged. */
  unrecoverable: number;
}

/**
 * EXACT legacy key derivation, byte-identical to the dev fallback that used to
 * live in lib/crypto/tokens (note the `?? "no-db"` default — an unset
 * DATABASE_URL hashed the same string at write time). Kept solely to read old
 * ciphertext; never used to encrypt.
 */
export function legacyEncryptionKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update(`qurtiz-dev::${process.env.DATABASE_URL ?? "no-db"}`)
    .digest();
}

/** Decrypt a value that may predate the real ENCRYPTION_KEY. Null if not. */
export function legacyDecryptToken(payload: string): string | null {
  return decryptWithKey(payload, legacyEncryptionKey());
}

/**
 * Classify + migrate one ciphertext. Never throws: a per-value failure (bad
 * payload, failed UPDATE) is counted unrecoverable and the run continues.
 * Deliberately silent — logging the value would leak credential material.
 */
async function migrateValue(
  value: string,
  rewrite: (ciphertext: string) => Promise<void>,
  summary: LegacyMigrationSummary,
): Promise<void> {
  try {
    if (decryptToken(value) !== null) {
      summary.alreadyCurrent += 1;
      return;
    }
    const plaintext = legacyDecryptToken(value);
    if (plaintext === null) {
      summary.unrecoverable += 1;
      return;
    }
    await rewrite(encryptToken(plaintext));
    summary.migrated += 1;
  } catch {
    summary.unrecoverable += 1;
  }
}

/**
 * Re-encrypt every dev-key credential in `workspace_ai_config` and
 * `platform_connections` with the current ENCRYPTION_KEY. Bounded (≤ 500 rows
 * per table per run), idempotent (already-current values are skipped with no
 * rewrite), and safe to call on every boot. Emits exactly one summary line;
 * a rejection means the scan itself could not run (missing key, DB down) and
 * is handled by the boot caller — individual rows never throw.
 */
export async function migrateLegacyEncryptedCredentials(): Promise<LegacyMigrationSummary> {
  // Fail fast with a clear, actionable error rather than counting every row
  // unrecoverable because decryptToken cannot resolve the key.
  getEncryptionKey();

  const summary: LegacyMigrationSummary = {
    migrated: 0,
    alreadyCurrent: 0,
    unrecoverable: 0,
  };
  const db = getDb();

  const aiConfigRows = await db
    .select({
      workspaceId: workspaceAiConfig.workspaceId,
      textApiKeyEnc: workspaceAiConfig.textApiKeyEnc,
      imageApiKeyEnc: workspaceAiConfig.imageApiKeyEnc,
    })
    .from(workspaceAiConfig)
    .limit(MIGRATION_ROW_LIMIT);

  for (const row of aiConfigRows) {
    await migrateValue(
      row.textApiKeyEnc,
      async (ciphertext) => {
        await db
          .update(workspaceAiConfig)
          .set({ textApiKeyEnc: ciphertext })
          .where(eq(workspaceAiConfig.workspaceId, row.workspaceId));
      },
      summary,
    );
    await migrateValue(
      row.imageApiKeyEnc,
      async (ciphertext) => {
        await db
          .update(workspaceAiConfig)
          .set({ imageApiKeyEnc: ciphertext })
          .where(eq(workspaceAiConfig.workspaceId, row.workspaceId));
      },
      summary,
    );
  }

  const connectionRows = await db
    .select({
      id: platformConnections.id,
      encryptedToken: platformConnections.encryptedToken,
    })
    .from(platformConnections)
    .where(
      and(
        isNotNull(platformConnections.encryptedToken),
        ne(platformConnections.encryptedToken, ""),
      ),
    )
    .limit(MIGRATION_ROW_LIMIT);

  for (const row of connectionRows) {
    if (!row.encryptedToken) continue;
    await migrateValue(
      row.encryptedToken,
      async (ciphertext) => {
        await db
          .update(platformConnections)
          .set({ encryptedToken: ciphertext })
          .where(eq(platformConnections.id, row.id));
      },
      summary,
    );
  }

  console.log(
    `[qurtiz] encryption: migrated ${summary.migrated} legacy credential(s), ` +
      `${summary.alreadyCurrent} already current, ${summary.unrecoverable} unrecoverable`,
  );
  return summary;
}
