import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { getPlayers, getTrending, type SlimPlayer } from "../sleeper.functions";
import { buildLeague, type League } from "./league";
import { setLeague, useLeagueStore } from "./store";
import { actualStats, gameStatusLabel, projectedStats } from "./projections";
import { scoreStats } from "./scoring";

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

/** Players plus the family league, creating a fresh league on first visit. */
export function useLeague() {
  const { players, byId } = usePlayers();
  const league = useLeagueStore();

  useEffect(() => {
    if (!league && players.length) setLeague(buildLeague(players, 10));
  }, [league, players]);

  return { league, players, byId };
}

export type PlayerScore = {
  projected: number;
  actual: number;
  status: string;
};

export function scoreFor(player: SlimPlayer, week: number, league: League): PlayerScore {
  return {
    projected: scoreStats(projectedStats(player, week), league.scoring),
    actual: scoreStats(actualStats(player, week, league.currentWeek), league.scoring),
    status: gameStatusLabel(player, week, league.currentWeek),
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
