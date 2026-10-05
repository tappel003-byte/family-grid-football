import { describe, expect, it } from "vitest";
import { formatMissedLine, outlookFromReturn } from "./injury-outlook";

const schedule = [
  { week: 5, date: "2026-10-04", home: "NO", away: "NE" },
  { week: 6, date: "2026-10-11", home: "NO", away: "BUF" },
  // week 7 bye for NO
  { week: 8, date: "2026-10-25", home: "KC", away: "NO" },
  { week: 9, date: "2026-11-01", home: "NO", away: "LAR" },
];

describe("outlookFromReturn", () => {
  it("lists missed games and byes before the return date", () => {
    const out = outlookFromReturn("NO", schedule, 5, "2026-10-25");
    expect(out.gamesMissed).toBe(2);
    expect(out.labels).toEqual(["vs NE", "vs BUF", "bye"]);
    expect(out.returnWeek).toBe(8);
  });

  it("does not count a game on the return date as missed", () => {
    const out = outlookFromReturn("NO", schedule, 6, "2026-10-11");
    expect(out.gamesMissed).toBe(0);
    expect(out.labels).toEqual([]);
    expect(out.returnWeek).toBe(6);
  });
});

describe("formatMissedLine", () => {
  it("joins labels in plain English", () => {
    expect(formatMissedLine(["vs NE", "bye", "@ KC"])).toBe(
      "Likely misses vs NE, bye, then @ KC",
    );
  });
});
