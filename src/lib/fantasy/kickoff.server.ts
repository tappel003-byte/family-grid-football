/** Server-side source of truth for player kickoff and waiver availability. */

import { availabilityFromKickoffs, type PlayerAvailability } from "./player-availability";

type Scoreboard = {
  events?: Array<{
    date?: string;
    status?: { type?: { state?: string; completed?: boolean } };
    competitions?: Array<{ competitors?: Array<{ team?: { abbreviation?: string } }> }>;
  }>;
};

type RawPlayer = { player_id?: string; team?: string | null; position?: string | null };

const TEAM_TTL = 1000 * 60 * 5;
const ROSTER_TTL = 1000 * 60 * 60 * 6;

let playerInfo: { at: number; teams: Map<string, string>; positions: Map<string, string> } | null = null;
const scoreboardCache = new Map<string, { at: number; board: Scoreboard }>();

/** ESPN rejects header-less server requests with 403, so always identify ourselves. */
const FEED_HEADERS = { Accept: "application/json", "User-Agent": "curl/8.0" };

async function json<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { headers: FEED_HEADERS });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

/** The NFL season label (Weeks 17-18 are played in January of the next year). */
async function currentSeason(): Promise<{ season: string; week: number | null }> {
  const state = await json<{ season?: string; week?: number } | null>(
    "https://api.sleeper.app/v1/state/nfl",
    null,
  );
  return {
    season: state?.season ?? String(new Date().getUTCFullYear()),
    week: typeof state?.week === "number" ? state.week : null,
  };
}

async function scoreboardFor(week: number, season: string): Promise<Scoreboard | null> {
  const key = `${season}-${week}`;
  const hit = scoreboardCache.get(key);
  if (hit && Date.now() - hit.at < TEAM_TTL) return hit.board;
  const primary = await json<Scoreboard | null>(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`,
    null,
  );
  if (primary?.events?.length) {
    scoreboardCache.set(key, { at: Date.now(), board: primary });
    return primary;
  }
  const cdn = await json<{ content?: { sbData?: Scoreboard } } | null>(
    `https://cdn.espn.com/core/nfl/scoreboard?xhr=1&year=${season}&week=${week}&seasontype=2`,
    null,
  );
  const fallback = cdn?.content?.sbData;
  if (fallback?.events?.length) {
    scoreboardCache.set(key, { at: Date.now(), board: fallback });
    return fallback;
  }
  return null;
}

async function loadPlayerInfo() {
  if (playerInfo && Date.now() - playerInfo.at < ROSTER_TTL) return playerInfo;
  const raw = await json<Record<string, RawPlayer>>("https://api.sleeper.app/v1/players/nfl", {});
  const teams = new Map<string, string>();
  const positions = new Map<string, string>();
  for (const p of Object.values(raw)) {
    if (!p.player_id) continue;
    if (p.team) teams.set(p.player_id, p.team);
    if (p.position) positions.set(p.player_id, p.position);
  }
  if (teams.size > 0) playerInfo = { at: Date.now(), teams, positions };
  return { at: Date.now(), teams, positions };
}

async function playerTeamMap(): Promise<Map<string, string>> {
  return (await loadPlayerInfo()).teams;
}

/** Position for each player id (team defenses use their abbreviation as id). Empty if the feed is down. */
export async function playerPositionMap(): Promise<Map<string, string>> {
  return (await loadPlayerInfo()).positions;
}

/**
 * True when this player's game for the week has already started. Fails safely:
 * if the schedule can't be read, it throws instead of unlocking everyone.
 */
export async function lockedChecker(week: number): Promise<(playerId: string | null) => boolean> {
  const { season } = await currentSeason();
  const [board, map] = await Promise.all([scoreboardFor(week, season), playerTeamMap()]);
  if (!board || map.size === 0) {
    throw new Error("Game times are temporarily unavailable. Please try again in a moment.");
  }
  const teams = new Set<string>();
  for (const event of board.events ?? []) {
    const state = event.status?.type?.state;
    const started = event.status?.type?.completed === true || state === "in" || state === "post";
    if (!started) continue;
    for (const competitor of event.competitions?.[0]?.competitors ?? []) {
      const abbr = competitor.team?.abbreviation;
      if (abbr) teams.add(abbr === "WSH" ? "WAS" : abbr);
    }
  }
  return (playerId) => {
    if (!playerId) return false;
    const team = map.get(playerId) ?? (playerId.length <= 3 ? playerId : undefined);
    return !!team && teams.has(team);
  };
}

/**
 * Returns Claim from a player's latest actual kickoff until the following
 * Wednesday run, then Add until his next kickoff. Looking back two weeks
 * correctly handles Tuesday week rollovers and NFL bye weeks.
 */
export async function availabilityChecker(
  week: number,
  now: number = Date.now(),
): Promise<(playerId: string | null) => PlayerAvailability> {
  const state = await currentSeason();
  const season = state.season;
  const actualWeek = Math.max(week, Number(state.week ?? week));
  const weeks = [actualWeek, actualWeek - 1, actualWeek - 2].filter((value) => value >= 1);
  const [map, ...boards] = await Promise.all([
    playerTeamMap(),
    ...weeks.map((value) => scoreboardFor(value, season)),
  ]);
  if (map.size === 0 || boards.every((board) => board === null)) {
    throw new Error("Player availability is temporarily unavailable. Please try again in a moment.");
  }

  const kickoffsByTeam = new Map<string, string[]>();
  for (const board of boards) {
    for (const event of board?.events ?? []) {
      if (!event.date) continue;
      for (const competitor of event.competitions?.[0]?.competitors ?? []) {
        const raw = competitor.team?.abbreviation;
        if (!raw) continue;
        const team = raw === "WSH" ? "WAS" : raw;
        const values = kickoffsByTeam.get(team) ?? [];
        values.push(event.date);
        kickoffsByTeam.set(team, values);
      }
    }
  }

  return (playerId) => {
    if (!playerId) return "free-agent";
    const rosterTeam = map.get(playerId);
    const team = rosterTeam ?? (playerId.length <= 3 ? playerId : undefined);
    if (!team) return "waiver";
    const kickoffs = kickoffsByTeam.get(team);
    if (!kickoffs) return "waiver";
    return availabilityFromKickoffs(kickoffs, now);
  };
}
