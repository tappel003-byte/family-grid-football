/** 9 starters + 6 bench, written out so this file imports nothing (avoids a circular import). */
const DEFAULT_ROSTER_LIMIT = 15;

/** House rules the commissioner controls: roster size, position caps, waivers, trade deadline. */
export type LeagueRules = {
  /** Total players a team may carry. */
  rosterLimit: number;
  /** Most players a team may carry at each position. 0 means no cap. */
  positionLimits: Record<string, number>;
  /** "free" = grab anybody anytime. "locked" = nobody can be added or dropped once their game has started. */
  waiverMode: "free" | "locked";
  /** Last week trades are allowed. 0 means trades never close. */
  tradeDeadlineWeek: number;
};

export const DEFAULT_RULES: LeagueRules = {
  rosterLimit: SLOTS.length + BENCH_SIZE,
  positionLimits: { QB: 4, RB: 8, WR: 8, TE: 4, K: 3, DEF: 3 },
  waiverMode: "free",
  tradeDeadlineWeek: 12,
};

export const RULE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DEF"] as const;

/** Fills in anything missing so old leagues keep working. */
export function normalizeRules(raw: unknown): LeagueRules {
  const r = (raw ?? {}) as Partial<LeagueRules>;
  const limits: Record<string, number> = { ...DEFAULT_RULES.positionLimits };
  for (const pos of RULE_POSITIONS) {
    const v = Number((r.positionLimits ?? {})[pos]);
    if (Number.isFinite(v) && v >= 0) limits[pos] = v;
  }
  const size = Number(r.rosterLimit);
  const deadline = Number(r.tradeDeadlineWeek);
  return {
    rosterLimit: Number.isFinite(size) && size > 0 ? size : DEFAULT_RULES.rosterLimit,
    positionLimits: limits,
    waiverMode: r.waiverMode === "locked" ? "locked" : "free",
    tradeDeadlineWeek:
      Number.isFinite(deadline) && deadline >= 0 ? deadline : DEFAULT_RULES.tradeDeadlineWeek,
  };
}

/** How many players at each position a list of ids works out to. */
export function countPositions(ids: string[], posOf: (id: string) => string | undefined) {
  const counts: Record<string, number> = {};
  for (const id of ids) {
    const pos = posOf(id);
    if (!pos) continue;
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return counts;
}
