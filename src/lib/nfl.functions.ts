import { createServerFn } from "@tanstack/react-start";
import { ZERO_STATS, type StatLine } from "./fantasy/scoring";
import { rawToStatLine } from "./fantasy/stat-line";

export type GameInfo = {
  status: "final" | "live" | "scheduled" | "none";
  label: string;
  startsAt?: string;
  /** TV network showing the game, e.g. "FOX". */
  network?: string;
  /** Game seconds still to be played (3600 before kickoff, 0 once final). */
  secondsLeft?: number;
  /** True while this team has possession of the ball in a live game. */
  hasBall?: boolean;
};

export type WeekData = {
  season: string;
  week: number;
  currentWeek: number;
  stats: Record<string, StatLine>;
  projections: Record<string, StatLine>;
  games: Record<string, GameInfo>;
  /** True when the live feed hiccuped and we are showing the last scores we got. */
  stale?: boolean;
};

const EMPTY: StatLine = ZERO_STATS;

/** Last good payload per season-week, served when the live feed goes down. */
const lastGoodCache = new Map<string, WeekData>();

type Raw = Record<string, Record<string, number>>;

function toStatLine(raw: Record<string, number> | undefined): StatLine | null {
  return rawToStatLine(raw);
}

function mapStats(raw: Raw): Record<string, StatLine> {
  const out: Record<string, StatLine> = {};
  for (const [id, values] of Object.entries(raw)) {
    const line = toStatLine(values);
    if (line) out[id] = line;
  }
  return out;
}

type ScheduleGame = { status: string; date: string; home: string; away: string; week: number };

type Scoreboard = {
  events?: Array<{
    date?: string;
    status?: {
      clock?: number;
      displayClock?: string;
      period?: number;
      type?: { state?: string; completed?: boolean };
    };
    competitions?: Array<{
      broadcasts?: Array<{ names?: string[] }>;
      situation?: { possession?: string };
      competitors?: Array<{ id?: string; team?: { id?: string; abbreviation?: string } }>;
    }>;
  }>;
};

type CdnScoreboard = { content?: { sbData?: Scoreboard } };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function gameLabel(game: ScheduleGame): GameInfo {
  if (game.status === "complete") return { status: "final", label: "Final" };
  if (game.status === "canceled") return { status: "none", label: "No game" };
  if (game.status === "in_game") return { status: "live", label: "Live" };
  const parts = game.date.split("-").map(Number);
  const d = new Date(Date.UTC(parts[0] ?? 2026, (parts[1] ?? 1) - 1, parts[2] ?? 1));
  const day = DAYS[d.getUTCDay()] ?? "Sun";
  return { status: "scheduled", label: `${day} ${d.getUTCMonth() + 1}/${d.getUTCDate()}` };
}

/** Game seconds still to play: 3600 before kickoff, clock-aware while live, 0 when final. */
function secondsLeftFor(status: GameInfo["status"], period: number, clock: number): number {
  if (status === "scheduled") return 3600;
  if (status !== "live") return 0;
  if (period >= 5) return Math.max(0, Math.round(clock));
  const quartersAfter = Math.max(0, 4 - Math.max(1, period));
  return Math.max(0, Math.round(clock)) + quartersAfter * 15 * 60;
}

export function scoreboardGames(scoreboard: Scoreboard): Record<string, GameInfo> {
  const games: Record<string, GameInfo> = {};
  for (const event of scoreboard.events ?? []) {
    const startsAt = event.date;
    const state = event.status?.type?.state;
    const status = event.status?.type?.completed ? "final" : state === "in" ? "live" : "scheduled";
    const clockText = event.status?.displayClock;
    const period = Number(event.status?.period ?? 0);
    const label =
      status === "final"
        ? "Final"
        : status === "live"
          ? period && clockText
            ? `Q${period} ${clockText}`
            : "Live"
          : "Scheduled";
    const network = event.competitions?.[0]?.broadcasts?.[0]?.names?.[0];
    const secondsLeft = secondsLeftFor(status, period, Number(event.status?.clock ?? 0));
    const possession = event.competitions?.[0]?.situation?.possession;
    for (const competitor of event.competitions?.[0]?.competitors ?? []) {
      const abbreviation = competitor.team?.abbreviation;
      if (abbreviation) {
        const hasBall =
          status === "live" &&
          !!possession &&
          (possession === competitor.id || possession === competitor.team?.id);
        const info: GameInfo = { status, label, secondsLeft, hasBall };
        if (startsAt) info.startsAt = startsAt;
        if (network) info.network = network;
        games[abbreviation === "WSH" ? "WAS" : abbreviation] = info;
      }
    }
  }
  return games;
}

