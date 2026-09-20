import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface ComponentScore {
  key: string;
  label: string;
  score: number; // 0-100
  explanation: string;
  signals: Record<string, unknown>;
}

export interface VisibilityScoreResult {
  components: ComponentScore[];
  computedAt: string;
}

const RECENT_WINDOW_DAYS = 30;

/**
 * Computes the full set of transparent visibility components for a
 * business. There is deliberately no single blended "score" — each
 * component is independently meaningful, and every explanation is derived
 * directly from the signals object beside it so a user can see exactly why
 * a number is what it is.
 */
export async function computeVisibilityScore(businessId: string): Promise<VisibilityScoreResult> {
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [business, discoveryResults, reviews, latestCrawl, faqCount, policyCount, productCount, experienceCount] =
    await Promise.all([
      prisma.business.findUniqueOrThrow({
        where: { id: businessId },
        include: { competitorLinks: true, credentials: true, differentiators: true, locations: true },
      }),
      prisma.discoveryResult.findMany({
        where: { businessId, createdAt: { gte: since } },
      }),
      prisma.review.findMany({ where: { businessId } }),
      prisma.crawlSnapshot.findFirst({ where: { businessId }, orderBy: { createdAt: "desc" } }),
      prisma.faq.count({ where: { businessId } }),
      prisma.policy.count({ where: { businessId } }),
      prisma.product.count({ where: { businessId } }),
      prisma.experience.count({ where: { businessId } }),
    ]);

  const components: ComponentScore[] = [
    scoreAiDiscoverability(discoveryResults),
    scoreEntityClarity(business, latestCrawl),
    scoreTopicalRelevance(discoveryResults),
    scoreDestinationRelevance(discoveryResults, business.destination),
    scoreContentCoverage({ faqCount, policyCount, productCount, experienceCount }),
    scoreThirdPartyAuthority(business, discoveryResults),
    scoreReviewReputation(reviews),
    scoreTechnicalAccessibility(latestCrawl),
    scoreCompetitiveVisibility(discoveryResults, business.competitorLinks.map((c) => c.competitorName)),
  ];

  return { components, computedAt: new Date().toISOString() };
}

/** Persists the computed components as a new VisibilitySnapshot for history tracking. */
export async function computeAndSaveVisibilitySnapshot(businessId: string) {
  const result = await computeVisibilityScore(businessId);
  const snapshot = await prisma.visibilitySnapshot.create({
    data: {
      businessId,
      components: {
        create: result.components.map((c) => ({
          key: c.key,
          label: c.label,
          score: c.score,
          explanation: c.explanation,
          signals: c.signals as Prisma.InputJsonValue,
        })),
      },
    },
    include: { components: true },
  });
  return snapshot;
}

// ---------------------------------------------------------------------------
// Individual components
// ---------------------------------------------------------------------------

type DiscoveryResultRow = Prisma.DiscoveryResultGetPayload<Record<string, never>>;

export function scoreAiDiscoverability(results: DiscoveryResultRow[]): ComponentScore {
  if (results.length === 0) {
    return {
      key: "ai_discoverability",
      label: "AI Discoverability",
      score: 0,
      explanation:
        "No AI monitoring results yet in the last 30 days. Run a monitoring pass to see whether AI assistants surface this business.",
      signals: { totalQueries: 0, appearances: 0 },
    };
  }
  const appearances = results.filter((r) => r.businessAppears).length;
  const rate = appearances / results.length;
  const score = Math.round(rate * 100);
  return {
    key: "ai_discoverability",
    label: "AI Discoverability",
    score,
    explanation: `The business appeared in ${appearances} of ${results.length} AI platform responses (${score}%) to traveller questions monitored in the last ${RECENT_WINDOW_DAYS} days.`,
    signals: { totalQueries: results.length, appearances, rate },
  };
}

