import type { FantasyTeam } from "./league";
import { SLOTS, rosterIds, slotAccepts } from "./league";
import type { SlimPlayer } from "../sleeper.functions";

export type WhatCouldveBeenVerdict = "would_have_won" | "lost_anyway";

export type LineupSwap = {
  inId: string;
  outId: string;
  inName: string;
  outName: string;
};

export type WhatCouldveBeen = {
  /** Verdict is locked — safe to show (no remaining ambiguity). */
  ready: boolean;
  actualPts: number;
  bestPts: number;
  oppPts: number;
  /** Bench → starter swaps in the best-by-actual lineup. */
  swaps: LineupSwap[];
  /** Player ids to highlight (bench who should start + starters they bump). */
  highlightIds: string[];
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
 * Pair each bench upgrade with the starter they bump.
 * Slot-aligned first (FLEX/TE shuffles stay honest), then leftover
 * ins/outs by gain — never "Start X over Y" when X scored less.
 */
export function lineupSwaps(
  actualIds: string[],
  bestIds: string[],
  byId: Map<string, SlimPlayer>,
  scoreFn: ScoreFn,
): LineupSwap[] {
  const actualSet = new Set(actualIds);
  const bestSet = new Set(bestIds);
  const usedIn = new Set<string>();
  const usedOut = new Set<string>();
  const swaps: LineupSwap[] = [];

  const push = (inId: string, outId: string) => {
    if (usedIn.has(inId) || usedOut.has(outId)) return false;
    const inn = byId.get(inId);
    const out = byId.get(outId);
    if (!inn || !out) return false;
    if (scoreFn(inn) <= scoreFn(out) + EPS) return false;
    usedIn.add(inId);
    usedOut.add(outId);
    swaps.push({
      inId,
      outId,
      inName: inn.name,
      outName: out.name,
    });
    return true;
  };

  // 1) Same slot: new starter took this seat (and the old one left the lineup).
  const n = Math.min(actualIds.length, bestIds.length);
  for (let i = 0; i < n; i++) {
    const outId = actualIds[i]!;
    const inId = bestIds[i]!;
    if (outId === inId) continue;
    if (actualSet.has(inId)) continue; // already started — reshuffle
    if (bestSet.has(outId)) continue; // still starting elsewhere — reshuffle
    push(inId, outId);
  }

  // 2) Leftovers: best positive gain, prefer same position.
  const ins = bestIds.filter((id) => !actualSet.has(id) && !usedIn.has(id));
  const outs = actualIds.filter((id) => !bestSet.has(id) && !usedOut.has(id));
  const cands: Array<{ inId: string; outId: string; gain: number; samePos: boolean }> = [];
  for (const inId of ins) {
    const inn = byId.get(inId);
    if (!inn) continue;
    const inPts = scoreFn(inn);
    for (const outId of outs) {
      const out = byId.get(outId);
      if (!out) continue;
      const gain = inPts - scoreFn(out);
      if (gain <= EPS) continue;
      cands.push({ inId, outId, gain, samePos: inn.pos === out.pos });
    }
  }
  cands.sort((a, b) => Number(b.samePos) - Number(a.samePos) || b.gain - a.gain);
  for (const c of cands) push(c.inId, c.outId);

  return swaps;
}

/**
 * Once you're mathematically eliminated, roast the lineup with Start X over Y:
 * - would_have_won: best banked lineup already beats what they have now
 * - lost_anyway: even the optimistic best still loses to their current score
 * Stays quiet with no real swaps (nothing to roast).
 */
export function whatCouldveBeen(args: {
  team: FantasyTeam;
  opponentPts: number;
  opponentRemaining?: number;
  byId: Map<string, SlimPlayer>;
  scoreFn: ScoreFn;
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

  const swaps = lineupSwaps(actualIds, bestByActual, byId, scoreFn);
  const highlightIds = [...new Set(swaps.flatMap((s) => [s.inId, s.outId]))];

  const myMax = actualPts + actualRem;
  const oppNow = opponentPts;
  const clearlyLost = myMax + EPS < oppNow;

  let verdict: WhatCouldveBeenVerdict | null = null;
  if (clearlyLost && swaps.length > 0) {
    if (bestMin > oppNow + EPS) verdict = "would_have_won";
    else if (bestMax + EPS < oppNow) verdict = "lost_anyway";
  }

  return {
    ready: verdict != null,
    actualPts,
    bestPts,
    oppPts: opponentPts,
    swaps,
    highlightIds,
    verdict,
  };
}
