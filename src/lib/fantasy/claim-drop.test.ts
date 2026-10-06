import { describe, expect, test } from "vitest";
import { dropBlockedForMove } from "./claim-drop";

describe("dropBlockedForMove", () => {
  test("instant adds cannot name a kickoff-locked drop", () => {
    expect(dropBlockedForMove({ claimMode: false, dropGameLocked: true })).toBe(true);
  });

  test("claims can name a kickoff-locked drop (processes Wednesday)", () => {
    expect(dropBlockedForMove({ claimMode: true, dropGameLocked: true })).toBe(false);
  });

  test("unlocked drops are always allowed", () => {
    expect(dropBlockedForMove({ claimMode: false, dropGameLocked: false })).toBe(false);
    expect(dropBlockedForMove({ claimMode: true, dropGameLocked: false })).toBe(false);
  });
});
