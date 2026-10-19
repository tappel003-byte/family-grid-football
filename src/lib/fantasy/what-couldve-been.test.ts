import { describe, expect, it } from "vitest";
import { bestStartersByScore, lineupSwaps, whatCouldveBeen } from "./what-couldve-been";
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

  const t = team(
    ["qb1", "rb1", "rb2", "wr1", "wr2", "te1", "wr3", "k1", "def1"],
    ["qb2", "rb3"],
  );

  const scoreFn = (player: SlimPlayer) => scores[player.id] ?? 0;

  it("says would_have_won with Start X over Y swaps", () => {
    const result = whatCouldveBeen({
      team: t,
      opponentPts: 70,
      byId,
      scoreFn,
    });
    expect(result.verdict).toBe("would_have_won");
    expect(result.swaps.length).toBeGreaterThan(0);
    expect(result.swaps.some((s) => s.inName === "Bench QB" && s.outName === "Starter QB")).toBe(
      true,
    );
    expect(result.highlightIds).toContain("qb2");
    expect(result.highlightIds).toContain("qb1");
  });

  it("says lost_anyway when best lineup still loses", () => {
    const result = whatCouldveBeen({
      team: t,
      opponentPts: 200,
      byId,
      scoreFn,
    });
    expect(result.verdict).toBe("lost_anyway");
    expect(result.swaps.length).toBeGreaterThan(0);
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

  it("stays quiet when you already started the best lineup", () => {
    const optimal = team(
      ["qb2", "rb3", "rb1", "wr3", "wr1", "te1", "rb2", "k1", "def1"],
      ["qb1", "wr2"],
    );
    const result = whatCouldveBeen({
      team: optimal,
      opponentPts: 200,
      byId,
      scoreFn,
    });
    expect(result.swaps).toHaveLength(0);
    expect(result.verdict).toBeNull();
  });

  it("pairs upgrades with same-position sitters when possible", () => {
    const best = bestStartersByScore(t, byId, scoreFn);
    const swaps = lineupSwaps(
      t.starters.filter(Boolean) as string[],
      best,
      byId,
      scoreFn,
    );
    const qb = swaps.find((s) => s.inId === "qb2");
    expect(qb?.outId).toBe("qb1");
    // rb3 enters FLEX and bumps the weakest WR, not an RB slot.
    const rb = swaps.find((s) => s.inId === "rb3");
    expect(rb?.outId).toBe("wr2");
  });

  it("fills legal starter slots by score", () => {
    const starters = bestStartersByScore(t, byId, scoreFn);
    expect(starters).toContain("qb2");
    expect(starters).toContain("rb3");
    expect(starters).not.toContain("qb1");
  });

  it("never pairs a lower scorer over a higher one (Ferguson/Wilson)", () => {
    const roster = new Map<string, SlimPlayer>([
      ["qb", p("qb", "QB", "QB")],
      ["henry", p("henry", "RB", "Henry")],
      ["kamara", p("kamara", "RB", "Kamara")],
      ["rb2", p("rb2", "RB", "RB Two")],
      ["wr1", p("wr1", "WR", "WR One")],
      ["wilson", p("wilson", "WR", "Wilson")],
      ["coleman", p("coleman", "WR", "Coleman")],
      ["higbee", p("higbee", "TE", "Higbee")],
      ["ferguson", p("ferguson", "TE", "Ferguson")],
      ["wasted", p("wasted", "WR", "Wasted")],
      ["k", p("k", "K", "Kicker")],
      ["def", p("def", "DEF", "Defense")],
    ]);
    const pts: Record<string, number> = {
      qb: 15,
      henry: 4.5,
      kamara: 13.9,
      rb2: 8,
      wr1: 10,
      wilson: 5.2,
      coleman: 13.9,
      higbee: 2.2,
      ferguson: 2.3,
      wasted: 1.0,
      k: 5,
      def: 5,
    };
    const score = (player: SlimPlayer) => pts[player.id] ?? 0;

    // Slot order mirrors a TE/WR shuffle the old greedy matcher crossed.
    const actual = ["qb", "henry", "rb2", "wr1", "wilson", "higbee", "wasted", "k", "def"];
    const best = ["qb", "kamara", "rb2", "wr1", "coleman", "ferguson", "wasted", "k", "def"];
    const swaps = lineupSwaps(actual, best, roster, score);

    expect(swaps.some((s) => s.inId === "ferguson" && s.outId === "wilson")).toBe(false);
    expect(swaps.find((s) => s.inId === "ferguson")?.outId).toBe("higbee");
    expect(swaps.find((s) => s.inId === "coleman")?.outId).toBe("wilson");
    expect(swaps.find((s) => s.inId === "kamara")?.outId).toBe("henry");
    for (const s of swaps) {
      expect(score(roster.get(s.inId)!)).toBeGreaterThan(score(roster.get(s.outId)!));
    }
  });

  it("drops swaps that would lose points even if set-diff pairs them", () => {
    const roster = new Map<string, SlimPlayer>([
      ["a", p("a", "WR", "High")],
      ["b", p("b", "TE", "Low")],
    ]);
    const score = (player: SlimPlayer) => (player.id === "a" ? 5.2 : 2.3);
    // Deliberately crossed: low TE "in", high WR "out"
    const swaps = lineupSwaps(["a"], ["b"], roster, score);
    expect(swaps).toHaveLength(0);
  });
});
