import "server-only";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { agentIdentities, brandMemory, userAgentMemories, workspaceAgentProfiles, workspaceMembers, workspaces } from "@/db/schema";
import { can } from "@/lib/permissions";
import { CORE_AGENT_IDENTITY, CORE_IDENTITY_VERSION } from "./identity";
import { memoryInputSchema, memoryKey, selectRelevantMemories, type MemoryInput } from "./memory-policy";

export type MemoryActor = { userId: string; workspaceId: string };
async function authorize(actor: MemoryActor, writeWorkspace = false, manage = false) {
  const [member] = await getDb().select({ role: workspaceMembers.role }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, actor.userId), eq(workspaceMembers.workspaceId, actor.workspaceId), isNull(workspaces.deletedAt)));
  if (!member || !can(member.role, manage ? "workspace:manage" : writeWorkspace ? "brand:write" : "brand:read")) throw new Error("Agent memory permission denied.");
}

export async function listAgentMemory(actor: MemoryActor) {
  await authorize(actor);
  const db = getDb();
  const [personal, workspace, profiles] = await Promise.all([
    db.select().from(userAgentMemories).where(and(eq(userAgentMemories.workspaceId, actor.workspaceId), eq(userAgentMemories.userId, actor.userId), eq(userAgentMemories.active, true))).orderBy(desc(userAgentMemories.updatedAt)),
    db.select().from(brandMemory).where(and(eq(brandMemory.workspaceId, actor.workspaceId), eq(brandMemory.active, true), isNull(brandMemory.deletedAt))).orderBy(desc(brandMemory.updatedAt)),
    db.select().from(workspaceAgentProfiles).where(eq(workspaceAgentProfiles.workspaceId, actor.workspaceId)),
  ]);
  return { personal, workspace, profile: profiles[0] ?? null };
}

export async function retrieveAgentMemory(actor: MemoryActor, task: string, includePersonal = true) {
  await authorize(actor);
  const db = getDb();
  // Rank in SQL first, bounded candidate set: avoid loading an unbounded memory history.
  const terms = (task.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).slice(0, 24).join(" OR ");
  const copy = /caption|post|content|write|create|generate|rewrite|tone|style/i.test(task);
  const work = /brand|post|content|caption|strategy|research|analytic|schedul|publish|visual|reel|carousel/i.test(task);
  const rank = (content: typeof brandMemory.content | typeof userAgentMemories.content, key: typeof brandMemory.memoryKey | typeof userAgentMemories.memoryKey, type: typeof brandMemory.type | typeof userAgentMemories.type) => sql`ts_rank(to_tsvector('simple', ${content}), websearch_to_tsquery('simple', ${terms})) + CASE WHEN ${work} AND ${type}='rule' OR ${key} LIKE 'response.%' OR ${key} IN ('copy.emojis','copy.tone') OR ${copy} AND (${key} LIKE 'copy.%' OR ${key} LIKE 'caption.%' OR ${key} LIKE '%.copy.%' OR ${key} LIKE '%.caption.%' OR ${content} ILIKE '%avoid%' OR ${content} ILIKE '%never%' OR ${content} ILIKE '%do not%') THEN 1 ELSE 0 END`;
  const [personal, workspace, profiles, identities] = await Promise.all([
    includePersonal ? db.select().from(userAgentMemories).where(and(eq(userAgentMemories.workspaceId, actor.workspaceId), eq(userAgentMemories.userId, actor.userId), eq(userAgentMemories.active, true)))
      .orderBy(desc(rank(userAgentMemories.content, userAgentMemories.memoryKey, userAgentMemories.type)), desc(userAgentMemories.updatedAt)).limit(100) : Promise.resolve([]),
    db.select().from(brandMemory).where(and(eq(brandMemory.workspaceId, actor.workspaceId), eq(brandMemory.active, true), isNull(brandMemory.deletedAt)))
      .orderBy(desc(rank(brandMemory.content, brandMemory.memoryKey, brandMemory.type)), desc(brandMemory.updatedAt)).limit(100),
    db.select().from(workspaceAgentProfiles).where(eq(workspaceAgentProfiles.workspaceId, actor.workspaceId)),
    db.select().from(agentIdentities).where(eq(agentIdentities.version, CORE_IDENTITY_VERSION)),
  ]);
  const profile = profiles[0];
  return {
    identity: identities[0]?.instructions ?? CORE_AGENT_IDENTITY,
    personal: selectRelevantMemories(personal, task, 1200).map(row => ({ key: row.memoryKey, content: row.content })),
    workspace: selectRelevantMemories(workspace, task, 1200, "workspace").map(row => ({ key: row.memoryKey, type: row.type, content: row.content })),
    profile: work && profile ? { operatingInstructions: profile.operatingInstructions, strategy: /strategy|post|content|research/i.test(task) ? profile.strategy : "",
      workflow: /schedul|publish|approv|create|post/i.test(task) ? profile.workflow : "", platforms: /post|content|schedul|publish/i.test(task) ? profile.platforms : "" } : null,
  };
}

