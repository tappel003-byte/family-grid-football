import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { FantasyTeam, League } from "@/lib/fantasy/league";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { getTeamResearch } from "@/lib/team-research.functions";
import { useInsights } from "./PlayerInsights";
import { PlayerCardTrigger } from "./PlayerSheet";
import { depthLabel } from "./ResearchTags";
import { injuryInfo } from "./PlayerCell";
import { cn } from "@/lib/utils";

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

/** Starting slots needed each week (FLEX can soak an extra RB/WR/TE). */
const START_NEED: Record<(typeof POSITIONS)[number], number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DEF: 1,
};
const FLEX_POS = new Set(["RB", "WR", "TE"]);

/** Header count: "3 on roster · start 1" — not the cryptic "3 of 1". */
function needLabel(pos: (typeof POSITIONS)[number], have: number): { text: string; thin: boolean } {
  const need = START_NEED[pos];
  const flex = FLEX_POS.has(pos);
  const thin = have < need;
  const start = flex ? `${need}+` : String(need);
  if (have === 0) {
    return { text: `None · start ${start}`, thin: true };
  }
  if (thin) {
    return { text: `Only ${have} · need ${start} to start`, thin: true };
  }
  return { text: `${have} on roster · start ${start}`, thin: false };
}

function normTeam(team: string) {
  return team === "WSH" ? "WAS" : team;
}

/**
 * Quick glance at the bottom of My Team: roster by position with depth,
 * league rank, offense rank, thin-spot counts, and short injury chips.
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
  const fetchResearch = useServerFn(getTeamResearch);
  const { data: research } = useQuery({
    queryKey: ["team-research"],
    queryFn: () => fetchResearch(),
    staleTime: 1000 * 60 * 45,
    refetchOnMount: "always",
  });

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
        NFL depth (WR1, RB2, …), league rank (#), and team offense rank. If someone&apos;s Out, we show Out only — we don&apos;t demote them to WR5. Tap a name for the full card.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {POSITIONS.map((pos) => {
          const list = groups.get(pos) ?? [];
          const need = needLabel(pos, list.length);
          return (
            <div key={pos} className="rounded-2xl border bg-card p-3 shadow-sm">
              <div className="mb-2 flex items-baseline justify-between gap-2 border-b pb-1.5">
                <h3 className="font-display text-lg font-bold tracking-wide">{pos}</h3>
                <span
                  className={cn(
                    "max-w-[70%] text-right text-xs font-semibold leading-snug",
                    need.thin ? "text-injury-out" : "text-muted-foreground",
                  )}
                >
                  {need.text}
                </span>
              </div>
              {list.length === 0 ? (
                <p className="py-1 text-sm font-semibold text-injury-out">None on roster — easy add</p>
              ) : (
                <ul className="space-y-1">
                  {list.map((player) => {
                    const rank = ranksByPos.get(pos)?.get(player.id);
                    const depth = depthLabel(player);
                    const off = research?.offenseRankByTeam[normTeam(player.team)];
                    const onIr = irSet.has(player.id);
                    const chip =
                      research?.injuries[player.id]?.matrixChip ??
                      (injuryInfo(player.injury)?.severity === "out"
                        ? injuryInfo(player.injury)!.tag
                        : injuryInfo(player.injury)?.tag === "Q"
                          ? "Q"
                          : null);
                    return (
                      <li key={player.id}>
                        <PlayerCardTrigger
                          player={player}
                          week={week}
                          league={league}
                          className="rounded-lg px-1.5 py-1.5 hover:bg-secondary/60"
                        >
                          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                            <span className="min-w-0 truncate text-sm font-semibold leading-tight">
                              {player.name}
                            </span>
                            {onIr && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                IR
                              </span>
                            )}
                            {depth && (
                              <span className="text-xs font-bold text-muted-foreground">{depth}</span>
                            )}
                            <span
                              className={cn(
                                "font-display text-sm font-bold tabular-nums",
                                rank && rank <= 24 ? "text-foreground" : "text-muted-foreground",
                              )}
                            >
                              {rank ? `#${rank}` : "—"}
                            </span>
                            {player.pos !== "DEF" && off != null && (
                              <span className="text-xs font-semibold text-muted-foreground">
                                Team off #{off}
                              </span>
                            )}
                            {chip && (
                              <span className="rounded bg-injury-out/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-injury-out">
                                {chip}
                              </span>
                            )}
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
