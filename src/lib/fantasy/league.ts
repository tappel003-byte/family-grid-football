import type { SlimPlayer } from "../sleeper.functions";
import { PPR_SCORING, type Scoring } from "./scoring";

export const SLOTS = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"] as const;
export const BENCH_SIZE = 6;
export const FLEX_POSITIONS = ["RB", "WR", "TE"];
export const WEEKS = Array.from({ length: 18 }, (_, i) => i + 1);

export type FantasyTeam = {
  id: string;
  name: string;
  owner: string;
  color: string;
  starters: Array<string | null>;
  bench: string[];
};

export type League = {
  version: number;
  name: string;
  currentWeek: number;
  scoring: Scoring;
  teams: FantasyTeam[];
  /** schedule[week-1] = array of [homeTeamIndex, awayTeamIndex] */
  schedule: Array<Array<[number, number]>>;
};

export const LEAGUE_VERSION = 3;

const TEAM_NAMES = [
  ["Grandpa's Gridiron", "Papa Ray"],
  ["Aunt Deb's Dynasty", "Deb"],
  ["Cousin Carter's Crew", "Carter"],
  ["Mom's Monsters", "Linda"],
  ["Uncle Joe's Jets", "Joe"],
  ["Sister Sam Slingers", "Sam"],
  ["Dad Bod Dominators", "Tim"],
  ["Nana's Nightmares", "Nana Jo"],
  ["Little Leo's Legends", "Leo"],
  ["The Thanksgiving Titans", "Uncle Rick"],
];

const COLORS = [
  "#1d4ed8",
  "#b91c1c",
  "#047857",
  "#b45309",
  "#7c3aed",
  "#be185d",
  "#0e7490",
  "#4d7c0f",
  "#c2410c",
  "#334155",
];

export function makeSchedule(teamCount: number): Array<Array<[number, number]>> {
  const idx = Array.from({ length: teamCount }, (_, i) => i);
  const rounds: Array<Array<[number, number]>> = [];
  const n = teamCount;
  const rotate = [...idx];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = rotate[i]!;
      const b = rotate[n - 1 - i]!;
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    const fixed = rotate[0]!;
    const rest = rotate.slice(1);
    rest.unshift(rest.pop()!);
    rotate.splice(0, rotate.length, fixed, ...rest);
  }
  return WEEKS.map((_, w) => rounds[w % rounds.length]!);
}

const NEEDS: Record<string, number> = { QB: 2, RB: 5, WR: 5, TE: 2, K: 1, DEF: 1 };

export function buildLeague(players: SlimPlayer[], teamCount = 10): League {
  const pool: Record<string, SlimPlayer[]> = {};
  for (const p of players) (pool[p.pos] ??= []).push(p);
  for (const list of Object.values(pool)) list.sort((a, b) => a.rank - b.rank);
  const cursor: Record<string, number> = {};

  const take = (pos: string): SlimPlayer | null => {
    const list = pool[pos] ?? [];
    const i = cursor[pos] ?? 0;
    cursor[pos] = i + 1;
    return list[i] ?? null;
  };

  const rosters: SlimPlayer[][] = Array.from({ length: teamCount }, () => []);
  const order = ["RB", "WR", "QB", "WR", "RB", "TE", "RB", "WR", "QB", "TE", "RB", "WR", "K", "DEF"];
  for (let round = 0; round < order.length; round++) {
    const pos = order[round]!;
    const seq = round % 2 === 0 ? rosters : [...rosters].reverse();
    for (const roster of seq) {
      const picked = take(pos);
      if (picked) roster.push(picked);
    }
  }

  const teams: FantasyTeam[] = rosters.map((roster, i) => {
    const entry = TEAM_NAMES[i % TEAM_NAMES.length]!;
    const team: FantasyTeam = {
      id: `team-${i + 1}`,
      name: entry[0],
      owner: entry[1],
      color: COLORS[i % COLORS.length]!,
      starters: SLOTS.map(() => null),
      bench: [],
    };
    const ids = roster.map((p) => p.id);
    const byId = new Map(roster.map((p) => [p.id, p]));
    fillLineup(team, ids, byId);
    return team;
  });

  return {
    version: LEAGUE_VERSION,
    name: "The Appel Family League",
    currentWeek: 3,
    scoring: { ...PPR_SCORING },
    teams,
    schedule: makeSchedule(teamCount),
  };
}

function fillLineup(team: FantasyTeam, ids: string[], byId: Map<string, SlimPlayer>) {
  const used = new Set<string>();
  team.starters = SLOTS.map((slot) => {
    const match = ids.find((id) => {
      if (used.has(id)) return false;
      const p = byId.get(id);
      if (!p) return false;
      return slot === "FLEX" ? FLEX_POSITIONS.includes(p.pos) : p.pos === slot;
    });
    if (match) used.add(match);
    return match ?? null;
  });
  team.bench = ids.filter((id) => !used.has(id)).slice(0, BENCH_SIZE);
}

export function slotAccepts(slot: string, pos: string): boolean {
  return slot === "FLEX" ? FLEX_POSITIONS.includes(pos) : slot === pos;
}

export function rosterIds(team: FantasyTeam): string[] {
  return [...team.starters.filter((x): x is string => !!x), ...team.bench];
}

export { NEEDS };
