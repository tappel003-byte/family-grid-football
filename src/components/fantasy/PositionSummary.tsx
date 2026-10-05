import { useMemo } from "react";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { FantasyTeam, League } from "@/lib/fantasy/league";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { useInsights } from "./PlayerInsights";
import { PlayerCardTrigger } from "./PlayerSheet";
import { cn } from "@/lib/utils";

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

type Trend = "up" | "flat" | "down";

function trendFor(last3Avg: number, seasonAvg: number): Trend {
  if (seasonAvg <= 0 && last3Avg <= 0) return "flat";
  if (seasonAvg <= 0) return last3Avg > 0 ? "up" : "flat";
  if (last3Avg >= seasonAvg * 1.1) return "up";
  if (last3Avg <= seasonAvg * 0.9) return "down";
  return "flat";
}

function TrendArrow({ trend }: { trend: Trend }) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center text-emerald-700" title="Scoring up vs season average" aria-label="Scoring up">
        <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center text-injury-out" title="Scoring down vs season average" aria-label="Scoring down">
        <ArrowDown className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-muted-foreground" title="About even with season average" aria-label="Scoring steady">
      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

/**
 * Quick glance at the bottom of My Team: every rostered player grouped by
 * position, with league position-rank and a last-3 vs season trend arrow.
 */
export function PositionSummary({
  team,
  league,
  byId,
  players,
  week,
}: {
  team: FantasyTeam;
  league: League;
  byId: Map<string, SlimPlayer>;
  players: SlimPlayer[];
  week: number;
}) {
  const insights = useInsights();

  const ranksByPos = useMemo(() => {
    const maps = new Map<string, Map<string, number>>();
    for (const pos of POSITIONS) {
      const ranked = players
        .filter((p) => p.pos === pos)
        .map((p) => ({
          id: p.id,
          pts: insights?.players[p.id]?.seasonPts ?? 0,
          name: p.name,
        }))
        .sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
      const map = new Map<string, number>();
      ranked.forEach((p, i) => map.set(p.id, i + 1));
      maps.set(pos, map);
    }
    return maps;
  }, [players, insights]);

  const irSet = useMemo(() => new Set(team.ir ?? []), [team.ir]);

  const groups = useMemo(() => {
    const rosterIds = [
      ...team.starters.filter((id): id is string => !!id),
      ...team.bench,
      ...(team.ir ?? []),
    ];
    const seen = new Set<string>();
    const byPos = new Map<string, SlimPlayer[]>();
    for (const pos of POSITIONS) byPos.set(pos, []);

    for (const id of rosterIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      const player = byId.get(id);
      if (!player || !byPos.has(player.pos)) continue;
      byPos.get(player.pos)!.push(player);
    }

    for (const pos of POSITIONS) {
      byPos.get(pos)!.sort((a, b) => {
        const aPts = insights?.players[a.id]?.seasonPts ?? 0;
        const bPts = insights?.players[b.id]?.seasonPts ?? 0;
        return bPts - aPts || a.name.localeCompare(b.name);
      });
    }
    return byPos;
  }, [team, byId, insights]);

  return (
    <section className="mt-6">
      <h2 className="mb-1 font-display text-2xl font-bold">By position</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        League position rank and whether recent scoring is up, steady, or down versus their season average.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {POSITIONS.map((pos) => {
          const list = groups.get(pos) ?? [];
          return (
            <div key={pos} className="rounded-2xl border bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-baseline justify-between gap-2 border-b pb-1.5">
                <h3 className="font-display text-lg font-bold tracking-wide">{pos}</h3>
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {list.length === 0 ? "empty" : `${list.length}`}
                </span>
              </div>
              {list.length === 0 ? (
                <p className="py-1 text-sm text-muted-foreground">None on roster</p>
              ) : (
                <ul className="space-y-1">
                  {list.map((player) => {
                    const info = insights?.players[player.id];
                    const rank = ranksByPos.get(pos)?.get(player.id);
                    const trend = trendFor(info?.last3Avg ?? 0, info?.seasonAvg ?? 0);
                    const onIr = irSet.has(player.id);
                    return (
                      <li key={player.id}>
                        <PlayerCardTrigger
                          player={player}
                          week={week}
                          league={league}
                          className="rounded-lg px-1.5 py-1.5 hover:bg-secondary/60"
                        >
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight">
                              {player.name}
                              {onIr && (
                                <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  IR
                                </span>
                              )}
                            </span>
                            <span
                              className={cn(
                                "shrink-0 font-display text-sm font-bold tabular-nums",
                                rank && rank <= 24 ? "text-foreground" : "text-muted-foreground",
                              )}
                            >
                              {rank ? `#${rank}` : "—"}
                            </span>
                            <TrendArrow trend={trend} />
                          </div>
                        </PlayerCardTrigger>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
