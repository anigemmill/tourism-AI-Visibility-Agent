import { prisma } from "@/lib/db";

export interface CompetitorQueryGap {
  queryId: string;
  queryText: string;
  competitorPosition: number | null;
}

export interface CompetitorComparison {
  competitorName: string;
  competitorWebsite: string | null;
  queriesCompetitorOwns: CompetitorQueryGap[]; // competitor appears, business does not
  queriesBothAppear: CompetitorQueryGap[];
  queriesBusinessOwns: CompetitorQueryGap[]; // business appears, competitor does not
  totalQueriesCompared: number;
  likelyReasons: string[];
  headline: string;
}

export interface CompetitorIntelligenceResult {
  comparisons: CompetitorComparison[];
  topicsAtRisk: string[]; // queries where every tracked competitor appears and the business does not
}

/**
 * Compares a business against each tracked competitor using the same
 * monitored discovery results: for every query, did the competitor's name
 * turn up in the AI response, did the business's, both, or neither. Gaps
 * ("competitor appears, business doesn't") are the actionable signal.
 * Reasons are inferred only from the business's own, verifiable content
 * gaps — never from claims about what the competitor has, since we don't
 * crawl competitor sites in this build.
 */
export async function analyzeCompetitors(businessId: string): Promise<CompetitorIntelligenceResult> {
  const [business, results, faqs, policies] = await Promise.all([
    prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      include: { competitorLinks: true },
    }),
    prisma.discoveryResult.findMany({
      where: { businessId },
      include: { query: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.faq.findMany({ where: { businessId } }),
    prisma.policy.findMany({ where: { businessId } }),
  ]);

  // Keep only the most recent result per query to avoid double-counting reruns.
  const latestPerQuery = new Map<string, (typeof results)[number]>();
  for (const r of results) {
    if (!latestPerQuery.has(r.queryId)) latestPerQuery.set(r.queryId, r);
  }
  const latestResults = [...latestPerQuery.values()];

  const comparisons: CompetitorComparison[] = business.competitorLinks.map((link) => {
    const owns: CompetitorQueryGap[] = [];
    const both: CompetitorQueryGap[] = [];
    const businessOwns: CompetitorQueryGap[] = [];

    for (const r of latestResults) {
      const mentioned = (r.competitorsMentioned as { name: string; position: number }[] | null) ?? [];
      const competitorEntry = mentioned.find((m) => m.name === link.competitorName);
      const competitorAppears = Boolean(competitorEntry);

      if (competitorAppears && !r.businessAppears) {
        owns.push({ queryId: r.queryId, queryText: r.query.text, competitorPosition: competitorEntry?.position ?? null });
      } else if (competitorAppears && r.businessAppears) {
        both.push({ queryId: r.queryId, queryText: r.query.text, competitorPosition: competitorEntry?.position ?? null });
      } else if (!competitorAppears && r.businessAppears) {
        businessOwns.push({ queryId: r.queryId, queryText: r.query.text, competitorPosition: null });
      }
    }

    const likelyReasons = buildLikelyReasons(owns, faqs, policies);

    return {
      competitorName: link.competitorName,
      competitorWebsite: link.competitorWebsite ?? null,
      queriesCompetitorOwns: owns,
      queriesBothAppear: both,
      queriesBusinessOwns: businessOwns,
      totalQueriesCompared: latestResults.length,
      likelyReasons,
      headline: `${link.competitorName} appears in ${owns.length} relevant AI discovery ${owns.length === 1 ? "query" : "queries"} where ${business.name} does not.`,
    };
  });

  // Topics at risk: queries where the business is absent and at least one competitor appears, across all competitors.
  const atRiskQueryTexts = new Set<string>();
  for (const comparison of comparisons) {
    for (const gap of comparison.queriesCompetitorOwns) atRiskQueryTexts.add(gap.queryText);
  }

  return { comparisons, topicsAtRisk: [...atRiskQueryTexts] };
}

function buildLikelyReasons(
  gaps: CompetitorQueryGap[],
  faqs: { question: string }[],
  policies: { type: string }[]
): string[] {
  if (gaps.length === 0) return [];
  const reasons: string[] = [];

  const gapKeywords = gaps.map((g) => g.queryText.toLowerCase());
  const mentionsPrice = gapKeywords.some((t) => /price|cost|how much/.test(t));
  const mentionsFamily = gapKeywords.some((t) => /famil/.test(t));
  const mentionsLuxury = gapKeywords.some((t) => /luxury|premium/.test(t));
  const mentionsBooking = gapKeywords.some((t) => /book/.test(t));

  if (mentionsPrice && !policies.some((p) => p.type === "pricing")) {
    reasons.push("No clear pricing information found in the knowledge profile — AI systems may be citing competitors instead simply because their pricing is easier to find.");
  }
  if (mentionsFamily && !faqs.some((f) => /famil/i.test(f.question))) {
    reasons.push("No FAQ or content specifically addressing family travellers was found — content targeted at this segment may be thin relative to competitors.");
  }
  if (mentionsLuxury) {
    reasons.push("These queries target a premium/luxury framing — check whether the site's positioning and differentiators emphasize this segment clearly enough for AI systems to pick up on.");
  }
  if (mentionsBooking && !faqs.some((f) => /book/i.test(f.question))) {
    reasons.push("No FAQ covering the booking process was found — a clear, crawlable booking path is a strong signal AI systems use when recommending where to book.");
  }
  if (reasons.length === 0) {
    reasons.push(
      "No specific content gap was detected for these topics — the gap may be driven by third-party authority (reviews, citations) rather than on-site content. Check the Reputation and Content Opportunities tabs."
    );
  }
  return reasons;
}
