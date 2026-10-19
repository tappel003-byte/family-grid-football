import type { FantasyTeam } from "./league";
import { SLOTS, rosterIds, slotAccepts } from "./league";
import type { SlimPlayer } from "../sleeper.functions";

export type WhatCouldveBeenVerdict = "would_have_won" | "lost_anyway";

export type WhatCouldveBeen = {
  /** Verdict is locked — safe to show (no remaining ambiguity). */
  ready: boolean;
  actualPts: number;
  bestPts: number;
  oppPts: number;
  /** Bench players who would move into the starters in the best lineup. */
  startThese: string[];
  verdict: WhatCouldveBeenVerdict | null;
};

type ScoreFn = (player: SlimPlayer) => number;

const EPS = 0.05;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function totalFor(ids: string[], byId: Map<string, SlimPlayer>, scoreFn: ScoreFn): number {
  let sum = 0;
  for (const id of ids) {
    const p = byId.get(id);
    if (p) sum += scoreFn(p);
  }
  return round1(sum);
}

/** Best legal starters ranked by whatever scoreFn returns. */
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

/**
 * Once you're mathematically eliminated (even your remaining starters can't
 * catch their current score), roast the lineup:
 * - would_have_won: best banked lineup already beats what they have now
 * - lost_anyway: even the optimistic best still loses to their current score
 *
 * Opponent minutes left no longer block "would've won" — if you're already
 * dead and the bench had the points, say so.
 */
export function whatCouldveBeen(args: {
  team: FantasyTeam;
  opponentPts: number;
  /** Points the opponent can still add (kept for callers; not required to lock a win). */
  opponentRemaining?: number;
  byId: Map<string, SlimPlayer>;
  scoreFn: ScoreFn;
  /** Points this player can still add; 0 when their game is done. */
  remainingFn?: ScoreFn;
}): WhatCouldveBeen {
  const { team, opponentPts, byId, scoreFn } = args;
  const remainingFn = args.remainingFn ?? (() => 0);

  const actualIds = (team.starters.filter(Boolean) as string[]) ?? [];
  const actualPts = totalFor(actualIds, byId, scoreFn);
  const actualRem = totalFor(actualIds, byId, remainingFn);

  const bestByActual = bestStartersByScore(team, byId, scoreFn);
  const bestByOptimistic = bestStartersByScore(
    team,
    byId,
    (p) => scoreFn(p) + remainingFn(p),
  );
  const bestMin = totalFor(bestByActual, byId, scoreFn);
  const bestMax = totalFor(bestByOptimistic, byId, (p) => scoreFn(p) + remainingFn(p));
  const bestPts = bestMin;

  const actualSet = new Set(actualIds);
  const startThese = bestByActual
    .filter((id) => !actualSet.has(id))
    .map((id) => byId.get(id)?.name)
    .filter((n): n is string => !!n);

  const myMax = actualPts + actualRem;
  const oppNow = opponentPts;

  // Even at our best remaining finish, we still lose to their current score.
  const clearlyLost = myMax + EPS < oppNow;

  let verdict: WhatCouldveBeenVerdict | null = null;
  if (clearlyLost) {
    if (bestMin > oppNow + EPS) verdict = "would_have_won";
    else if (bestMax + EPS < oppNow) verdict = "lost_anyway";
  }

  return {
    ready: verdict != null,
    actualPts,
    bestPts,
    oppPts: opponentPts,
    startThese,
    verdict,
  };
}
