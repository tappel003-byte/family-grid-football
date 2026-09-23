/** 9 starters + 6 bench, written out so this file imports nothing (avoids a circular import). */
const DEFAULT_ROSTER_LIMIT = 15;

/** House rules the commissioner controls: roster size, position caps, waivers, trade deadline. */
export type LeagueRules = {
  /** Total players a team may carry. */
  rosterLimit: number;
  /** Most players a team may carry at each position. 0 means no cap. */
  positionLimits: Record<string, number>;
  /**
   * "free" = grab anybody anytime. "locked" = nobody can be added or dropped once their
   * game has started. "waivers" = pickups go into a queue that processes in claim order.
   */
  waiverMode: "free" | "locked" | "waivers";
  /** Last week trades are allowed. 0 means trades never close. */
  tradeDeadlineWeek: number;
  /** Team slots in waiver priority order (first entry picks first). */
  waiverOrder: number[];
  /** How many injured-reserve spots each team gets. 0 turns the feature off. */
  irSlots: number;
  /** Once a player's game kicks off, his lineup spot is frozen for that week. */
  lockAtKickoff: boolean;
  /** Day of the week claims process on. 0 = Sunday, 3 = Wednesday. */
  waiverDay: number;
  /** Rebuild the claim order every week from the standings (worst record first). */
  autoWaiverOrder: boolean;
};

export const DEFAULT_RULES: LeagueRules = {
  rosterLimit: DEFAULT_ROSTER_LIMIT,
  positionLimits: { QB: 4, RB: 8, WR: 8, TE: 4, K: 3, DEF: 3 },
  waiverMode: "waivers",
  tradeDeadlineWeek: 12,
  waiverOrder: [],
  irSlots: 1,
  lockAtKickoff: true,
  waiverDay: 3,
  autoWaiverOrder: true,
};

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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
  const order = Array.isArray(r.waiverOrder)
    ? r.waiverOrder.map(Number).filter((n) => Number.isFinite(n) && n >= 0)
    : [];
  return {
    rosterLimit: Number.isFinite(size) && size > 0 ? size : DEFAULT_RULES.rosterLimit,
    positionLimits: limits,
    waiverMode:
      r.waiverMode === "locked" || r.waiverMode === "waivers" ? r.waiverMode : "free",
    tradeDeadlineWeek:
      Number.isFinite(deadline) && deadline >= 0 ? deadline : DEFAULT_RULES.tradeDeadlineWeek,
    waiverOrder: order,
    irSlots: (() => {
      const ir = Number(r.irSlots);
      return Number.isFinite(ir) && ir >= 0 ? Math.min(ir, 3) : DEFAULT_RULES.irSlots;
    })(),
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
