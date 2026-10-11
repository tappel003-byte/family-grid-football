import type { FantasyTeam } from "./league";

/** Players whose starter/bench slot changed when Optimize ran. */
export function optimizeMovedIds(before: FantasyTeam, after: FantasyTeam): string[] {
  const beforeSlot = new Map<string, number>();
  before.starters.forEach((id, i) => {
    if (id) beforeSlot.set(id, i);
  });
  for (const id of before.bench) beforeSlot.set(id, -1);

  const moved = new Set<string>();
  after.starters.forEach((id, i) => {
    if (!id) return;
    const prev = beforeSlot.get(id);
    if (prev === undefined || prev !== i) moved.add(id);
  });
  for (const id of after.bench) {
    const prev = beforeSlot.get(id);
    if (prev !== undefined && prev !== -1) moved.add(id);
  }
  return [...moved];
}
