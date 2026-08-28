import { NextResponse, type NextRequest } from "next/server";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentRuns, brandMemory, brands } from "@/db/schema";
import { buildAgentTools, summarizeBrandBrain } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/agent";
import { estimateCostFromUsage, getModel, getModelId } from "@/lib/ai/provider";
import { can } from "@/lib/permissions";
import { cookies } from "next/headers";
import { and, desc } from "drizzle-orm";
import { getMembership, getSessionUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const MAX_RECENT_MESSAGES = 24;

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { messages?: UIMessage[]; workspaceId?: string }
    | null;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const workspaceId = body.workspaceId ?? cookieStore.get("qurtiz_workspace")?.value;
  if (!workspaceId) {
    return NextResponse.json({ error: "NO_ACTIVE_WORKSPACE" }, { status: 400 });
  }

  const membership = await getMembership(user.id, workspaceId);
  if (!membership || !can(membership.role, "chat:use")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const model = getModel();
  if (!model) {
    return NextResponse.json({ error: "CONFIGURATION_REQUIRED" }, { status: 503 });
  }

  const db = getDb();
  const [brandRow] = await db.select().from(brands).where(eq(brands.workspaceId, workspaceId));
  const memories = await db
    .select()
    .from(brandMemory)
    .where(and(eq(brandMemory.workspaceId, workspaceId), eq(brandMemory.active, true)))
    .orderBy(desc(brandMemory.createdAt))
    .limit(60);

  const [run] = await db
    .insert(agentRuns)
    .values({ workspaceId, userId: user.id, kind: "chat", model: getModelId() })
    .returning();

  const system = buildSystemPrompt({
    brandSummary: summarizeBrandBrain(brandRow ?? null),
    memories,
    workspaceName: brandRow?.businessName ?? workspaceId,
  });

  // Attachment validation: images + PDF only, sane size caps.
  const ALLOWED_MEDIA = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
  const MAX_PART_CHARS = 12_000_000; // ~9MB binary per part when base64
  let totalChars = 0;
  for (const msg of body.messages) {
    for (const part of msg.parts ?? []) {
      if (part.type === "file") {
        const fp = part as { mediaType?: string; url?: string };
        if (!fp.mediaType || !ALLOWED_MEDIA.has(fp.mediaType)) {
          return NextResponse.json({ error: "UNSUPPORTED_FILE", message: "Only PNG, JPEG, WebP images and PDF files are supported." }, { status: 400 });
        }
        totalChars += (fp.url ?? "").length;
        if ((fp.url ?? "").length > MAX_PART_CHARS) {
          return NextResponse.json({ error: "FILE_TOO_LARGE", message: "Each attachment must be under 9MB." }, { status: 400 });
        }
      }
    }
  }
  if (totalChars > 30_000_000) {
    return NextResponse.json({ error: "TOO_MANY_ATTACHMENTS", message: "Total attachments exceed 22MB." }, { status: 400 });
  }

  const recent = body.messages.slice(-MAX_RECENT_MESSAGES);

  try {
    const result = streamText({
      model,
      system,
      messages: convertToModelMessages(recent),
      tools: buildAgentTools({ workspaceId, userId: user.id, runId: run.id }),
      stopWhen: stepCountIs(6),
      providerOptions: {
        google: { thinkingConfig: { includeThoughts: true } },
      },
      onFinish: async ({ usage, finishReason }) => {
        try {
          const failed = finishReason === "error";
          await db
            .update(agentRuns)
            .set({
              status: failed ? "failed" : "completed",
              inputTokens: usage?.inputTokens ?? null,
              outputTokens: usage?.outputTokens ?? null,
              costUsd: usage
                ? estimateCostFromUsage(getModelId(), usage).toFixed(6)
                : null,
              finishedAt: new Date(),
              error: failed ? "Generation failed (finishReason=error)" : null,
            })
            .where(eq(agentRuns.id, run.id));
        } catch {
          // Never let run bookkeeping break the response.
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider error";
    try {
      await db
        .update(agentRuns)
        .set({ status: "failed", error: message, finishedAt: new Date() })
        .where(eq(agentRuns.id, run.id));
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "AI_PROVIDER_ERROR", message }, { status: 502 });
  }
}
