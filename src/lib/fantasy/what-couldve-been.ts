import type { FantasyTeam, League } from "./league";
import { SLOTS, rosterIds, slotAccepts } from "./league";
import type { SlimPlayer } from "../sleeper.functions";

export type WhatCouldveBeenVerdict = "would_have_won" | "lost_anyway";

export type WhatCouldveBeen = {
  /** Enough games are final to trust the counterfactual. */
  ready: boolean;
  actualPts: number;
  bestPts: number;
  oppPts: number;
  /** Bench players who would move into the starters in the best lineup. */
  startThese: string[];
  verdict: WhatCouldveBeenVerdict | null;
};

type ScoreFn = (player: SlimPlayer) => number;
type SettledFn = (player: SlimPlayer) => boolean;

/** Best legal starters ranked by actual (or whatever scoreFn returns). */
export function bestStartersByScore(
  team: FantasyTeam,
  byId: Map<string, SlimPlayer>,
  scoreFn: ScoreFn,
): string[] {
  const ids = rosterIds(team);
  const ranked = ids
    .map((id) => byId.get(id))
    .filter((p): p is SlimPlayer => !!p)
    .sort((a, b) => scoreFn(b) - scoreFn(a));

  const used = new Set<string>();
  return SLOTS.map((slot) => {
    const player = ranked.find((p) => !used.has(p.id) && slotAccepts(slot, p.pos));
    if (player) {
      used.add(player.id);
      return player.id;
    }
    return null;
  }).filter((id): id is string => !!id);
}

function totalFor(ids: string[], byId: Map<string, SlimPlayer>, scoreFn: ScoreFn): number {
  let sum = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (p) sum += scoreFn(p);
  }
  return Math.round(sum * 10) / 10;
}

/**
 * After the slate settles: if this team lost, would the best-by-actual lineup
 * have beaten the opponent — or would they have lost anyway?
 */
export function whatCouldveBeen(args: {
  team: FantasyTeam;
  opponentPts: number;
  byId: Map<string, SlimPlayer>;
  scoreFn: ScoreFn;
  settled: SettledFn;
  /** Minimum fraction of roster players whose games must be settled (0–1). */
  settledRatio?: number;
}): WhatCouldveBeen {
  const { team, opponentPts, byId, scoreFn, settled } = args;
  const ratio = args.settledRatio ?? 0.75;
  const roster = rosterIds(team)
    .map((id) => byId.get(id))
    .filter((p): p is SlimPlayer => !!p);
  const settledCount = roster.filter((p) => settled(p)).length;
  const ready = roster.length > 0 && settledCount / roster.length >= ratio;

  const actualIds = (team.starters.filter(Boolean) as string[]) ?? [];
  const actualPts = totalFor(actualIds, byId, scoreFn);
  const bestIds = bestStartersByScore(team, byId, scoreFn);
  const bestPts = totalFor(bestIds, byId, scoreFn);
  const actualSet = new Set(actualIds);
  const startThese = bestIds
    .filter((id) => !actualSet.has(id))
    .map((id) => byId.get(id)?.name)
    .filter((n): n is string => !!n);

  let verdict: WhatCouldveBeenVerdict | null = null;
  if (ready && actualPts + 0.05 < opponentPts) {
    // They lost (or are losing) on the lineup they started.
    if (bestPts > opponentPts + 0.05) verdict = "would_have_won";
    else verdict = "lost_anyway";
  }

  return { ready, actualPts, bestPts, oppPts: opponentPts, startThese, verdict };
}
