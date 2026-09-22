import { createServerFn } from "@tanstack/react-start";

export type SlimPlayer = {
  id: string;
  name: string;
  pos: string;
  team: string;
  injury: string | null;
  rank: number;
  age: number | null;
  number: number | null;
};

type RawPlayer = {
  player_id?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string | null;
  injury_status?: string | null;
  search_rank?: number | null;
  age?: number | null;
  number?: number | null;
  active?: boolean;
};

const FANTASY_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF"]);

let cache: { at: number; players: SlimPlayer[] } | null = null;
const TTL = 1000 * 60 * 60 * 6;

export const getPlayers = createServerFn({ method: "GET" }).handler(
  async (): Promise<SlimPlayer[]> => {
    if (cache && Date.now() - cache.at < TTL) return cache.players;

    const res = await fetch("https://api.sleeper.app/v1/players/nfl");
    if (!res.ok) throw new Error(`Sleeper players request failed (${res.status})`);
    const raw = (await res.json()) as Record<string, RawPlayer>;

    const players: SlimPlayer[] = [];
    for (const p of Object.values(raw)) {
      const pos = p.position ?? "";
      if (!p.player_id || !FANTASY_POSITIONS.has(pos)) continue;
      if (!p.team) continue;
      const name = p.full_name ?? [p.first_name, p.last_name].filter(Boolean).join(" ");
      if (!name) continue;
      players.push({
        id: p.player_id,
        name,
        pos,
        team: p.team,
        injury: p.injury_status && p.injury_status.length ? p.injury_status : null,
        rank: p.search_rank && p.search_rank > 0 ? p.search_rank : 9999,
        age: p.age ?? null,
        number: p.number ?? null,
      });
    }
    players.sort((a, b) => a.rank - b.rank);
    const trimmed = players.slice(0, 900);
    cache = { at: Date.now(), players: trimmed };
    return trimmed;
  },
);

export type TrendingEntry = { id: string; count: number };

export const getTrending = createServerFn({ method: "GET" })
  .inputValidator((data: { type: "add" | "drop" }) => ({
    type: data.type === "drop" ? ("drop" as const) : ("add" as const),
  }))
  .handler(async ({ data }): Promise<TrendingEntry[]> => {
    const res = await fetch(
      `https://api.sleeper.app/v1/players/nfl/trending/${data.type}?lookback_hours=24&limit=25`,
    );
    if (!res.ok) return [];
    const json = (await res.json()) as Array<{ player_id: string; count: number }>;
    return json.map((e) => ({ id: e.player_id, count: e.count }));
  });
