/**
 * Position-cap rule shared by instant adds, claim placement, and the Wednesday
 * waiver run. Returns a plain-English reason when the move breaks the cap.
 */
export function positionCapProblem(opts: {
  rosterIds: string[];
  positionOf: (id: string) => string | undefined;
  addPos: string;
  dropId: string | null;
  limits: Record<string, number>;
}): string | null {
  const cap = opts.limits[opts.addPos] ?? 0;
  if (cap <= 0) return null;
  const count = opts.rosterIds.filter(
    (id) => id !== opts.dropId && opts.positionOf(id) === opts.addPos,
  ).length;
  return count >= cap
    ? `You already carry ${cap} ${opts.addPos}s, the most allowed — drop a ${opts.addPos} for this one.`
    : null;
}
