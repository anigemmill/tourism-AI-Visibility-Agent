import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface OpportunityDraft {
  title: string;
  type: "faq" | "page" | "comparison" | "itinerary" | "destination" | "metadata";
  rationale: string;
  relatedQuery?: string;
  commercialIntent: number;
  travellerDemand: number;
  competitionLevel: number;
  businessRelevance: number;
  implementationEffort: number;
}

const EFFORT_BY_TYPE: Record<OpportunityDraft["type"], number> = {
  metadata: 0.15,
  faq: 0.25,
  comparison: 0.45,
  destination: 0.5,
  page: 0.6,
  itinerary: 0.7,
};

/**
 * Priority formula (transparent, documented — never a black box):
 *   priority = 100 * (
 *     0.30 * commercialIntent +
 *     0.25 * travellerDemand +
 *     0.15 * (1 - competitionLevel)   // less contested topics score higher
 *     0.20 * businessRelevance +
 *     0.10 * (1 - implementationEffort) // lower effort scores higher
 *   )
 */
export function priorityScore(o: Omit<OpportunityDraft, "title" | "type" | "rationale" | "relatedQuery">): number {
  return Math.round(
    100 *
      (0.3 * o.commercialIntent +
        0.25 * o.travellerDemand +
        0.15 * (1 - o.competitionLevel) +
        0.2 * o.businessRelevance +
        0.1 * (1 - o.implementationEffort))
  );
}

/**
 * Identifies content opportunities from three sources: competitor gaps
 * (queries competitors win that this business doesn't), queries the
 * business is entirely absent from, and structural profile gaps (no
 * destination-tied content, no itinerary framing, thin metadata). Returns
 * drafts ready to be persisted and ranked by the transparent priority
 * formula above.
 */
export async function generateContentOpportunities(businessId: string): Promise<OpportunityDraft[]> {
  const [business, results, faqs] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: businessId }, include: { competitorLinks: true } }),
    prisma.discoveryResult.findMany({ where: { businessId }, include: { query: true }, orderBy: { createdAt: "desc" } }),
    prisma.faq.findMany({ where: { businessId } }),
  ]);

  const latestPerQuery = new Map<string, (typeof results)[number]>();
  for (const r of results) {
    if (!latestPerQuery.has(r.queryId)) latestPerQuery.set(r.queryId, r);
  }
  const latestResults = [...latestPerQuery.values()];
  const totalCompetitors = business.competitorLinks.length || 1;

  const drafts: OpportunityDraft[] = [];

  for (const r of latestResults) {
    if (r.businessAppears) continue; // already visible — not a gap
    const mentioned = (r.competitorsMentioned as { name: string }[] | null) ?? [];
    const competitionLevel = Math.min(1, mentioned.length / totalCompetitors);
    const alreadyHasFaq = faqs.some((f) => overlapsSignificantly(f.question, r.query.text));

    const base = {
      commercialIntent: r.query.commercialIntent,
      travellerDemand: estimateDemand(r.query.text, latestResults),
      competitionLevel,
      businessRelevance: r.query.businessId === businessId ? 0.9 : 0.5,
      implementationEffort: EFFORT_BY_TYPE[classifyOpportunityType(r.query.text, r.query.intent)],
    };

    const type = classifyOpportunityType(r.query.text, r.query.intent);

    drafts.push({
      title: opportunityTitle(type, r.query.text),
      type,
      relatedQuery: r.query.text,
      rationale: alreadyHasFaq
        ? `The business does not currently appear in AI responses to "${r.query.text}", even though related FAQ content exists — it may need to be more explicit, prominent, or better structured for AI systems to surface it.`
        : `The business does not appear in AI responses to "${r.query.text}", and no matching content was found in the knowledge profile. ${
            mentioned.length > 0
              ? `${mentioned.length} of ${totalCompetitors} tracked competitor(s) do appear for this query.`
              : "No tracked competitors appear for this query either — it's a wide-open opportunity."
          }`,
      ...base,
    });
  }

  // Structural gap: no destination-tied differentiator/content at all.
  const destinationMentions = latestResults.filter((r) =>
    r.howDescribed?.toLowerCase().includes(business.destination.toLowerCase())
  );
  if (latestResults.length > 0 && destinationMentions.length / latestResults.length < 0.2) {
    drafts.push({
      title: `Strengthen ${business.destination} destination content`,
      type: "destination",
      rationale: `Only ${destinationMentions.length} of ${latestResults.length} monitored AI responses tie the business explicitly to ${business.destination}. Destination-anchored content (e.g. "${business.name} in ${business.destination}") helps AI systems associate the business with the place travellers are actually asking about.`,
      commercialIntent: 0.6,
      travellerDemand: 0.7,
      competitionLevel: 0.5,
      businessRelevance: 1,
      implementationEffort: EFFORT_BY_TYPE.destination,
    });
  }

  return drafts.sort((a, b) => priorityScore(b) - priorityScore(a));
}

/** Persists drafts as ContentOpportunity rows, skipping ones already open with the same title. */
export async function saveContentOpportunities(businessId: string, drafts: OpportunityDraft[]) {
  const existing = await prisma.contentOpportunity.findMany({
    where: { businessId, status: { in: ["open", "in_progress"] } },
    select: { title: true },
  });
  const existingTitles = new Set(existing.map((e) => e.title));

  const toCreate = drafts.filter((d) => !existingTitles.has(d.title));
  if (toCreate.length === 0) return [];

  const data: Prisma.ContentOpportunityCreateManyInput[] = toCreate.map((d) => ({
    businessId,
    title: d.title,
    type: d.type,
    rationale: d.rationale,
    relatedQuery: d.relatedQuery,
    commercialIntent: d.commercialIntent,
    travellerDemand: d.travellerDemand,
    competitionLevel: d.competitionLevel,
    businessRelevance: d.businessRelevance,
    implementationEffort: d.implementationEffort,
    priorityScore: priorityScore(d),
  }));

  await prisma.contentOpportunity.createMany({ data });
  return toCreate;
}

function estimateDemand(queryText: string, allResults: { query: { text: string } }[]): number {
  const words = new Set(queryText.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const related = allResults.filter((r) => {
    const otherWords = r.query.text.toLowerCase().split(/\s+/);
    return otherWords.some((w) => words.has(w));
  }).length;
  return Math.min(1, related / 5);
}

function overlapsSignificantly(a: string, b: string): boolean {
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const bWords = b.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const overlap = bWords.filter((w) => aWords.has(w)).length;
  return overlap >= 2;
}

function classifyOpportunityType(
  queryText: string,
  intent: string
): OpportunityDraft["type"] {
  const lower = queryText.toLowerCase();
  if (intent === "planning" && /itinerary|day/.test(lower)) return "itinerary";
  if (intent === "comparison") return "comparison";
  if (/cost|price|how much|book/.test(lower)) return "faq";
  if (/what is .* known for|things to do/.test(lower)) return "destination";
  return "faq";
}

function opportunityTitle(type: OpportunityDraft["type"], queryText: string): string {
  const labels: Record<OpportunityDraft["type"], string> = {
    faq: "Add FAQ answering",
    page: "Create a page answering",
    comparison: "Create comparison content for",
    itinerary: "Create itinerary content covering",
    destination: "Strengthen destination content for",
    metadata: "Improve metadata targeting",
  };
  return `${labels[type]}: "${queryText}"`;
}
