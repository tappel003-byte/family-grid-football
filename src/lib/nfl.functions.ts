import { createServerFn } from "@tanstack/react-start";
import { ZERO_STATS, type StatLine } from "./fantasy/scoring";

export type GameInfo = { status: "final" | "live" | "scheduled" | "none"; label: string };

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
  if (!raw) return null;
  const n = (key: string): number => {
    const num = Number(raw[key] ?? 0);
    return Number.isFinite(num) ? num : 0;
  };
  const line: StatLine = {
    ...EMPTY,
    passYd: n("pass_yd"),
    passTd: n("pass_td"),
    interception: n("pass_int"),
    rushYd: n("rush_yd"),
    rushTd: n("rush_td"),
    reception: n("rec"),
    recYd: n("rec_yd"),
    recTd: n("rec_td"),
    fumble: n("fum_lost"),
    twoPt: n("pass_2pt") + n("rush_2pt") + n("rec_2pt"),
    fgMade: n("fgm"),
    fg0_39: n("fgm_0_19") + n("fgm_20_29") + n("fgm_30_39"),
    fg40_49: n("fgm_40_49"),
    fg50: n("fgm_50p"),
    fgMiss: n("fgmiss"),
    xpMade: n("xpm"),
    xpMiss: n("xpmiss"),
    defSack: n("sack"),
    defInt: n("int"),
    defFumRec: n("fum_rec"),
    defSafety: n("safe"),
    defTd: n("def_td") + n("def_st_td") + n("st_td"),
    defBlockKick: n("blk_kick"),
    ptsAllow0: n("pts_allow_0"),
    ptsAllow1_6: n("pts_allow_1_6"),
    ptsAllow7_13: n("pts_allow_7_13"),
    ptsAllow14_17: n("pts_allow_14_20"),
    ptsAllow18_21: 0,
    ptsAllow22_27: n("pts_allow_21_27"),
    ptsAllow28_34: n("pts_allow_28_34"),
    ptsAllow35_45: n("pts_allow_35p"),
    ptsAllow46: 0,
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
