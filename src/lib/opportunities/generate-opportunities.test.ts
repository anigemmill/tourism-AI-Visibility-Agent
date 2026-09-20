import { describe, expect, it } from "vitest";
import { priorityScore } from "./generate-opportunities";

describe("priorityScore", () => {
  it("scores a high-intent, high-demand, low-competition, low-effort opportunity near the top", () => {
    const score = priorityScore({
      commercialIntent: 1,
      travellerDemand: 1,
      competitionLevel: 0,
      businessRelevance: 1,
      implementationEffort: 0,
    });
    expect(score).toBe(100);
  });

  it("scores a low-intent, low-demand, high-competition, high-effort opportunity near the bottom", () => {
    const score = priorityScore({
      commercialIntent: 0,
      travellerDemand: 0,
      competitionLevel: 1,
      businessRelevance: 0,
      implementationEffort: 1,
    });
    expect(score).toBe(0);
  });

  it("penalizes higher competition and higher effort, all else equal", () => {
    const base = { commercialIntent: 0.5, travellerDemand: 0.5, businessRelevance: 0.5 };
    const lowCompetition = priorityScore({ ...base, competitionLevel: 0.1, implementationEffort: 0.5 });
    const highCompetition = priorityScore({ ...base, competitionLevel: 0.9, implementationEffort: 0.5 });
    expect(lowCompetition).toBeGreaterThan(highCompetition);

    const lowEffort = priorityScore({ ...base, competitionLevel: 0.5, implementationEffort: 0.1 });
    const highEffort = priorityScore({ ...base, competitionLevel: 0.5, implementationEffort: 0.9 });
    expect(lowEffort).toBeGreaterThan(highEffort);
  });

  it("weights commercial intent and traveller demand more than competition and effort", () => {
    // 0.30 + 0.25 = 0.55 combined weight for intent+demand vs 0.15+0.10=0.25 for competition+effort
    const intentDrivenScore = priorityScore({
      commercialIntent: 1,
      travellerDemand: 1,
      competitionLevel: 1,
      businessRelevance: 0,
      implementationEffort: 1,
    });
    const effortDrivenScore = priorityScore({
      commercialIntent: 0,
      travellerDemand: 0,
      competitionLevel: 0,
      businessRelevance: 0,
      implementationEffort: 0,
    });
    expect(intentDrivenScore).toBeGreaterThan(effortDrivenScore);
  });
});
