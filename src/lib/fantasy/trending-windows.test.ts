import { describe, expect, it } from "vitest";
import { latestStartedAt, trendingWindowsFor } from "./trending-windows";

describe("trendingWindowsFor", () => {
  const now = Date.parse("2026-10-16T18:00:00.000Z");

  it("always includes last 24 hours", () => {
    const windows = trendingWindowsFor({
      currentWeek: 6,
      byWeek: new Map(),
      now,
    });
    expect(windows[0]).toEqual({ id: "24h", label: "Last 24 hours", hours: 24 });
  });

  it("adds since last game from the newest kickoff", () => {
    const windows = trendingWindowsFor({
      currentWeek: 6,
      byWeek: new Map([
        [
          6,
          [
            { status: "final", startsAt: "2026-10-15T00:15:00.000Z" },
            { status: "scheduled", startsAt: "2026-10-19T17:00:00.000Z" },
          ],
        ],
      ]),
      now,
    });
    const last = windows.find((w) => w.id === "since_last_game");
    expect(last?.label).toBe("Since last game");
    // Oct 15 00:15 → Oct 16 18:00 ≈ 42 hours
    expect(last!.hours).toBe(42);
  });

  it("always offers since current week when kickoffs exist", () => {
    const windows = trendingWindowsFor({
      currentWeek: 6,
      byWeek: new Map([[6, [{ status: "final", startsAt: "2026-10-10T00:15:00.000Z" }]]]),
      now,
    });
    expect(windows.some((w) => w.id === "week_6" && w.label === "Since Week 6")).toBe(true);
  });

  it("keeps prior weeks visible so you can try them", () => {
    const windows = trendingWindowsFor({
      currentWeek: 6,
      byWeek: new Map([
        [6, [{ status: "final", startsAt: "2026-10-15T00:15:00.000Z" }]],
        [5, [{ status: "final", startsAt: "2026-10-05T17:00:00.000Z" }]],
        [4, [{ status: "final", startsAt: "2026-09-28T17:00:00.000Z" }]],
      ]),
      now,
    });
    expect(windows.map((w) => w.id)).toEqual([
      "24h",
      "since_last_game",
      "week_6",
      "week_5",
      "week_4",
    ]);
  });

  it("finds the latest started kickoff", () => {
    const latest = latestStartedAt(
      [
        { status: "final", startsAt: "2026-10-12T17:00:00.000Z" },
        { status: "final", startsAt: "2026-10-15T00:15:00.000Z" },
        { status: "scheduled", startsAt: "2026-10-19T17:00:00.000Z" },
      ],
      now,
    );
    expect(latest).toBe(Date.parse("2026-10-15T00:15:00.000Z"));
  });
});
