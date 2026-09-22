import { createServerFn } from "@tanstack/react-start";
import type { StatLine } from "./fantasy/scoring";

export type GameInfo = { status: "final" | "live" | "scheduled" | "none"; label: string };

export type WeekData = {
  season: string;
  week: number;
  currentWeek: number;
  stats: Record<string, StatLine>;
  projections: Record<string, StatLine>;
  games: Record<string, GameInfo>;
};

const EMPTY: StatLine = {
  passYd: 0,
  passTd: 0,
  interception: 0,
  rushYd: 0,
  rushTd: 0,
  reception: 0,
  recYd: 0,
  recTd: 0,
  fumble: 0,
  fgMade: 0,
  xpMade: 0,
  defSack: 0,
  defInt: 0,
  defTd: 0,
};

type Raw = Record<string, Record<string, number>>;

function toStatLine(raw: Record<string, number> | undefined): StatLine | null {
  if (!raw) return null;
  const line: StatLine = {
    ...EMPTY,
    passYd: raw["pass_yd"] ?? 0,
    passTd: raw["pass_td"] ?? 0,
    interception: raw["pass_int"] ?? 0,
    rushYd: raw["rush_yd"] ?? 0,
    rushTd: raw["rush_td"] ?? 0,
    reception: raw["rec"] ?? 0,
    recYd: raw["rec_yd"] ?? 0,
    recTd: raw["rec_td"] ?? 0,
    fumble: raw["fum_lost"] ?? 0,
    fgMade: raw["fgm"] ?? 0,
    xpMade: raw["xpm"] ?? 0,
    defSack: raw["sack"] ?? 0,
    defInt: raw["int"] ?? 0,
    defTd: (raw["def_td"] ?? 0) + (raw["def_st_td"] ?? 0),
  };
  const any = Object.values(line).some((v) => v !== 0);
  return any ? line : null;
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
    const key = `${season}-${data.week}`;

    const hit = cache.get(key);
    const ttl = data.week < currentWeek ? 1000 * 60 * 60 * 6 : 1000 * 60 * 2;
    if (hit && Date.now() - hit.at < ttl) return hit.data;

    const [stats, projections, schedule] = await Promise.all([
      json<Raw>(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${data.week}`, {}),
      json<Raw>(`https://api.sleeper.app/v1/projections/nfl/regular/${season}/${data.week}`, {}),
      json<ScheduleGame[]>(`https://api.sleeper.app/schedule/nfl/regular/${season}`, []),
    ]);

    const games: Record<string, GameInfo> = {};
    for (const game of schedule) {
      if (game.week !== data.week) continue;
      const info = gameLabel(game);
      games[game.home] = info;
      games[game.away] = info;
    }

    const result: WeekData = {
      season,
      week: data.week,
      currentWeek,
      stats: mapStats(stats),
      projections: mapStats(projections),
      games,
    };
    cache.set(key, { at: Date.now(), data: result });
    return result;
  });
