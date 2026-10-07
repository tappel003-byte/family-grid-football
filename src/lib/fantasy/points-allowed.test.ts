import { describe, expect, it } from "vitest";
import { rawToStatLine } from "./stat-line";
import { toLine } from "./results.server";
import {
  ESPN_SCORING,
  ZERO_STATS,
  normalizeScoring,
  scoreStats,
  type StatLine,
} from "./scoring";

const tierPts = (line: Record<string, number> | null) => {
  const only = { ...ZERO_STATS } as StatLine;
  for (const k of Object.keys(only) as Array<keyof StatLine>) {
    if (k.startsWith("ptsAllow")) only[k] = Number(line?.[k] ?? 0);
  }
  return scoreStats(only, ESPN_SCORING);
};

/** NFL.com old default points-allowed brackets. */
const cases: Array<[number, number]> = [
  [0, 10],
  [1, 7],
  [6, 7],
  [7, 4],
  [13, 4],
  [14, 1],
  [17, 1],
  [20, 1],
  [21, 0],
  [27, 0],
  [28, -1],
  [34, -1],
  [35, -4],
  [46, -4],
];

describe("points allowed tiers", () => {
  for (const [pa, pts] of cases) {
    it(`pts_allow ${pa} -> ${pts}`, () => {
      expect(tierPts(rawToStatLine({ pts_allow: pa, sack: 1 }))).toBe(pts);
      expect(tierPts(toLine({ pts_allow: pa }))).toBe(pts);
    });
  }
  it("missing pts_allow gives 0 (never a shutout)", () => {
    expect(tierPts(rawToStatLine({ rush_yd: 50 }))).toBe(0);
    expect(tierPts(toLine({ rush_yd: 50 }))).toBe(0);
    expect(tierPts(toLine({}))).toBe(0);
  });
  it("NFL example: 17 PA + 3 sacks + 1 INT = 6", () => {
    const line = rawToStatLine({ pts_allow: 17, sack: 3, int: 1 });
    expect(scoreStats(line!, ESPN_SCORING)).toBe(6);
  });
});

describe("normalizeScoring", () => {
  it("migrates legacy ESPN shutout-5 scoring to NFL.com PA brackets", () => {
    const next = normalizeScoring({
      reception: 1,
      ptsAllow0: 5,
      ptsAllow1_6: 4,
      ptsAllow7_13: 3,
      ptsAllow14_17: 1,
      ptsAllow18_21: 0,
      ptsAllow22_27: -1,
      ptsAllow28_34: -3,
      ptsAllow35_45: -5,
      ptsAllow46: -5,
    } as never);
    expect(next.reception).toBe(1);
    expect(next.ptsAllow0).toBe(10);
    expect(next.ptsAllow1_6).toBe(7);
    expect(next.ptsAllow14_20).toBe(1);
    expect(next.ptsAllow21_27).toBe(0);
    expect(next.ptsAllow35).toBe(-4);
    expect((next as Record<string, number>)["ptsAllow14_17"]).toBeUndefined();
  });
});
