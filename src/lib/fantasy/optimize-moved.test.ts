import { describe, expect, it } from "vitest";
import { optimizeMovedIds } from "./optimize-moved";
import type { FantasyTeam } from "./league";

const team = (starters: Array<string | null>, bench: string[]): FantasyTeam => ({
  id: "t1",
  name: "Test",
  owner: "Tim",
  color: "#000",
  starters,
  bench,
});

describe("optimizeMovedIds", () => {
  it("returns empty when nothing moved", () => {
    const t = team(["a", "b", null, null, null, null, null, null, null], ["c"]);
    expect(optimizeMovedIds(t, t)).toEqual([]);
  });

  it("flags starter-to-bench and bench-to-starter swaps", () => {
    const before = team(["a", "b", null, null, null, null, null, null, null], ["c"]);
    const after = team(["a", "c", null, null, null, null, null, null, null], ["b"]);
    expect(optimizeMovedIds(before, after).sort()).toEqual(["b", "c"]);
  });

  it("flags a player who changed starter slots", () => {
    const before = team(["a", "b", null, null, null, null, null, null, null], []);
    const after = team(["b", "a", null, null, null, null, null, null, null], []);
    expect(optimizeMovedIds(before, after).sort()).toEqual(["a", "b"]);
  });
});
