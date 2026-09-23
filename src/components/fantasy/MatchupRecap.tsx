import type { FantasyTeam, League } from "@/lib/fantasy/league";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { scoreFor } from "@/lib/fantasy/hooks";
import { teamTotals } from "./MatchupBoard";

export function MatchupRecap({ league, home, away, week, byId }: { league: League; home: FantasyTeam; away: FantasyTeam; week: number; byId: Map<string, SlimPlayer> }) {
  if (week >= league.currentWeek) return null;
  const h = teamTotals(home, week, league, byId);
  const a = teamTotals(away, week, league, byId);
  const winner = h.actual === a.actual ? null : h.actual > a.actual ? home : away;
  const margin = Math.abs(h.actual - a.actual).toFixed(1);
  const all = [...home.starters, ...away.starters].map((id) => id ? byId.get(id) : undefined).filter((p): p is SlimPlayer => Boolean(p));
  const star = all.sort((x, y) => scoreFor(y, week, league).actual - scoreFor(x, week, league).actual)[0];
  return <aside className="mt-4 rounded-lg border-l-4 border-primary bg-secondary/60 px-4 py-3"><p className="font-display text-sm font-bold uppercase text-primary">Week {week} recap</p><p className="mt-1 text-base">{winner ? `${winner.name} won by ${margin} points.` : "This matchup ended in a tie."}{star ? ` ${star.name} led the matchup with ${scoreFor(star, week, league).actual.toFixed(1)} points.` : ""}</p></aside>;
}