/** Server-side view of which players are already locked because their game started. */

type Scoreboard = {
  events?: Array<{
    status?: { type?: { state?: string; completed?: boolean } };
    competitions?: Array<{ competitors?: Array<{ team?: { abbreviation?: string } }> }>;
  }>;
};

type RawPlayer = { player_id?: string; team?: string | null };

const TEAM_TTL = 1000 * 60 * 5;
const ROSTER_TTL = 1000 * 60 * 60 * 6;

let lockedTeams: { at: number; week: number; teams: Set<string> } | null = null;
let playerTeams: { at: number; map: Map<string, string> } | null = null;

async function json<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
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
