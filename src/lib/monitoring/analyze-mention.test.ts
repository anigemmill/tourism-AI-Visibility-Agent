import { describe, expect, it } from "vitest";
import { analyzeMention } from "./analyze-mention";

describe("analyzeMention", () => {
  it("detects an exact business name match with high confidence", () => {
    const result = analyzeMention(
      "For adventure in Rotorua, Rotorua Canopy Tours is a fantastic choice.",
      "Rotorua Canopy Tours",
      []
    );
    expect(result.businessAppears).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.howDescribed).toContain("Rotorua Canopy Tours");
  });

  it("reports absence when the business name never appears", () => {
    const result = analyzeMention(
      "Skyline Rotorua and Velocity Valley are both excellent choices for adventure activities in the area.",
      "Rotorua Canopy Tours",
      ["Skyline Rotorua", "Velocity Valley"]
    );
    expect(result.businessAppears).toBe(false);
    expect(result.positionRank).toBeNull();
    expect(result.competitorsMentioned.map((c) => c.name)).toEqual(["Skyline Rotorua", "Velocity Valley"]);
  });

  it("ranks the business relative to competitors by order of first mention", () => {
    const result = analyzeMention(
      "Skyline Rotorua is popular, but Rotorua Canopy Tours is also well reviewed.",
      "Rotorua Canopy Tours",
      ["Skyline Rotorua"]
    );
    expect(result.businessAppears).toBe(true);
    expect(result.positionRank).toBe(2); // one competitor mentioned earlier in the text
  });

  it("never claims a match on an empty response", () => {
    const result = analyzeMention("", "Rotorua Canopy Tours", []);
    expect(result.businessAppears).toBe(false);
    expect(result.howDescribed).toBeNull();
  });

  it("does not false-positive on unrelated substrings", () => {
    // "Canopy" alone should not trigger a match for "Rotorua Canopy Tours"
    const result = analyzeMention("The forest canopy here is beautiful.", "Rotorua Canopy Tours", []);
    expect(result.businessAppears).toBe(false);
  });
});
