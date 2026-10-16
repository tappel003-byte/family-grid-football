/** Sleeper trending lookback caps at about a week. */
export const TRENDING_MAX_HOURS = 168;

export type TrendingWindow = {
  id: string;
  label: string;
  /** Hours passed to Sleeper (1–168). */
  hours: number;
};

export type GameStamp = { status: string; startsAt?: string };

function clampHours(hours: number): number {
  if (!Number.isFinite(hours) || hours < 1) return 24;
  return Math.max(1, Math.min(TRENDING_MAX_HOURS, Math.ceil(hours)));
}

function hoursSince(ms: number, now = Date.now()): number {
  return clampHours((now - ms) / 3_600_000);
}

/** Most recent kickoff among live/final games. */
export function latestStartedAt(games: GameStamp[], now = Date.now()): number | null {
  let latest: number | null = null;
  for (const g of games) {
    if (g.status !== "live" && g.status !== "final") continue;
    if (!g.startsAt) continue;
    const t = Date.parse(g.startsAt);
    if (!Number.isFinite(t) || t > now) continue;
    if (latest == null || t > latest) latest = t;
  }
  return latest;
}

/** Earliest kickoff that has already started for a week. */
export function earliestKickoffAt(games: GameStamp[], now = Date.now()): number | null {
  let earliest: number | null = null;
  for (const g of games) {
    if (!g.startsAt) continue;
    const t = Date.parse(g.startsAt);
    if (!Number.isFinite(t) || t > now) continue;
    if (earliest == null || t < earliest) earliest = t;
  }
  return earliest;
}

/**
 * Time windows for Adds/Drops: 24 hours, since last game, and since Week N
 * for the current week and the two before it (when kickoff times exist).
 * Hours still clamp to Sleeper's ~7-day max under the hood.
 */
export function trendingWindowsFor(args: {
  currentWeek: number;
  byWeek: Map<number, GameStamp[]>;
  now?: number;
}): TrendingWindow[] {
  const now = args.now ?? Date.now();
  const allGames = [...args.byWeek.values()].flat();
  const windows: TrendingWindow[] = [{ id: "24h", label: "Last 24 hours", hours: 24 }];

  const lastStarted = latestStartedAt(allGames, now);
  if (lastStarted != null) {
    windows.push({
      id: "since_last_game",
      label: "Since last game",
      hours: hoursSince(lastStarted, now),
    });
  }

  for (let w = args.currentWeek; w >= 1 && w >= args.currentWeek - 2; w--) {
    const games = args.byWeek.get(w) ?? [];
    const start = earliestKickoffAt(games, now) ?? latestStartedAt(games, now);
    if (start == null) continue;
    windows.push({
      id: `week_${w}`,
      label: `Since Week ${w}`,
      hours: hoursSince(start, now),
    });
  }

  return windows;
}
