import { createServerFn } from "@tanstack/react-start";
import { scoreStats, type Scoring } from "./fantasy/scoring";
import { rawToStatLine } from "./fantasy/stat-line";
import {
  loadPlayerMeta,
  loadSchedule,
  loadSeasonRaw,
  loadState,
  loadWeekRaw,
} from "./nfl-stats.server";

export type PlayerInsight = {
  /** Fantasy points in each of the last three completed weeks, newest last. */
  last3: number[];
  last3Avg: number;
  seasonAvg: number;
  /** Total fantasy points scored so far this season. */
  seasonPts: number;
  games: number;
  /** Average targets over the last three weeks (receivers and backs). */
  targets: number;
  /** Share of team offensive snaps over the last three weeks, 0-100. */
  snapPct: number | null;
};

export type MatchupRating = {
  opponent: string | null;
  home: boolean;
  /** 1 = the defense that gives up the most points to this position. */
  rank: number | null;
  grade: "great" | "even" | "tough" | null;
};

export type InsightsData = {
  season: string;
  week: number;
  /** Bye week per NFL team. */
  byes: Record<string, number>;
  /** Matchup for the requested week, keyed by NFL team then position. */
  matchups: Record<string, { opponent: string | null; home: boolean }>;
  /** Defense rank allowed, keyed by position then defending team. */
  defenseRank: Record<string, Record<string, number>>;
  players: Record<string, PlayerInsight>;
};

function scoreRaw(raw: Record<string, number> | undefined, scoring: Scoring): number {
  const line = rawToStatLine(raw);
  return line ? scoreStats(line, scoring) : 0;
}

export const getInsights = createServerFn({ method: "GET" })
  .inputValidator((data: { week: number; scoring: Scoring }) => ({
    week: Math.min(18, Math.max(1, Math.round(data.week))),
    scoring: data.scoring,
  }))
  .handler(async ({ data }): Promise<InsightsData> => {
    const { season } = await loadState();
    const [meta, schedule, seasonRaw] = await Promise.all([
      loadPlayerMeta(),
      loadSchedule(season),
      loadSeasonRaw(season),
    ]);

    // Bye weeks: a team with no game in a regular-season week is on bye.
    const playedWeeks = new Map<string, Set<number>>();
    const allWeeks = new Set<number>();
    for (const g of schedule) {
      if (!g.week || g.week > 18) continue;
      allWeeks.add(g.week);
      for (const t of [g.home, g.away]) {
        if (!playedWeeks.has(t)) playedWeeks.set(t, new Set());
        playedWeeks.get(t)!.add(g.week);
      }
    }
    const byes: Record<string, number> = {};
    for (const [team, weeks] of playedWeeks) {
      for (const w of [...allWeeks].sort((a, b) => a - b)) {
        if (w <= 14 && !weeks.has(w)) {
          byes[team] = w;
          break;
        }
      }
    }

    // This week's opponents.
    const matchups: Record<string, { opponent: string | null; home: boolean }> = {};
    const opponentByWeek = new Map<string, string>();
    for (const g of schedule) {
      opponentByWeek.set(`${g.week}-${g.home}`, g.away);
      opponentByWeek.set(`${g.week}-${g.away}`, g.home);
      if (g.week === data.week) {
        matchups[g.home] = { opponent: g.away, home: true };
        matchups[g.away] = { opponent: g.home, home: false };
      }
    }

    // Last three completed weeks of box scores.
    const recentWeeks: number[] = [];
    for (let w = data.week - 1; w >= 1 && recentWeeks.length < 3; w--) recentWeeks.push(w);
    recentWeeks.reverse();
    const recentRaw = await Promise.all(recentWeeks.map((w) => loadWeekRaw(season, w)));

    // Per-player recent form.
    const players: Record<string, PlayerInsight> = {};
    const allowed: Record<string, Record<string, number>> = {};

    for (const [id, m] of Object.entries(meta)) {
      const last3: number[] = [];
      let targets = 0;
      let snapNum = 0;
      let snapDen = 0;
      recentRaw.forEach((raw, i) => {
        const line = raw[id];
        if (line) {
          const gamesPlayed = Number(line["gp"] ?? 1);
          if (gamesPlayed > 0) last3.push(scoreRaw(line, data.scoring));
          targets += line["rec_tgt"] ?? 0;
          snapNum += line["off_snp"] ?? 0;
          snapDen += line["tm_off_snp"] ?? 0;
          // Points this player put on the opposing defense.
          const week = recentWeeks[i]!;
          const opp = opponentByWeek.get(`${week}-${m.team}`);
          if (opp && m.pos !== "DEF" && m.pos !== "K") {
            allowed[m.pos] ??= {};
            allowed[m.pos]![opp] = (allowed[m.pos]![opp] ?? 0) + pts;
          }
        }
      });
      const seasonLine = seasonRaw[id];
      const games = seasonLine?.["gp"] ?? 0;
      const seasonPts = scoreRaw(seasonLine, data.scoring);
      const played = last3.length || 1;
      players[id] = {
        last3,
        last3Avg: Math.round((last3.reduce((a, b) => a + b, 0) / played) * 10) / 10,
        seasonAvg: games > 0 ? Math.round((seasonPts / games) * 10) / 10 : 0,
        seasonPts: Math.round(seasonPts * 10) / 10,
        games,
        targets: Math.round((targets / played) * 10) / 10,
        snapPct: snapDen > 0 ? Math.round((snapNum / snapDen) * 100) : null,
      };
    }

    // Rank defenses by points allowed to each position (1 = softest matchup).
    const defenseRank: Record<string, Record<string, number>> = {};
    for (const [pos, byTeam] of Object.entries(allowed)) {
      const sorted = Object.entries(byTeam).sort((a, b) => b[1] - a[1]);
      const ranks: Record<string, number> = {};
      sorted.forEach(([team], i) => {
        ranks[team] = i + 1;
      });
      defenseRank[pos] = ranks;
    }

    return { season, week: data.week, byes, matchups, defenseRank, players };
  });
