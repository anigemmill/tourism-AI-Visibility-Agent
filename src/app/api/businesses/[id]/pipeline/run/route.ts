import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { crawlAndPersist } from "@/lib/crawler/run-crawl";
import { generateTravellerQueries } from "@/lib/queries/generate-queries";
import { runMonitoring } from "@/lib/monitoring/run-monitoring";
import { computeAndSaveVisibilitySnapshot } from "@/lib/scoring/visibility-score";
import { generateContentOpportunities, saveContentOpportunities } from "@/lib/opportunities/generate-opportunities";
import { runFactCheck, saveFactCheckIssues } from "@/lib/fact-check/fact-checker";
import { generateDailyDigest, saveDailyDigest } from "@/lib/digest/daily-digest";

/**
 * Runs the full pipeline end to end for a business: crawl (if never
 * crawled), generate traveller queries (if none exist), run AI monitoring,
 * recompute the visibility snapshot, generate content opportunities, run
 * the fact-checker, and build today's digest. Used by onboarding's "Run
 * first analysis" action and can be re-run daily.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await prisma.business.findUnique({ where: { id } });
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const steps: Record<string, unknown> = {};

  const existingCrawl = await prisma.crawlSnapshot.findFirst({ where: { businessId: id } });
  if (!existingCrawl) {
    steps.crawl = await crawlAndPersist(id);
  } else {
    steps.crawl = { skipped: true, reason: "already crawled" };
  }

  const existingQueryCount = await prisma.travellerQuery.count({ where: { businessId: id } });
  if (existingQueryCount === 0) {
    const experiences = await prisma.experience.findMany({ where: { businessId: id } });
    const generated = generateTravellerQueries({
      destination: business.destination,
      category: business.category,
      targetSegments: business.targetSegments,
      experienceNames: experiences.map((e) => e.name),
      businessName: business.name,
    });
    await prisma.travellerQuery.createMany({
      data: generated.map((q) => ({
        businessId: id,
        text: q.text,
        intent: q.intent,
        segment: q.segment,
        commercialIntent: q.commercialIntent,
      })),
    });
    steps.queries = { created: generated.length };
  } else {
    steps.queries = { skipped: true, existing: existingQueryCount };
  }

  steps.monitoring = await runMonitoring({ businessId: id });

  const snapshot = await computeAndSaveVisibilitySnapshot(id);
  steps.score = { componentCount: snapshot.components.length };

  const opportunityDrafts = await generateContentOpportunities(id);
  const createdOpportunities = await saveContentOpportunities(id, opportunityDrafts);
  steps.opportunities = { generated: opportunityDrafts.length, created: createdOpportunities.length };

  const factCheckDrafts = await runFactCheck(id);
  const createdIssues = await saveFactCheckIssues(id, factCheckDrafts);
  steps.factCheck = { found: factCheckDrafts.length, created: createdIssues.length };

  const digestContent = await generateDailyDigest(id);
  const digest = await saveDailyDigest(id, digestContent);
  steps.digest = { id: digest.id };

  return NextResponse.json({ steps });
}
