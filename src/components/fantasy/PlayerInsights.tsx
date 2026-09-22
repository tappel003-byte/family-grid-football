import { createContext, useContext, type ReactNode } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { CalendarOff, Flame, Shield, Snowflake } from "lucide-react";
import { getInsights, type InsightsData } from "@/lib/insights.functions";
import type { Scoring } from "@/lib/fantasy/scoring";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { cn } from "@/lib/utils";

export const insightsQueryOptions = (week: number, scoring: Scoring) =>
  queryOptions({
    queryKey: ["nfl-insights", week, scoring],
    queryFn: () => getInsights({ data: { week, scoring } }),
    staleTime: 1000 * 60 * 30,
  });

const InsightsContext = createContext<InsightsData | null>(null);

/** Loads recent form, bye weeks and matchup ratings once for a whole page. */
export function InsightsProvider({
  week,
  scoring,
  children,
}: {
  week: number;
  scoring: Scoring;
  children: ReactNode;
}) {
  const { data } = useQuery(insightsQueryOptions(week, scoring));
  return <InsightsContext.Provider value={data ?? null}>{children}</InsightsContext.Provider>;
}

export function useInsights() {
  return useContext(InsightsContext);
}

export type MatchupGrade = { grade: "great" | "even" | "tough"; rank: number; label: string };

export function matchupFor(
  data: InsightsData | null,
  player: SlimPlayer,
): { opponent: string | null; home: boolean; grade: MatchupGrade | null } | null {
  if (!data) return null;
  const game = data.matchups[player.team];
  if (!game?.opponent) return null;
  const rank = data.defenseRank[player.pos]?.[game.opponent] ?? null;
  let grade: MatchupGrade | null = null;
  if (rank) {
    if (rank <= 10) grade = { grade: "great", rank, label: "Great matchup" };
    else if (rank >= 23) grade = { grade: "tough", rank, label: "Tough matchup" };
    else grade = { grade: "even", rank, label: "Even matchup" };
  }
  return { opponent: game.opponent, home: game.home, grade };
}

/** True when this player's NFL team is off this week. */
export function isOnBye(data: InsightsData | null, player: SlimPlayer, week: number) {
  return !!data && data.byes[player.team] === week;
}

const CHIP = "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold";

export function PlayerInsightChips({
  player,
  week,
  showMatchup = true,
}: {
  player: SlimPlayer;
  week: number;
  showMatchup?: boolean;
}) {
  const data = useInsights();
  if (!data) return null;
  const info = data.players[player.id];
  const bye = isOnBye(data, player, week);
  const m = showMatchup ? matchupFor(data, player) : null;
  const trend = info ? info.last3Avg - info.seasonAvg : 0;
  const hasForm = !!info && (info.games > 0 || info.last3.length > 0);

  if (!bye && !hasForm && !m) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {bye && (
        <span
          className={cn(CHIP, "bg-injury-questionable text-injury-questionable-foreground")}
          title={`${player.team} does not play in week ${week} — this player scores 0 points`}
        >
          <CalendarOff className="h-3 w-3" /> BYE week {week}
        </span>
      )}
      {hasForm && (
        <span
          className={cn(CHIP, "bg-secondary text-secondary-foreground")}
          title={`Average fantasy points over the last 3 games: ${info!.last3Avg.toFixed(1)} · Season average: ${info!.seasonAvg.toFixed(1)} per game${
            trend >= 2 ? " · Playing hot lately" : trend <= -2 ? " · Cooling off lately" : ""
          }`}
        >
          {trend >= 2 ? (
            <Flame className="h-3 w-3 text-injury-out" />
          ) : trend <= -2 ? (
            <Snowflake className="h-3 w-3 text-primary" />
          ) : null}
          L3 {info!.last3Avg.toFixed(1)} · season {info!.seasonAvg.toFixed(1)}
        </span>
      )}
      {info && info.snapPct !== null && player.pos !== "DEF" && player.pos !== "K" && (
        <span
          className={cn(CHIP, "bg-secondary text-secondary-foreground")}
          title={`Has played ${info.snapPct}% of his team's offensive snaps this season${
            info.targets > 0 ? ` · Averages ${info.targets.toFixed(1)} targets per game` : ""
          }`}
        >
          {info.snapPct}% snaps
          {info.targets > 0 ? ` · ${info.targets.toFixed(1)} tgt` : ""}
        </span>
      )}
      {m?.grade && (
        <span
          className={cn(
            CHIP,
            m.grade.grade === "great" && "bg-emerald-600 text-white",
            m.grade.grade === "even" && "bg-secondary text-secondary-foreground",
            m.grade.grade === "tough" && "bg-injury-out text-injury-out-foreground",
          )}
          title={`${m.opponent} allows the ${ordinal(m.grade.rank)} most points to ${player.pos}s`}
        >
          <Shield className="h-3 w-3" />
          {m.home ? "vs" : "@"} {m.opponent} · {m.grade.label}
        </span>
      )}
    </div>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? "th"}`;
}
