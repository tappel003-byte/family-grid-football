import { describe, expect, it } from "vitest";
import { isPregameFromGames } from "./hooks";

describe("isPregameFromGames", () => {
  const now = Date.parse("2026-10-09T01:00:00.000Z");

  it("past weeks are never pregame", () => {
    expect(isPregameFromGames([], 4, 5, now)).toBe(false);
  });

  it("current week with no games is still pregame", () => {
    expect(isPregameFromGames([], 5, 5, now)).toBe(true);
  });

  it("all scheduled future kickoffs stay pregame", () => {
    expect(
      isPregameFromGames(
        [{ status: "scheduled", startsAt: "2026-10-09T17:00:00.000Z" }],
        5,
        5,
        now,
      ),
    ).toBe(true);
  });

  it("a live game ends pregame even if some teams still have 0", () => {
    expect(
      isPregameFromGames(
        [
          { status: "live", startsAt: "2026-10-08T00:20:00.000Z" },
          { status: "scheduled", startsAt: "2026-10-09T17:00:00.000Z" },
        ],
        5,
        5,
        now,
      ),
    ).toBe(false);
  });

  it("kickoff time already passed ends pregame", () => {
    expect(
      isPregameFromGames(
        [{ status: "scheduled", startsAt: "2026-10-08T00:20:00.000Z" }],
        5,
        5,
        now,
      ),
    ).toBe(false);
  });
});