export async function saveAgentMemory(actor: MemoryActor, raw: MemoryInput, source = "chat", replaceId?: string) {
  const input = memoryInputSchema.parse(raw);
  await authorize(actor, input.scope === "workspace");
  const key = memoryKey(input.content, input.key);
  return getDb().transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${actor.workspaceId + ":" + (input.scope === "user" ? actor.userId : "workspace")}, 0))`);
    if (input.scope === "user") {
      const where = and(eq(userAgentMemories.workspaceId, actor.workspaceId), eq(userAgentMemories.userId, actor.userId), or(eq(userAgentMemories.memoryKey, key), replaceId ? eq(userAgentMemories.id, replaceId) : undefined), eq(userAgentMemories.active, true));
      const matching = await tx.select().from(userAgentMemories).where(where);
      if (replaceId && !matching.some(row => row.id === replaceId)) throw new Error("Memory not found in your scope.");
      const previous = matching[0];
      if (previous?.content === input.content && previous.category === input.category && previous.type === input.type && previous.memoryKey === key && matching.length === 1) return { id: previous.id, key: previous.memoryKey, saved: true, changed: false };
      await tx.update(userAgentMemories).set({ active: false, supersededAt: new Date(), updatedAt: new Date() }).where(where);
      const [row] = await tx.insert(userAgentMemories).values({ workspaceId: actor.workspaceId, userId: actor.userId, memoryKey: key, category: input.category, type: input.type, content: input.content, source }).returning();
      return { id: row.id, key, saved: true, changed: true };
    }
    const active = await tx.select().from(brandMemory).where(and(eq(brandMemory.workspaceId, actor.workspaceId), eq(brandMemory.active, true), isNull(brandMemory.deletedAt))).orderBy(desc(brandMemory.updatedAt));
    // Legacy Brand Brain rows did not have semantic keys; match their canonical slots too.
    if (replaceId && !active.some(row => row.id === replaceId)) throw new Error("Memory not found in your scope.");
    const matching = active.filter(row => row.id === replaceId || row.memoryKey === key || memoryKey(row.content, row.memoryKey ?? undefined) === key || row.content.toLowerCase().trim() === input.content.toLowerCase().trim());
    const previous = matching[0];
    const where = and(eq(brandMemory.workspaceId, actor.workspaceId), inArray(brandMemory.id, matching.map(row => row.id)));
    if (previous?.content === input.content && previous.category === input.category && previous.type === input.type && previous.memoryKey === key && matching.length === 1) return { id: previous.id, key, saved: true, changed: false };
    await tx.update(brandMemory).set({ active: false, supersededAt: new Date(), updatedAt: new Date() }).where(where);
    const [row] = await tx.insert(brandMemory).values({ workspaceId: actor.workspaceId, createdBy: actor.userId, memoryKey: key, category: input.category, type: input.type, content: input.content, source }).returning();
    return { id: row.id, key, saved: true, changed: true };
  });
}

export async function forgetAgentMemory(actor: MemoryActor, scope: "user" | "workspace", key: string) {
  await authorize(actor, scope === "workspace");
  const db = getDb();
  const rows = scope === "user" ? await db.delete(userAgentMemories).where(and(eq(userAgentMemories.workspaceId, actor.workspaceId), eq(userAgentMemories.userId, actor.userId), eq(userAgentMemories.memoryKey, key))).returning({ id: userAgentMemories.id })
    : await db.delete(brandMemory).where(and(eq(brandMemory.workspaceId, actor.workspaceId), eq(brandMemory.memoryKey, key))).returning({ id: brandMemory.id });
  return { ok: true, removed: rows.length };
}

export async function saveAgentProfile(actor: MemoryActor, input: { operatingInstructions: string; strategy: string; workflow: string; platforms: string }) {
  await authorize(actor, false, true);
  if (Object.values(input).some(value => value.length > 1000)) throw new Error("Each profile section must be at most 1,000 characters.");
  const values = { ...input, workspaceId: actor.workspaceId, updatedBy: actor.userId, updatedAt: new Date() };
  await getDb().insert(workspaceAgentProfiles).values(values).onConflictDoUpdate({ target: workspaceAgentProfiles.workspaceId, set: values });
}
