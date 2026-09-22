/** Server-only helpers that pull raw NFL data from Sleeper for research features. */

export type RawWeek = Record<string, Record<string, number>>;
export type ScheduleGame = { status: string; date: string; home: string; away: string; week: number };
export type PlayerMeta = { pos: string; team: string };

async function json<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

let metaCache: { at: number; map: Record<string, PlayerMeta> } | null = null;
const META_TTL = 1000 * 60 * 60 * 6;

export async function loadPlayerMeta(): Promise<Record<string, PlayerMeta>> {
  if (metaCache && Date.now() - metaCache.at < META_TTL) return metaCache.map;
  const raw = await json<
    Record<
      string,
      { position?: string; team?: string | null; fantasy_positions?: string[] | null }
    >
  >("https://api.sleeper.app/v1/players/nfl", {});
  const map: Record<string, PlayerMeta> = {};
  for (const [id, p] of Object.entries(raw)) {
    const declared = p.position ?? "";
    const pos = FANTASY_POSITIONS.has(declared)
      ? declared
      : ((p.fantasy_positions ?? []).find((f) => FANTASY_POSITIONS.has(f)) ?? "");
    if (!pos || !p.team) continue;
    map[id] = { pos, team: p.team };
  }
  metaCache = { at: Date.now(), map };
  return map;
}

const weekCache = new Map<string, { at: number; raw: RawWeek }>();

export async function loadWeekRaw(season: string, week: number): Promise<RawWeek> {
  const key = `${season}-${week}`;
  const hit = weekCache.get(key);
  if (hit && Date.now() - hit.at < 1000 * 60 * 30) return hit.raw;
  const raw = await json<RawWeek>(
    `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`,
    {},
  );
  weekCache.set(key, { at: Date.now(), raw });
  return raw;
}

let seasonCache: { at: number; season: string; raw: RawWeek } | null = null;

export async function loadSeasonRaw(season: string): Promise<RawWeek> {
  if (seasonCache && seasonCache.season === season && Date.now() - seasonCache.at < 1000 * 60 * 30)
    return seasonCache.raw;
  const raw = await json<RawWeek>(`https://api.sleeper.app/v1/stats/nfl/regular/${season}`, {});
  seasonCache = { at: Date.now(), season, raw };
  return raw;
}

let scheduleCache: { at: number; season: string; games: ScheduleGame[] } | null = null;

export async function loadSchedule(season: string): Promise<ScheduleGame[]> {
  if (scheduleCache && scheduleCache.season === season && Date.now() - scheduleCache.at < 1000 * 60 * 60)
    return scheduleCache.games;
  const games = await json<ScheduleGame[]>(
    `https://api.sleeper.app/schedule/nfl/regular/${season}`,
    [],
  );
  scheduleCache = { at: Date.now(), season, games };
  return games;
}

export async function loadState(): Promise<{ season: string; week: number }> {
  const state = await json<{ season?: string; week?: number; display_week?: number }>(
    "https://api.sleeper.app/v1/state/nfl",
    {},
  );
  return {
    season: state.season ?? String(new Date().getUTCFullYear()),
    week: state.display_week ?? state.week ?? 1,
  };
}