function mergeGame(base: GameInfo | undefined, rich: GameInfo): GameInfo {
  if (!base) return rich;
  return {
    ...base,
    ...rich,
    startsAt: rich.startsAt ?? base.startsAt,
    network: rich.network ?? base.network,
  };
}

function mergeGames(base: Record<string, GameInfo>, rich: Record<string, GameInfo>) {
  const merged = { ...base };
  for (const [team, game] of Object.entries(rich)) merged[team] = mergeGame(merged[team], game);
  return merged;
}

type Cached = { at: number; data: WeekData };
const cache = new Map<string, Cached>();

async function json<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/** Real NFL stats, projections and game status for one week, straight from Sleeper. */
export const getWeekData = createServerFn({ method: "GET" })
  .inputValidator((data: { week: number }) => ({
    week: Math.min(18, Math.max(1, Math.round(data.week))),
  }))
  .handler(async ({ data }): Promise<WeekData> => {
    const state = await json<{ season?: string; week?: number; display_week?: number }>(
      "https://api.sleeper.app/v1/state/nfl",
      {},
    );
    const season = state.season ?? String(new Date().getUTCFullYear());
    const currentWeek = state.display_week ?? state.week ?? 1;
    // Keep rich schedule payloads separate from cached data created before
    // kickoff times and TV networks were added to GameInfo.
    const key = `schedule-v2-${season}-${data.week}`;

    const hit = cache.get(key);
    const ttl = data.week < currentWeek ? 1000 * 60 * 60 * 6 : 1000 * 60 * 2;
    if (hit && Date.now() - hit.at < ttl) return hit.data;

    const [stats, projections, schedule, scoreboard, cdnScoreboard] = await Promise.all([
      json<Raw>(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${data.week}`, {}),
      json<Raw>(`https://api.sleeper.app/v1/projections/nfl/regular/${season}/${data.week}`, {}),
      json<ScheduleGame[]>(`https://api.sleeper.app/schedule/nfl/regular/${season}`, []),
      json<Scoreboard>(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${data.week}&dates=${season}`, {}),
      json<CdnScoreboard>(`https://cdn.espn.com/core/nfl/scoreboard?xhr=1&year=${season}&week=${data.week}&seasontype=2`, {}),
    ]);

    const games: Record<string, GameInfo> = {};
    for (const game of schedule) {
      if (game.week !== data.week) continue;
      const info = gameLabel(game);
      games[game.home] = info;
      games[game.away] = info;
    }
    const richGames = mergeGames(scoreboardGames(cdnScoreboard.content?.sbData ?? {}), scoreboardGames(scoreboard));

    const result: WeekData = {
      season,
      week: data.week,
      currentWeek,
      stats: mapStats(stats),
      projections: mapStats(projections),
      games: mergeGames(games, richGames),
    };
    const feedDown =
      Object.keys(result.stats).length === 0 && Object.keys(result.projections).length === 0;
    const lastGood = lastGoodCache.get(key);
    if (feedDown && lastGood) return { ...lastGood, stale: true };
    if (!feedDown) {
      lastGoodCache.set(key, result);
      cache.set(key, { at: Date.now(), data: result });
    }
    return result;
  });

/**
 * The hosted server can occasionally receive a reduced scoreboard response.
 * Use a same-origin schedule endpoint as a second path for kickoff times,
 * networks and live possession without discarding score data.
 */
export async function enrichWeekDataInBrowser(data: WeekData): Promise<WeekData> {
  if (typeof window === "undefined") return data;
  try {
    const params = new URLSearchParams({ week: String(data.week), season: data.season });
    const response = await fetch(`/api/public/nfl-schedule?${params}`);
    if (!response.ok) return data;
    const scoreboard = (await response.json()) as Scoreboard;
    const games = scoreboardGames(scoreboard);
    if (Object.keys(games).length === 0) return data;
    return { ...data, games: mergeGames(data.games, games) };
  } catch {
    return data;
  }
}
