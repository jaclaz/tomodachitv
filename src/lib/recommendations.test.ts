import { describe, it, expect } from "vitest";
import { recommendationScore } from "./recommendations.server";

describe("recommendationScore", () => {
  it("weights genre 0.45, keyword 0.25, community 0.15, co-watch 0.15", () => {
    expect(recommendationScore({ genre: 1, keyword: 0, community: 0, cowatch: 0 })).toBeCloseTo(0.45);
    expect(recommendationScore({ genre: 0, keyword: 1, community: 0, cowatch: 0 })).toBeCloseTo(0.25);
    expect(recommendationScore({ genre: 0, keyword: 0, community: 1, cowatch: 0 })).toBeCloseTo(0.15);
    expect(recommendationScore({ genre: 0, keyword: 0, community: 0, cowatch: 1 })).toBeCloseTo(0.15);
  });
});
