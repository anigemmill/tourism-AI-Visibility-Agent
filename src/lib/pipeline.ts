import { prisma } from "@/lib/db";
import { crawlAndPersist } from "@/lib/crawler/run-crawl";
import { generateTravellerQueries } from "@/lib/queries/generate-queries";
import { runMonitoring } from "@/lib/monitoring/run-monitoring";
import { syncReviews } from "@/lib/reviews/sync-reviews";
import { computeAndSaveVisibilitySnapshot } from "@/lib/scoring/visibility-score";
import { generateContentOpportunities, saveContentOpportunities } from "@/lib/opportunities/generate-opportunities";
import { runFactCheck, saveFactCheckIssues } from "@/lib/fact-check/fact-checker";
import { generateDailyDigest, saveDailyDigest } from "@/lib/digest/daily-digest";

/**
 * Runs the full pipeline end to end for a business: crawl (if never
 * crawled), generate traveller queries (if none exist), sync reviews, run
 * AI monitoring, recompute the visibility snapshot, generate content
 * opportunities, run the fact-checker, and build today's digest.
 *
 * Shared by the manual "Run full analysis" API route, onboarding's
 * first-run trigger, and the daily cron endpoint, so all three stay in
 * sync with one implementation. Monitoring's own cooldown/quota (see
 * lib/rate-limit) is what actually protects this from being run too often
 * or too expensively — this function itself has no throttling of its own.
 */
export async function runFullPipeline(businessId: string) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const steps: Record<string, unknown> = {};

  const existingCrawl = await prisma.crawlSnapshot.findFirst({ where: { businessId } });
  if (!existingCrawl) {
    steps.crawl = await crawlAndPersist(businessId);
  } else {
    steps.crawl = { skipped: true, reason: "already crawled" };
  }

  const existingQueryCount = await prisma.travellerQuery.count({ where: { businessId } });
  if (existingQueryCount === 0) {
    const experiences = await prisma.experience.findMany({ where: { businessId } });
    const generated = generateTravellerQueries({
      destination: business.destination,
      category: business.category,
      targetSegments: business.targetSegments,
      experienceNames: experiences.map((e) => e.name),
      businessName: business.name,
    });
    await prisma.travellerQuery.createMany({
      data: generated.map((q) => ({
        businessId,
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

  steps.reviews = await syncReviews(businessId);
  steps.monitoring = await runMonitoring({ businessId });

  const snapshot = await computeAndSaveVisibilitySnapshot(businessId);
  steps.score = { componentCount: snapshot.components.length };

  const opportunityDrafts = await generateContentOpportunities(businessId);
  const createdOpportunities = await saveContentOpportunities(businessId, opportunityDrafts);
  steps.opportunities = { generated: opportunityDrafts.length, created: createdOpportunities.length };

  const factCheckDrafts = await runFactCheck(businessId);
  const createdIssues = await saveFactCheckIssues(businessId, factCheckDrafts);
  steps.factCheck = { found: factCheckDrafts.length, created: createdIssues.length };

  const digestContent = await generateDailyDigest(businessId);
  const digest = await saveDailyDigest(businessId, digestContent);
  steps.digest = { id: digest.id };

  return steps;
}
