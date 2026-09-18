import type { AIPlatformConnector, DemoContext, PlatformId, PlatformResponse } from "./types";

/**
 * Demo connector — used automatically for any platform with no API key
 * configured. It produces synthetic, deterministic sample output so the
 * whole pipeline (monitoring → scoring → opportunities → digest) can be
 * exercised end to end without live AI access.
 *
 * Every response is marked `isDemoData: true` and the text itself says so,
 * so it can never be mistaken for a real finding downstream.
 */
export class DemoConnector implements AIPlatformConnector {
  readonly isConfigured = true; // demo mode is always "available"

  constructor(
    public readonly id: PlatformId,
    public readonly label: string
  ) {}

  async ask(query: string, ctx?: DemoContext): Promise<PlatformResponse> {
    const seed = hashString(`${this.id}:${query}:${ctx?.businessName ?? ""}`);
    const rand = mulberry32(seed);

    const businessName = ctx?.businessName ?? "This business";
    const competitors = ctx?.competitorNames?.length
      ? ctx.competitorNames
      : ["Alpine Ridge Tours", "Coastal Wanderers Co.", "Southern Cross Adventures"];

    const businessAppears = rand() < 0.62; // demo skews toward "appears" so the dashboard has substance to show
    const mentionedCompetitors = competitors.filter(() => rand() < 0.7).slice(0, 3);

    const parts: string[] = [
      `[DEMO DATA — synthetic sample, not a real ${this.label} response] Question: "${query}"`,
    ];

    if (businessAppears) {
      const position = 1 + Math.floor(rand() * 3);
      parts.push(
        `${position === 1 ? "First" : position === 2 ? "Also worth considering" : "Another strong option"}, ${businessName} is mentioned for ${ctx?.category ?? "its offering"} in ${ctx?.destination ?? "the destination"}, noted for a well-reviewed, distinctive experience.`
      );
    } else {
      parts.push(
        `${businessName} does not appear in this synthetic sample response — demo mode occasionally omits the business to illustrate what a visibility gap looks like.`
      );
    }

    if (mentionedCompetitors.length) {
      parts.push(
        `Other options mentioned: ${mentionedCompetitors.join(", ")}.`
      );
    }

    parts.push(
      "This entire answer is illustrative sample data generated locally for development — connect a real API key to see live results."
    );

    const responseText = parts.join(" ");

    return {
      platform: this.id,
      isDemoData: true,
      responseText,
      sources: [],
      queriedAt: new Date().toISOString(),
    };
  }
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
