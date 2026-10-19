import { describe, expect, it } from "vitest";
import { bestStartersByScore, whatCouldveBeen } from "./what-couldve-been";
import type { FantasyTeam } from "./league";
import type { SlimPlayer } from "../sleeper.functions";

const p = (id: string, pos: string, name = id): SlimPlayer =>
  ({ id, name, pos, team: "KC" }) as SlimPlayer;

const team = (starters: Array<string | null>, bench: string[]): FantasyTeam => ({
  id: "t1",
  name: "Test",
  owner: "Tim",
  color: "#000",
  starters,
  bench,
});

describe("whatCouldveBeen", () => {
  const byId = new Map<string, SlimPlayer>([
    ["qb1", p("qb1", "QB", "Starter QB")],
    ["qb2", p("qb2", "QB", "Bench QB")],
    ["rb1", p("rb1", "RB", "RB One")],
    ["rb2", p("rb2", "RB", "RB Two")],
    ["rb3", p("rb3", "RB", "Bench RB")],
    ["wr1", p("wr1", "WR", "WR One")],
    ["wr2", p("wr2", "WR", "WR Two")],
    ["wr3", p("wr3", "WR", "Bench WR")],
    ["te1", p("te1", "TE", "TE One")],
    ["k1", p("k1", "K", "Kicker")],
    ["def1", p("def1", "DEF", "Defense")],
  ]);

  const scores: Record<string, number> = {
    qb1: 10,
    qb2: 25,
    rb1: 8,
    rb2: 7,
    rb3: 20,
    wr1: 6,
    wr2: 5,
    wr3: 18,
    te1: 4,
    k1: 3,
    def1: 2,
  };

  // Flex wr3(18) started; bench qb2(25) + rb3(20) would upgrade.
  // Actual ≈ 63, best ≈ 91.
  const t = team(
    ["qb1", "rb1", "rb2", "wr1", "wr2", "te1", "wr3", "k1", "def1"],
    ["qb2", "rb3"],
  );

  const scoreFn = (player: SlimPlayer) => scores[player.id] ?? 0;

  it("says would_have_won when best lineup beats the opponent", () => {
    const result = whatCouldveBeen({
      team: t,
      opponentPts: 70,
      byId,
      scoreFn,
    });
    expect(result.ready).toBe(true);
    expect(result.verdict).toBe("would_have_won");
    expect(result.startThese.length).toBeGreaterThan(0);
  });

  it("says lost_anyway when best lineup still loses", () => {
    const result = whatCouldveBeen({
      team: t,
      opponentPts: 200,
      byId,
      scoreFn,
    });
    expect(result.verdict).toBe("lost_anyway");
  });

  it("stays quiet when the team already won", () => {
    const result = whatCouldveBeen({
      team: t,
      opponentPts: 10,
      byId,
      scoreFn,
    });
    expect(result.verdict).toBeNull();
  });

  it("still says would_have_won once you're eliminated even if they have minutes left", () => {
    // Best ~91 vs their 70 now — you're dead, roast the bench even if they can still score.
    const result = whatCouldveBeen({
      team: t,
      opponentPts: 70,
      opponentRemaining: 30,
      byId,
      scoreFn,
    });
    expect(result.verdict).toBe("would_have_won");
    expect(result.ready).toBe(true);
  });

  it("stays quiet while you can still catch their current score", () => {
    const result = whatCouldveBeen({
      team: t,
      opponentPts: 70,
      byId,
      scoreFn,
      remainingFn: () => 20, // myMax ~83 > 70
    });
    expect(result.verdict).toBeNull();
  });

  it("shows lost_anyway as soon as optimistic best still can't catch up", () => {
    const left: Record<string, number> = { qb2: 5, rb3: 5 };
    const result = whatCouldveBeen({
      team: t,
      opponentPts: 200,
      byId,
      scoreFn,
      remainingFn: (player) => left[player.id] ?? 0,
    });
    expect(result.verdict).toBe("lost_anyway");
  });

  it("fills legal starter slots by score", () => {
    const starters = bestStartersByScore(t, byId, scoreFn);
    expect(starters).toContain("qb2");
    expect(starters).toContain("rb3");
    expect(starters).not.toContain("qb1");
  });
});
