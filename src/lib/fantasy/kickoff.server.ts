/** Server-side source of truth for player kickoff and waiver availability. */

import { availabilityFromKickoffs, type PlayerAvailability } from "./player-availability";

type Scoreboard = {
  events?: Array<{
    date?: string;
    status?: { type?: { state?: string; completed?: boolean } };
    competitions?: Array<{ competitors?: Array<{ team?: { abbreviation?: string } }> }>;
  }>;
};

type RawPlayer = { player_id?: string; team?: string | null };

const TEAM_TTL = 1000 * 60 * 5;
const ROSTER_TTL = 1000 * 60 * 60 * 6;

let lockedTeams: { at: number; week: number; teams: Set<string> } | null = null;
let playerTeams: { at: number; map: Map<string, string> } | null = null;
const scoreboardCache = new Map<number, { at: number; board: Scoreboard }>();

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

async function teamsInProgress(week: number): Promise<Set<string>> {
  if (lockedTeams && lockedTeams.week === week && Date.now() - lockedTeams.at < TEAM_TTL) {
    return lockedTeams.teams;
  }
  const season = String(new Date().getUTCFullYear());
  const board = await json<Scoreboard>(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`,
    {},
  );
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
  lockedTeams = { at: Date.now(), week, teams };
  return teams;
}

async function scoreboardFor(week: number): Promise<Scoreboard | null> {
  const hit = scoreboardCache.get(week);
  if (hit && Date.now() - hit.at < TEAM_TTL) return hit.board;
  const season = String(new Date().getUTCFullYear());
  const primary = await json<Scoreboard | null>(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`,
    null,
  );
  if (primary?.events?.length) {
    scoreboardCache.set(week, { at: Date.now(), board: primary });
    return primary;
  }
  const cdn = await json<{ content?: { sbData?: Scoreboard } } | null>(
    `https://cdn.espn.com/core/nfl/scoreboard?xhr=1&year=${season}&week=${week}&seasontype=2`,
    null,
  );
  const fallback = cdn?.content?.sbData;
  if (fallback?.events?.length) {
    scoreboardCache.set(week, { at: Date.now(), board: fallback });
    return fallback;
  }
  return null;
}

async function playerTeamMap(): Promise<Map<string, string>> {
  if (playerTeams && Date.now() - playerTeams.at < ROSTER_TTL) return playerTeams.map;
  const raw = await json<Record<string, RawPlayer>>(
    "https://api.sleeper.app/v1/players/nfl",
    {},
  );
  const map = new Map<string, string>();
  for (const p of Object.values(raw)) {
    if (p.player_id && p.team) map.set(p.player_id, p.team);
  }
  playerTeams = { at: Date.now(), map };
  return map;
}

/** True when this player's game for the week has already started. */
export async function lockedChecker(week: number): Promise<(playerId: string | null) => boolean> {
  const [teams, map] = await Promise.all([teamsInProgress(week), playerTeamMap()]);
  if (teams.size === 0) return () => false;
  return (playerId) => {
    if (!playerId) return false;
    const team = map.get(playerId);
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
  const weeks = [week, week - 1, week - 2].filter((value) => value >= 1);
  const [map, ...boards] = await Promise.all([
    playerTeamMap(),
    ...weeks.map((value) => scoreboardFor(value)),
  ]);
  if (boards.every((board) => board === null)) {
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
    if (!team) return "free-agent";
    return availabilityFromKickoffs(kickoffsByTeam.get(team) ?? [], now);
  };
}
