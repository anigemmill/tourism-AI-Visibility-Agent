export interface QueryGenerationInput {
  destination: string;
  category: string;
  targetSegments: string[];
  experienceNames?: string[];
  businessName: string;
}

export interface GeneratedQuery {
  text: string;
  intent: "discovery" | "comparison" | "planning" | "booking";
  segment?: string;
  commercialIntent: number; // 0-1
}

const LUXURY_WORDS = ["luxury", "premium", "high-end", "exclusive"];
const BUDGET_WORDS = ["budget", "affordable", "cheap"];
const FAMILY_WORDS = ["family", "families", "kids", "children"];
const COUPLE_WORDS = ["couple", "couples", "honeymoon", "romantic"];
const ADVENTURE_WORDS = ["adventurous", "adventure", "thrill"];
const SOLO_WORDS = ["solo", "independent"];

/**
 * Generates commercially-relevant traveller questions for a business, the
 * same kind of question a real traveller would type into an AI assistant
 * when deciding where to go, what to do, or who to book with. Templates
 * are parameterized by destination, category, and the business's own
 * target segments so results stay relevant rather than generic.
 */
export function generateTravellerQueries(input: QueryGenerationInput): GeneratedQuery[] {
  const { destination, category } = input;
  const queries: GeneratedQuery[] = [];
  const seen = new Set<string>();

  const add = (q: GeneratedQuery) => {
    const key = q.text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    queries.push(q);
  };

  // --- Core discovery ---
  add({ text: `Best things to do in ${destination}`, intent: "discovery", commercialIntent: 0.55 });
  add({ text: `Best ${category} experiences in ${destination}`, intent: "discovery", commercialIntent: 0.75 });
  add({ text: `Top-rated ${category} in ${destination}`, intent: "discovery", commercialIntent: 0.7 });
  add({ text: `What is ${destination} known for`, intent: "discovery", commercialIntent: 0.3 });
  add({ text: `Must-do ${category} experiences in ${destination}`, intent: "discovery", commercialIntent: 0.7 });

  // --- Segment-driven discovery ---
  for (const segment of input.targetSegments) {
    const lower = segment.toLowerCase();
    const modifier = classifySegment(lower);
    if (!modifier) {
      add({
        text: `Best ${category} for ${segment} in ${destination}`,
        intent: "discovery",
        segment,
        commercialIntent: 0.75,
      });
      continue;
    }
    add({
      text: `Best ${modifier} ${category} experiences in ${destination}`,
      intent: "discovery",
      segment,
      commercialIntent: 0.8,
    });
    add({
      text: `Best ${category} for ${modifier} travellers in ${destination}`,
      intent: "discovery",
      segment,
      commercialIntent: 0.78,
    });
  }

  // --- Comparison / planning / booking (higher commercial intent) ---
  add({
    text: `What's the best ${category} company in ${destination}`,
    intent: "comparison",
    commercialIntent: 0.9,
  });
  add({
    text: `${destination} ${category} recommendations for a first-time visitor`,
    intent: "planning",
    commercialIntent: 0.65,
  });
  add({
    text: `How much does ${category.toLowerCase()} cost in ${destination}`,
    intent: "booking",
    commercialIntent: 0.85,
  });
  add({
    text: `Best way to book ${category.toLowerCase()} in ${destination}`,
    intent: "booking",
    commercialIntent: 0.9,
  });
  add({
    text: `3 day itinerary in ${destination} including ${category.toLowerCase()}`,
    intent: "planning",
    commercialIntent: 0.6,
  });

  // --- Experience-specific ---
  for (const name of input.experienceNames ?? []) {
    add({
      text: `Is ${name} in ${destination} worth it`,
      intent: "comparison",
      commercialIntent: 0.85,
    });
    add({
      text: `Best alternatives to ${name} in ${destination}`,
      intent: "comparison",
      commercialIntent: 0.88,
    });
  }

  return queries;
}

function classifySegment(lowerSegment: string): string | null {
  if (LUXURY_WORDS.some((w) => lowerSegment.includes(w))) return "luxury";
  if (BUDGET_WORDS.some((w) => lowerSegment.includes(w))) return "budget-friendly";
  if (FAMILY_WORDS.some((w) => lowerSegment.includes(w))) return "family";
  if (COUPLE_WORDS.some((w) => lowerSegment.includes(w))) return "couples";
  if (ADVENTURE_WORDS.some((w) => lowerSegment.includes(w))) return "adventurous";
  if (SOLO_WORDS.some((w) => lowerSegment.includes(w))) return "solo";
  return null;
}
