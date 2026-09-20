import { describe, expect, it } from "vitest";
import { generateTravellerQueries } from "./generate-queries";

describe("generateTravellerQueries", () => {
  const baseInput = {
    destination: "Rotorua, New Zealand",
    category: "Adventure Tours",
    targetSegments: ["families", "luxury travellers"],
    businessName: "Test Co",
  };

  it("generates a non-empty, deduplicated set of queries", () => {
    const queries = generateTravellerQueries(baseInput);
    expect(queries.length).toBeGreaterThan(0);
    const texts = queries.map((q) => q.text.toLowerCase());
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("includes destination and category in core discovery queries", () => {
    const queries = generateTravellerQueries(baseInput);
    expect(queries.some((q) => q.text.includes("Rotorua, New Zealand"))).toBe(true);
    expect(queries.some((q) => q.text.includes("Adventure Tours"))).toBe(true);
  });

  it("classifies known segment modifiers (e.g. families, luxury)", () => {
    const queries = generateTravellerQueries(baseInput);
    expect(queries.some((q) => q.text.toLowerCase().includes("family"))).toBe(true);
    expect(queries.some((q) => q.text.toLowerCase().includes("luxury"))).toBe(true);
  });

  it("falls back to a literal segment phrase for unrecognized segments", () => {
    const queries = generateTravellerQueries({ ...baseInput, targetSegments: ["birdwatchers"] });
    expect(queries.some((q) => q.text.includes("birdwatchers"))).toBe(true);
  });

  it("generates comparison queries for named experiences", () => {
    const queries = generateTravellerQueries({ ...baseInput, experienceNames: ["Zipline Tour"] });
    expect(queries.some((q) => q.text.includes("Zipline Tour") && q.intent === "comparison")).toBe(true);
  });

  it("assigns higher commercial intent to booking/comparison queries than pure discovery", () => {
    const queries = generateTravellerQueries(baseInput);
    const booking = queries.filter((q) => q.intent === "booking");
    const discovery = queries.filter((q) => q.intent === "discovery" && !q.segment);
    const avg = (arr: typeof queries) => arr.reduce((a, q) => a + q.commercialIntent, 0) / arr.length;
    expect(avg(booking)).toBeGreaterThan(avg(discovery));
  });
});
