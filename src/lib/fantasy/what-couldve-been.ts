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
 * As soon as it's obvious: if this team is clearly losing, would the
 * best-by-actual lineup have beaten the opponent — or lost anyway?
 * Stays quiet while remaining games could still flip the answer.
 */
export function whatCouldveBeen(args: {
  team: FantasyTeam;
  opponentPts: number;
  /** Points the opponent can still add (yet-to-play / in-progress). */
  opponentRemaining?: number;
  byId: Map<string, SlimPlayer>;
  scoreFn: ScoreFn;
  /** Points this player can still add; 0 when their game is done. */
  remainingFn?: ScoreFn;
}): WhatCouldveBeen {
  const { team, opponentPts, byId, scoreFn } = args;
  const remainingFn = args.remainingFn ?? (() => 0);
  const oppRem = Math.max(0, args.opponentRemaining ?? 0);

  const actualIds = (team.starters.filter(Boolean) as string[]) ?? [];
  const actualPts = totalFor(actualIds, byId, scoreFn);
  const actualRem = totalFor(actualIds, byId, remainingFn);

  // Floor lineup: banked actuals. Ceiling lineup: optimistic (actual + left).
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
  const oppMin = opponentPts;
  const oppMax = opponentPts + oppRem;

  // Even at our best remaining finish, we still lose to their current score.
  const clearlyLost = myMax + EPS < oppMin;

  let verdict: WhatCouldveBeenVerdict | null = null;
  if (clearlyLost) {
    // Already-banked best lineup beats anything the opponent can still reach.
    if (bestMin > oppMax + EPS) verdict = "would_have_won";
    // Even the optimistic best lineup can't catch their current score.
    else if (bestMax + EPS < oppMin) verdict = "lost_anyway";
    // Otherwise still a question — leave null.
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
