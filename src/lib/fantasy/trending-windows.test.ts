import { describe, expect, it } from "vitest";
import {
  TRENDING_MAX_HOURS,
  earliestKickoffAt,
  latestStartedAt,
  trendingWindowsFor,
} from "./trending-windows";

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

  it("adds since current week when kickoffs exist", () => {
    const windows = trendingWindowsFor({
      currentWeek: 6,
      byWeek: new Map([
        [
          6,
          [{ status: "final", startsAt: "2026-10-10T00:15:00.000Z" }],
        ],
      ]),
      now,
    });
    expect(windows.some((w) => w.id === "week_6")).toBe(true);
  });

  it("skips older weeks that fall outside the lookback cap", () => {
    const windows = trendingWindowsFor({
      currentWeek: 6,
      byWeek: new Map([
        [6, [{ status: "final", startsAt: "2026-10-15T00:15:00.000Z" }]],
        [5, [{ status: "final", startsAt: "2026-10-05T17:00:00.000Z" }]],
        [4, [{ status: "final", startsAt: "2026-09-28T17:00:00.000Z" }]],
      ]),
      now,
    });
    expect(windows.some((w) => w.id === "week_5")).toBe(false);
    expect(windows.some((w) => w.id === "week_4")).toBe(false);
  });

  it("clamps hours to the Sleeper max", () => {
    const start = earliestKickoffAt(
      [{ status: "final", startsAt: "2026-09-01T17:00:00.000Z" }],
      now,
    );
    expect(start).not.toBeNull();
    const hours = Math.ceil((now - start!) / 3_600_000);
    expect(hours).toBeGreaterThan(TRENDING_MAX_HOURS);
    const latest = latestStartedAt(
      [{ status: "final", startsAt: "2026-09-01T17:00:00.000Z" }],
      now,
    );
    expect(latest).not.toBeNull();
  });
});