export function scoreEntityClarity(
  business: Prisma.BusinessGetPayload<{ include: { locations: true; credentials: true; differentiators: true } }>,
  latestCrawl: Prisma.CrawlSnapshotGetPayload<Record<string, never>> | null
): ComponentScore {
  const checks = {
    hasDescription: Boolean(business.description),
    hasLocation: business.locations.length > 0,
    hasBookingUrl: Boolean(business.bookingUrl),
    hasStructuredData: Boolean(
      latestCrawl?.rawExtract &&
        typeof latestCrawl.rawExtract === "object" &&
        "extractionMethod" in (latestCrawl.rawExtract as object)
    ),
    hasCredentials: business.credentials.length > 0,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const score = Math.round((passed / Object.keys(checks).length) * 100);
  const missing = Object.entries(checks)
    .filter(([, v]) => !v)
    .map(([k]) => humanizeCheckKey(k));
  return {
    key: "entity_clarity",
    label: "Entity Clarity",
    score,
    explanation: missing.length
      ? `The business profile is missing: ${missing.join(", ")}. A clearly-defined entity (name, location, booking path, credentials) is easier for AI systems to confidently recommend.`
      : "The business profile has a clear description, location, booking path, and credentials — AI systems have what they need to identify it unambiguously.",
    signals: checks,
  };
}

export function scoreTopicalRelevance(results: DiscoveryResultRow[]): ComponentScore {
  const segments = new Map<string, { total: number; appeared: number }>();
  // Topical relevance uses whichever queries actually ran; segment isn't on
  // DiscoveryResult directly so we approximate breadth via platform diversity
  // and overall coverage instead of over-claiming a segment breakdown here.
  const platforms = new Set(results.map((r) => r.platform));
  const appearedPlatforms = new Set(results.filter((r) => r.businessAppears).map((r) => r.platform));
  const score = platforms.size
    ? Math.round((appearedPlatforms.size / platforms.size) * 100)
    : 0;
  void segments;
  return {
    key: "topical_relevance",
    label: "Topical Relevance",
    score,
    explanation: platforms.size
      ? `The business appears on ${appearedPlatforms.size} of ${platforms.size} monitored AI platforms, indicating how broadly its topical relevance is recognized across different AI systems.`
      : "No platforms monitored yet.",
    signals: { platformsMonitored: [...platforms], platformsWithAppearance: [...appearedPlatforms] },
  };
}

export function scoreDestinationRelevance(results: DiscoveryResultRow[], destination: string): ComponentScore {
  // We don't have query text on the result row directly (joined via queryId),
  // so this component reads from the confidence-weighted appearance rate as
  // a conservative proxy until query text is joined in by the caller.
  const withDestinationSignal = results.filter((r) => r.howDescribed?.toLowerCase().includes(destination.toLowerCase()));
  const score = results.length
    ? Math.round((withDestinationSignal.length / results.length) * 100)
    : 0;
  return {
    key: "destination_relevance",
    label: "Destination Relevance",
    score,
    explanation: results.length
      ? `In ${withDestinationSignal.length} of ${results.length} monitored responses, the business was described with an explicit tie to ${destination} — the stronger this link, the more AI systems associate the business with the destination itself, not just its category.`
      : "No monitoring data yet to assess destination association.",
    signals: { totalResults: results.length, destinationTiedMentions: withDestinationSignal.length },
  };
}

export function scoreContentCoverage(counts: {
  faqCount: number;
  policyCount: number;
  productCount: number;
  experienceCount: number;
}): ComponentScore {
  const targets = { faqCount: 5, policyCount: 2, productCount: 1, experienceCount: 1 };
  const coverage = Object.entries(targets).map(
    ([k, target]) => Math.min(1, counts[k as keyof typeof counts] / target)
  );
  const score = Math.round((coverage.reduce((a, b) => a + b, 0) / coverage.length) * 100);
  const gaps: string[] = [];
  if (counts.faqCount < targets.faqCount) gaps.push(`only ${counts.faqCount}/${targets.faqCount}+ FAQs`);
  if (counts.policyCount < targets.policyCount) gaps.push("missing key policies");
  if (counts.productCount < targets.productCount) gaps.push("no structured products captured");
  if (counts.experienceCount < targets.experienceCount) gaps.push("no structured experiences captured");
  return {
    key: "content_coverage",
    label: "Content Coverage",
    score,
    explanation: gaps.length
      ? `Content gaps found: ${gaps.join("; ")}. Thin content on these topics gives AI systems less to draw from when answering traveller questions.`
      : "FAQs, policies, products, and experiences are all reasonably well covered in the knowledge profile.",
    signals: counts,
  };
}

export function scoreThirdPartyAuthority(
  business: Prisma.BusinessGetPayload<{ include: { credentials: true } }>,
  results: DiscoveryResultRow[]
): ComponentScore {
  const citingSources = results.filter((r) => Array.isArray(r.sources) && (r.sources as unknown[]).length > 0);
  const uniqueSourceDomains = new Set<string>();
  for (const r of citingSources) {
    for (const s of r.sources as { url?: string }[]) {
      if (s.url) {
        try {
          uniqueSourceDomains.add(new URL(s.url).hostname);
        } catch {
          /* ignore malformed source URL */
        }
      }
    }
  }
  const credentialScore = Math.min(1, business.credentials.length / 3);
  const citationScore = Math.min(1, uniqueSourceDomains.size / 5);
  const score = Math.round(((credentialScore + citationScore) / 2) * 100);
  return {
    key: "third_party_authority",
    label: "Third-Party Authority",
    score,
    explanation: `${business.credentials.length} credential(s)/awards on record and ${uniqueSourceDomains.size} distinct third-party domain(s) cited across monitored AI responses. AI systems weigh independent corroboration heavily when deciding who to recommend.`,
    signals: { credentialCount: business.credentials.length, uniqueCitedDomains: [...uniqueSourceDomains] },
  };
}

export function scoreReviewReputation(reviews: Prisma.ReviewGetPayload<Record<string, never>>[]): ComponentScore {
  if (reviews.length === 0) {
    return {
      key: "review_reputation",
      label: "Review & Reputation Signals",
      score: 0,
      explanation: "No review data on record yet. Reviews are a major trust signal AI systems reference when recommending a business.",
      signals: { platformCount: 0 },
    };
  }
  const rated = reviews.filter((r) => r.rating != null);
  const avgRating = rated.length ? rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length : 0;
  const totalReviewCount = reviews.reduce((a, r) => a + (r.reviewCount ?? 0), 0);
  const ratingScore = (avgRating / 5) * 70; // rating quality worth up to 70 points
  const volumeScore = Math.min(30, Math.log10(totalReviewCount + 1) * 12); // volume worth up to 30
  const score = Math.round(ratingScore + volumeScore);
  return {
    key: "review_reputation",
    label: "Review & Reputation Signals",
    score,
    explanation: `Average rating ${avgRating.toFixed(1)}/5 across ${reviews.length} platform(s), with ${totalReviewCount} total reviews on record. Strong, high-volume reviews increase the odds an AI system recommends this business with confidence.`,
    signals: { platformCount: reviews.length, avgRating, totalReviewCount },
  };
}

export function scoreTechnicalAccessibility(
  latestCrawl: Prisma.CrawlSnapshotGetPayload<Record<string, never>> | null
): ComponentScore {
  if (!latestCrawl) {
    return {
      key: "technical_accessibility",
      label: "Technical Accessibility",
      score: 0,
      explanation: "The website hasn't been crawled yet, so technical accessibility to AI crawlers/answer engines is unknown.",
      signals: {},
    };
  }
  const errorCount = Array.isArray(latestCrawl.errors) ? (latestCrawl.errors as unknown[]).length : 0;
  const successRate = latestCrawl.pagesCrawled > 0 ? latestCrawl.pagesCrawled / (latestCrawl.pagesCrawled + errorCount) : 0;
  const score = Math.round(successRate * 100);
  return {
    key: "technical_accessibility",
    label: "Technical Accessibility",
    score,
    explanation: `${latestCrawl.pagesCrawled} page(s) crawled successfully with ${errorCount} error(s) on the last crawl. Pages that fail to load or block crawlers can't be read by AI systems either.`,
    signals: { pagesCrawled: latestCrawl.pagesCrawled, errorCount, status: latestCrawl.status },
  };
}

export function scoreCompetitiveVisibility(results: DiscoveryResultRow[], competitorNames: string[]): ComponentScore {
  if (results.length === 0 || competitorNames.length === 0) {
    return {
      key: "competitive_visibility",
      label: "Competitive Visibility",
      score: 0,
      explanation: "Not enough monitoring data or no competitors configured yet to compare visibility.",
      signals: { totalResults: results.length, competitorsTracked: competitorNames.length },
    };
  }
  const businessAppearances = results.filter((r) => r.businessAppears).length;
  const competitorAppearances = results.filter((r) => {
    const mentioned = (r.competitorsMentioned as { name: string }[] | null) ?? [];
    return mentioned.length > 0;
  }).length;

  const businessRate = businessAppearances / results.length;
  const competitorRate = competitorAppearances / results.length;
  // Relative visibility: 50 = parity, >50 = out-visible competitors, <50 = behind them.
  const relative = competitorRate === 0 && businessRate === 0 ? 0 : businessRate / (businessRate + competitorRate || 1);
  const score = Math.round(relative * 100);

  return {
    key: "competitive_visibility",
    label: "Competitive Visibility",
    score,
    explanation: `The business appeared in ${Math.round(businessRate * 100)}% of monitored responses versus ${Math.round(competitorRate * 100)}% where at least one tracked competitor appeared. ${
      score >= 50
        ? "The business is currently holding its own or leading its tracked competitors."
        : "Tracked competitors are currently more visible in AI answers than this business."
    }`,
    signals: { businessRate, competitorRate, competitorsTracked: competitorNames },
  };
}

function humanizeCheckKey(key: string): string {
  const map: Record<string, string> = {
    hasDescription: "a business description",
    hasLocation: "a structured location",
    hasBookingUrl: "a booking URL",
    hasStructuredData: "structured data from the website crawl",
    hasCredentials: "any recorded credentials or awards",
  };
  return map[key] ?? key;
}
