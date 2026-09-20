import { NextResponse } from "next/server";
import { getActiveContext } from "@/lib/workspace";
import { researchUsageSummary, workspaceResearchPlan } from "@/lib/research/usage";
import { researchPlanLimits } from "@/lib/research/limits";
import { isBraveConfigured } from "@/lib/research/brave";

export const dynamic = "force-dynamic";

/**
 * GET /api/research/usage?days=30
 *
 * Per-workspace usage rollup of the SHARED Brave research integration:
 * attribution for analytics today, SaaS plan enforcement tomorrow.
 * Strictly workspace-scoped — no cross-tenant data can ever appear here.
 * Never exposes the Brave key or any provider credential.
 *
 * Response:  { configured, plan, limits, usage } where `configured` only
 * says whether the platform integration is enabled — boolean, no secret.
 */
export async function GET(request: Request) {
  const ctx = await getActiveContext("brand:read");
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? "30");

  try {
    const [usage, plan] = await Promise.all([
      researchUsageSummary(ctx.workspaceId, Number.isFinite(days) ? days : 30),
      workspaceResearchPlan(ctx.workspaceId),
    ]);
    return NextResponse.json({
      configured: isBraveConfigured(),
      plan,
      limits: researchPlanLimits(plan),
      usage,
    });
  } catch (error) {
    console.error("[research/usage]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load research usage." },
      { status: 500 },
    );
  }
}
