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

let espnIdCache: { at: number; map: Record<string, string> } | null = null;

/** Maps ESPN athlete id -> Sleeper player id, so national data can be joined. */
const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");

const ESPN_POS: Record<number, string> = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K" };

/** ESPN ID → Sleeper ID. Uses Sleeper's espn_id first, then falls back to a
 *  unique name + position match for players Sleeper left blank. */
export async function loadEspnIdMap(): Promise<Record<string, string>> {
  if (espnIdCache && Date.now() - espnIdCache.at < META_TTL) return espnIdCache.map;
  const raw = await json<
    Record<
      string,
      {
        espn_id?: number | string | null;
        full_name?: string | null;
        position?: string | null;
        active?: boolean;
      }
    >
  >("https://api.sleeper.app/v1/players/nfl", {});
  const map: Record<string, string> = {};
  const linkedSleeper = new Set<string>();
  for (const [id, p] of Object.entries(raw)) {
    if (p.espn_id) {
      map[String(p.espn_id)] = id;
      linkedSleeper.add(id);
    }
  }

  // Suspenders: name + position fallback for unlinked players.
  try {
    const bucket = new Map<string, string[]>();
    for (const [id, p] of Object.entries(raw)) {
      if (linkedSleeper.has(id) || !p.full_name || !p.position || p.active === false) continue;
      const key = `${normName(p.full_name)}|${p.position}`;
      const arr = bucket.get(key) ?? [];
      arr.push(id);
      bucket.set(key, arr);
    }
    const season = String(new Date().getUTCFullYear());
    const res = await fetch(
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/players?view=players_wl`,
      {
        headers: {
          accept: "application/json",
          "user-agent": "curl/8.0",
          "x-fantasy-filter": JSON.stringify({ filterActive: { value: true } }),
        },
      },
    );
    if (res.ok) {
      const espn = (await res.json()) as {
        id?: number;
        fullName?: string;
        defaultPositionId?: number;
      }[];
      const espnCount = new Map<string, number>();
      const keyed: [string, string][] = [];
      for (const e of espn) {
        const pos = e.defaultPositionId ? ESPN_POS[e.defaultPositionId] : undefined;
        if (!e.id || !e.fullName || !pos || map[String(e.id)]) continue;
        const key = `${normName(e.fullName)}|${pos}`;
        espnCount.set(key, (espnCount.get(key) ?? 0) + 1);
        keyed.push([String(e.id), key]);
      }
      for (const [espnId, key] of keyed) {
        const hits = bucket.get(key);
        const only = hits?.length === 1 ? hits[0] : undefined;
        if (only && espnCount.get(key) === 1) map[espnId] = only;
      }
    }
  } catch {
    // fallback is best-effort
  }

  espnIdCache = { at: Date.now(), map };
  return map;
}
