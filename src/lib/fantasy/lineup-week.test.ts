import { describe, expect, test } from "vitest";
import { lineupForWeek, type FantasyTeam, type League } from "./league";
import { DEFAULT_RULES } from "./rules";
import { PPR_SCORING } from "./scoring";

function team(id: string, starters: Array<string | null>): FantasyTeam {
  return {
    id,
    name: "Test",
    owner: "Tim",
    color: "#000",
    starters,
    bench: [],
  };
}

function league(
  currentWeek: number,
  teams: FantasyTeam[],
  weeklyLineups?: League["weeklyLineups"],
): League {
  return {
    version: 3,
    name: "La Familia",
    currentWeek,
    scoring: PPR_SCORING,
    rules: DEFAULT_RULES,
    teams,
    schedule: [],
    ...(weeklyLineups ? { weeklyLineups } : {}),
  };
}

describe("lineupForWeek", () => {
  const live = team("team-1", ["now-qb", "now-rb"]);
  const frozen = ["old-qb", "old-rb"];

  test("current week always uses the live roster", () => {
    const l = league(5, [live], { 5: { 0: frozen }, 4: { 0: frozen } });
    expect(lineupForWeek(live, l, 5).starters).toEqual(["now-qb", "now-rb"]);
  });

  test("past weeks use the frozen scoring lineup", () => {
    const l = league(5, [live], { 4: { 0: frozen } });
    expect(lineupForWeek(live, l, 4).starters).toEqual(frozen);
  });

  test("past weeks without a snapshot fall back to live", () => {
    const l = league(5, [live]);
    expect(lineupForWeek(live, l, 4).starters).toEqual(["now-qb", "now-rb"]);
  });
});
