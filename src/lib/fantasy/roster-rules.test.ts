import { describe, expect, it } from "vitest";
import { positionCapProblem } from "./roster-rules";

const pos: Record<string, string> = { a: "K", b: "K", c: "K", d: "RB" };
const base = { positionOf: (id: string) => pos[id], limits: { K: 3, RB: 8 } };

describe("position caps", () => {
  it("blocks a fourth kicker", () => {
    expect(positionCapProblem({ ...base, rosterIds: ["a", "b", "c", "d"], addPos: "K", dropId: null })).toMatch(/3 Ks/);
  });
  it("allows a kicker when dropping a kicker", () => {
    expect(positionCapProblem({ ...base, rosterIds: ["a", "b", "c"], addPos: "K", dropId: "a" })).toBeNull();
  });
  it("still blocks when dropping a different position", () => {
    expect(positionCapProblem({ ...base, rosterIds: ["a", "b", "c", "d"], addPos: "K", dropId: "d" })).not.toBeNull();
  });
  it("ignores positions without a cap", () => {
    expect(positionCapProblem({ ...base, rosterIds: ["a"], addPos: "QB", dropId: null })).toBeNull();
  });
});
