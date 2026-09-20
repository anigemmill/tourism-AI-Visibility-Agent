import type { ReviewConnector, ReviewFetchInput, ReviewFetchResult, ReviewPlatformId } from "./types";

/** Same demo-mode contract as the AI connectors: deterministic, clearly labeled, never presented as real. */
export class DemoReviewConnector implements ReviewConnector {
  readonly isConfigured = true;

  constructor(
    public readonly id: ReviewPlatformId,
    public readonly label: string
  ) {}

  async fetch(input: ReviewFetchInput): Promise<ReviewFetchResult> {
    const seed = hashString(`${this.id}:${input.businessName}`);
    const rand = mulberry32(seed);
    const rating = Math.round((4.0 + rand() * 1.0) * 10) / 10; // 4.0 - 5.0
    const reviewCount = Math.floor(50 + rand() * 2000);

    return {
      platform: this.id,
      isDemoData: true,
      rating,
      reviewCount,
      sourceUrl: null,
      fetchedAt: new Date().toISOString(),
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
