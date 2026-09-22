import { queryOptions, useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getPlayers, getTrending, type SlimPlayer } from "../sleeper.functions";
import { buildLeague, type League } from "./league";
import { hydrateLeague, leagueStatus, setLeague, useLeagueStore } from "./store";
import { getWeekData, type WeekData } from "../nfl.functions";
import { scoreStats, ZERO_STATS, type StatLine } from "./scoring";

const ZERO: StatLine = ZERO_STATS;

/** Latest real NFL week data, kept here so score helpers stay simple to call. */
const weekCache = new Map<number, WeekData>();

export const weekDataQueryOptions = (week: number) =>
  queryOptions({
    queryKey: ["nfl-week", week],
    queryFn: () => getWeekData({ data: { week } }),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 2,
  });

/** Loads the real stats, projections and game status for a week. */
export function useWeekData(week: number): WeekData {
  const { data } = useSuspenseQuery(weekDataQueryOptions(week));
  weekCache.set(week, data);
  return data;
}

/** Loads real week data for weeks 1..count (used by standings). */
export function useWeeksData(count: number): WeekData[] {
  const weeks = Array.from({ length: Math.max(0, Math.min(18, count)) }, (_, i) => i + 1);
  const results = useSuspenseQueries({
    queries: weeks.map((w) => weekDataQueryOptions(w)),
  });
  const data = results.map((r) => r.data);
  for (const d of data) weekCache.set(d.week, d);
  return data;
}

export const playersQueryOptions = queryOptions({
  queryKey: ["nfl-players"],
  queryFn: () => getPlayers(),
  staleTime: 1000 * 60 * 60,
});

export const trendingQueryOptions = (type: "add" | "drop") =>
  queryOptions({
    queryKey: ["nfl-trending", type],
    queryFn: () => getTrending({ data: { type } }),
    staleTime: 1000 * 60 * 15,
  });

export function usePlayers() {
  const { data } = useSuspenseQuery(playersQueryOptions);
  const byId = useMemo(() => new Map(data.map((p) => [p.id, p])), [data]);
  return { players: data, byId };
}

/** Players plus the shared family league, loaded from the cloud for everyone. */
export function useLeague() {
  const { players, byId } = usePlayers();
  const league = useLeagueStore();

  useEffect(() => {
    let cancelled = false;
    void hydrateLeague().then((loaded) => {
      if (cancelled) return;
      if (!loaded && players.length && leagueStatus() === "ready") {
        setLeague(buildLeague(players, 10));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [players]);

  return { league, players, byId };
}

export type PlayerScore = {
  projected: number;
  actual: number;
  status: string;
};

export function scoreFor(player: SlimPlayer, week: number, league: League): PlayerScore {
  const data = weekCache.get(week);
  const projected = scoreStats(data?.projections[player.id] ?? ZERO, league.scoring);
  const actual = scoreStats(data?.stats[player.id] ?? ZERO, league.scoring);
  const game = data?.games[player.team];
  return {
    projected,
    actual,
    status: game ? game.label : "Bye",
  };
}

export function headshotUrl(id: string, pos: string, team: string) {
  return pos === "DEF"
    ? `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`
    : `https://sleepercdn.com/content/nfl/players/thumb/${id}.jpg`;
}

export function teamLogoUrl(team: string) {
  return `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;
}
