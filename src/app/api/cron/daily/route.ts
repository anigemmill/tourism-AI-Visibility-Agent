import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runFullPipeline } from "@/lib/pipeline";

/**
 * Daily scheduled entry point: runs the full pipeline for every onboarded
 * business. Not covered by the session-auth middleware (it's meant to be
 * hit by a scheduler, not a signed-in user) — instead it requires a
 * bearer-token match against CRON_SECRET. See README "Scheduled runs" for
 * how to wire this up with Vercel Cron or a GitHub Actions schedule.
 *
 * Each business's pipeline run is isolated: one business's failure (e.g. a
 * dead website) is recorded and skipped rather than aborting the whole run.
 * Monitoring's own cooldown/quota (lib/rate-limit) still applies per
 * business, so a daily cron and a user mashing "Run full analysis" can't
 * combine to exceed the configured limits.
 */
export async function GET(req: NextRequest) {
  return handleCronRequest(req);
}

export async function POST(req: NextRequest) {
  return handleCronRequest(req);
}

async function handleCronRequest(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server." }, { status: 503 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
  const results: { businessId: string; name: string; ok: boolean; error?: string }[] = [];

  for (const business of businesses) {
    try {
      await runFullPipeline(business.id);
      results.push({ businessId: business.id, name: business.name, ok: true });
    } catch (err) {
      results.push({
        businessId: business.id,
        name: business.name,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    total: businesses.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
