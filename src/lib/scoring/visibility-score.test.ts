import { describe, expect, it } from "vitest";
import {
  scoreAiDiscoverability,
  scoreContentCoverage,
  scoreReviewReputation,
  scoreCompetitiveVisibility,
} from "./visibility-score";
import type { Prisma } from "@prisma/client";

type DiscoveryResultRow = Prisma.DiscoveryResultGetPayload<Record<string, never>>;
type ReviewRow = Prisma.ReviewGetPayload<Record<string, never>>;

function discoveryResult(overrides: Partial<DiscoveryResultRow>): DiscoveryResultRow {
  return {
    id: "r1",
    businessId: "b1",
    queryId: "q1",
    platform: "openai",
    isDemoData: false,
    businessAppears: false,
    positionRank: null,
    howDescribed: null,
    competitorsMentioned: [],
    sources: [],
    responseText: "",
    confidence: 0.9,
    createdAt: new Date(),
    ...overrides,
  } as DiscoveryResultRow;
}

describe("scoreAiDiscoverability", () => {
  it("scores 0 with an explanatory message when there is no monitoring data", () => {
    const result = scoreAiDiscoverability([]);
    expect(result.score).toBe(0);
    expect(result.explanation).toMatch(/no ai monitoring results/i);
  });

  it("computes the appearance rate as a percentage", () => {
    const results = [
      discoveryResult({ businessAppears: true }),
      discoveryResult({ businessAppears: true }),
      discoveryResult({ businessAppears: false }),
      discoveryResult({ businessAppears: false }),
    ];
    const result = scoreAiDiscoverability(results);
    expect(result.score).toBe(50);
    expect(result.signals).toMatchObject({ totalQueries: 4, appearances: 2 });
  });
});

describe("scoreContentCoverage", () => {
  it("scores 100 when all coverage targets are met", () => {
    const result = scoreContentCoverage({ faqCount: 5, policyCount: 2, productCount: 1, experienceCount: 1 });
    expect(result.score).toBe(100);
  });

  it("identifies specific gaps in the explanation", () => {
    const result = scoreContentCoverage({ faqCount: 0, policyCount: 0, productCount: 0, experienceCount: 0 });
    expect(result.score).toBe(0);
    expect(result.explanation).toMatch(/faqs/i);
  });
});

describe("scoreReviewReputation", () => {
  it("scores 0 when there are no reviews on record", () => {
    const result = scoreReviewReputation([]);
    expect(result.score).toBe(0);
  });

  it("rewards a high average rating with high review volume more than a high rating alone", () => {
    const review = (rating: number, reviewCount: number): ReviewRow =>
      ({
        id: "rv1",
        businessId: "b1",
        platform: "google_places",
        isDemoData: false,
        rating,
        reviewCount,
        summary: null,
        sourceUrl: null,
        fetchedAt: new Date(),
      }) as ReviewRow;

    const highVolume = scoreReviewReputation([review(4.9, 3000)]);
    const lowVolume = scoreReviewReputation([review(4.9, 2)]);
    expect(highVolume.score).toBeGreaterThan(lowVolume.score);
  });
});

describe("scoreCompetitiveVisibility", () => {
  it("returns 0 with an explanation when there is no data or no competitors tracked", () => {
    const result = scoreCompetitiveVisibility([], []);
    expect(result.score).toBe(0);
  });

  it("scores above 50 when the business out-appears its tracked competitors", () => {
    const results = [
      discoveryResult({ businessAppears: true, competitorsMentioned: [] }),
      discoveryResult({ businessAppears: true, competitorsMentioned: [] }),
      discoveryResult({ businessAppears: false, competitorsMentioned: [{ name: "Competitor A", position: 1 }] }),
    ];
    const result = scoreCompetitiveVisibility(results, ["Competitor A"]);
    expect(result.score).toBeGreaterThan(50);
  });

  it("scores below 50 when tracked competitors out-appear the business", () => {
    const results = [
      discoveryResult({ businessAppears: false, competitorsMentioned: [{ name: "Competitor A", position: 1 }] }),
      discoveryResult({ businessAppears: false, competitorsMentioned: [{ name: "Competitor A", position: 1 }] }),
      discoveryResult({ businessAppears: true, competitorsMentioned: [] }),
    ];
    const result = scoreCompetitiveVisibility(results, ["Competitor A"]);
    expect(result.score).toBeLessThan(50);
  });
});
