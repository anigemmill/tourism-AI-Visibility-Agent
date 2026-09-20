import { prisma } from "@/lib/db";
import { getReviewConnectors } from "./registry";

export interface SyncReviewsSummary {
  updated: number;
  demoPlatforms: string[];
  errors: { platform: string; error: string }[];
}

/**
 * Pulls current ratings/review counts from each configured review platform
 * and upserts one Review row per (business, platform) — a snapshot, not an
 * accumulating log. Platforms without an API key fall back to the same
 * demo-mode contract as the AI connectors: clearly labeled, never presented
 * as a real rating.
 */
export async function syncReviews(businessId: string): Promise<SyncReviewsSummary> {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const connectors = getReviewConnectors();

  let updated = 0;
  const demoPlatforms: string[] = [];
  const errors: { platform: string; error: string }[] = [];

  for (const connector of connectors) {
    const result = await connector.fetch({
      businessName: business.name,
      destination: business.destination,
      website: business.website,
    });

    if (result.isDemoData) demoPlatforms.push(result.platform);

    if (result.error || result.rating === null) {
      if (result.error) errors.push({ platform: result.platform, error: result.error });
      continue;
    }

    await prisma.review.upsert({
      where: { businessId_platform: { businessId, platform: result.platform } },
      create: {
        businessId,
        platform: result.platform,
        isDemoData: result.isDemoData,
        rating: result.rating,
        reviewCount: result.reviewCount,
        sourceUrl: result.sourceUrl,
      },
      update: {
        isDemoData: result.isDemoData,
        rating: result.rating,
        reviewCount: result.reviewCount,
        sourceUrl: result.sourceUrl,
        fetchedAt: new Date(),
      },
    });
    updated++;
  }

  return { updated, demoPlatforms, errors };
}
