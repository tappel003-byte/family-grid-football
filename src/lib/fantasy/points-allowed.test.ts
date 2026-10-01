import { describe, expect, it } from "vitest";
import { rawToStatLine } from "./stat-line";
import { toLine } from "./results.server";
import { ESPN_SCORING, ZERO_STATS, scoreStats, type StatLine } from "./scoring";

const tierPts = (line: Record<string, number> | null) => {
  const only = { ...ZERO_STATS } as StatLine;
  for (const k of Object.keys(only) as Array<keyof StatLine>) {
    if (k.startsWith("ptsAllow")) only[k] = Number(line?.[k] ?? 0);
  }
  return scoreStats(only, ESPN_SCORING);
};

const cases: Array<[number, number]> = [
  [0, 5], [17, 1], [18, 0], [20, 0], [21, 0], [22, -1], [46, -5],
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
});
