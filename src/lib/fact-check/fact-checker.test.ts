import { describe, expect, it } from "vitest";
import { checkPrices, checkCancellationPolicy } from "./fact-checker";
import type { Prisma } from "@prisma/client";

type DiscoveryResultRow = Prisma.DiscoveryResultGetPayload<Record<string, never>>;
type ProductRow = Prisma.ProductGetPayload<Record<string, never>>;
type PolicyRow = Prisma.PolicyGetPayload<Record<string, never>>;

function discoveryResult(responseText: string): DiscoveryResultRow {
  return {
    id: "r1",
    businessId: "b1",
    queryId: "q1",
    platform: "openai",
    isDemoData: false,
    businessAppears: true,
    positionRank: 1,
    howDescribed: null,
    competitorsMentioned: [],
    sources: [],
    responseText,
    confidence: 0.9,
    createdAt: new Date(),
  } as DiscoveryResultRow;
}

function product(name: string, priceAmount: number, priceCurrency: string): ProductRow {
  return {
    id: "p1",
    businessId: "b1",
    name,
    description: null,
    priceAmount: priceAmount as unknown as Prisma.Decimal,
    priceCurrency,
    priceUnit: null,
    durationMinutes: null,
    audiences: [],
    sourceUrl: null,
    confidence: 1,
    lastVerifiedAt: new Date(),
  } as ProductRow;
}

function policy(type: string, summary: string): PolicyRow {
  return { id: "pol1", businessId: "b1", type, summary, sourceUrl: null, confidence: 1 } as PolicyRow;
}

describe("checkPrices", () => {
  it("flags a price mentioned in an AI response that materially disagrees with the business's own price", () => {
    const result = discoveryResult("The Original Canopy Tour costs $99 per adult.");
    const drafts = checkPrices(result, [product("Original Canopy Tour", 159, "NZD")]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].field).toBe("price");
    expect(drafts[0].actualValue).toContain("159");
  });

  it("does not flag a price within a small tolerance of the real price", () => {
    const result = discoveryResult("The tour costs $155 per adult.");
    const drafts = checkPrices(result, [product("Original Canopy Tour", 159, "NZD")]);
    expect(drafts).toHaveLength(0);
  });

  it("returns nothing when the business has no priced products on record", () => {
    const result = discoveryResult("The tour costs $99 per adult.");
    expect(checkPrices(result, [])).toHaveLength(0);
  });

  it("marks a very large discrepancy as critical severity", () => {
    const result = discoveryResult("It's only $20 per adult.");
    const drafts = checkPrices(result, [product("Original Canopy Tour", 159, "NZD")]);
    expect(drafts[0].severity).toBe("critical");
  });
});

describe("checkCancellationPolicy", () => {
  it("flags a contradiction between a positive on-file policy and a negative AI claim", () => {
    const result = discoveryResult("Note: this tour has no refunds if you cancel.");
    const drafts = checkCancellationPolicy(result, [policy("cancellation", "Free cancellation up to 48 hours before the tour.")]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].field).toBe("policy");
  });

  it("does not flag agreement between the AI claim and the on-file policy", () => {
    const result = discoveryResult("This tour offers free cancellation up to 48 hours in advance.");
    const drafts = checkCancellationPolicy(result, [policy("cancellation", "Free cancellation up to 48 hours before the tour.")]);
    expect(drafts).toHaveLength(0);
  });

  it("returns nothing when the business has no cancellation policy on record", () => {
    const result = discoveryResult("Note: this tour has no refunds if you cancel.");
    expect(checkCancellationPolicy(result, [])).toHaveLength(0);
  });
});
