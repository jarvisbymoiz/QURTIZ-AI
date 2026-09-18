"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSessionUser, resolveActionWorkspace } from "@/lib/workspace";
import { forgetAgentMemory, listAgentMemory, saveAgentMemory, saveAgentProfile } from "@/lib/ai/persistent-memory";
import { memoryInputSchema } from "@/lib/ai/memory-policy";

async function actor(expectedWorkspace: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Sign in to manage memory.");
  const workspaceId = await resolveActionWorkspace(user.id);
  if (!workspaceId || workspaceId !== expectedWorkspace) throw new Error("Workspace changed. Refresh before saving.");
  return { userId: user.id, workspaceId };
}

export async function manageAgentMemoryAction(workspaceId: string, operation: "save" | "delete", input: unknown) {
  try {
    const ctx = await actor(z.string().uuid().parse(workspaceId));
    if (operation === "save") {
      const id = z.object({ id: z.string().uuid().optional() }).parse(input).id;
      await saveAgentMemory(ctx, memoryInputSchema.parse(input), "manual", id);
    }
    else if (operation === "delete") {
      const parsed = z.object({ scope: z.enum(["user", "workspace"]), id: z.string().uuid() }).parse(input);
      const all = await listAgentMemory(ctx);
      const row = (parsed.scope === "user" ? all.personal : all.workspace).find(memory => memory.id === parsed.id);
      if (!row?.memoryKey) throw new Error("Memory not found.");
      await forgetAgentMemory(ctx, parsed.scope, row.memoryKey);
    } else throw new Error("Invalid operation.");
    revalidatePath("/settings"); revalidatePath("/brand-brain");
    return { ok: true as const };
  } catch (error) {
    console.error("[agent-memory] Management failed", { kind: error instanceof z.ZodError ? "validation" : "permission_or_database", workspaceId });
    return { ok: false as const, error: error instanceof z.ZodError ? "Check the memory fields." : "Could not save the change. Check your permissions and refresh if you switched workspace." };
  }
}

export async function updateAgentProfileAction(workspaceId: string, input: unknown) {
  try {
    const ctx = await actor(z.string().uuid().parse(workspaceId));
    const parsed = z.object({ operatingInstructions: z.string().max(1000), strategy: z.string().max(1000), workflow: z.string().max(1000), platforms: z.string().max(1000) }).parse(input);
    await saveAgentProfile(ctx, parsed);
    revalidatePath("/settings");
    return { ok: true as const };
  } catch { return { ok: false as const, error: "Could not save profile. Workspace admin permission is required; each section allows 1,000 characters." }; }
}
