export type Scoring = {
  passYd: number;
  passTd: number;
  interception: number;
  rushYd: number;
  rushTd: number;
  reception: number;
  recYd: number;
  recTd: number;
  fumble: number;
  twoPt: number;
  fgMade: number;
  fg0_39: number;
  fg40_49: number;
  fg50: number;
  fgMiss: number;
  xpMade: number;
  xpMiss: number;
  defSack: number;
  defInt: number;
  defFumRec: number;
  defSafety: number;
  defTd: number;
  defBlockKick: number;
  /** NFL.com: +2 for a defensive return on a 2-point attempt. */
  def2ptReturn: number;
  /** NFL.com old default points-allowed brackets (shutout starts at 10). */
  ptsAllow0: number;
  ptsAllow1_6: number;
  ptsAllow7_13: number;
  ptsAllow14_20: number;
  ptsAllow21_27: number;
  ptsAllow28_34: number;
  ptsAllow35: number;
};

/** NFL.com-style D/ST points allowed + standard offensive defaults. */
export const STANDARD_SCORING: Scoring = {
  passYd: 0.04,
  passTd: 4,
  interception: -2,
  rushYd: 0.1,
  rushTd: 6,
  reception: 0,
  recYd: 0.1,
  recTd: 6,
  fumble: -2,
  twoPt: 2,
  fgMade: 0,
  fg0_39: 3,
  fg40_49: 4,
  fg50: 5,
  fgMiss: -1,
  xpMade: 1,
  xpMiss: -1,
  defSack: 1,
  defInt: 2,
  defFumRec: 2,
  defSafety: 2,
  defTd: 6,
  defBlockKick: 2,
  def2ptReturn: 2,
  ptsAllow0: 10,
  ptsAllow1_6: 7,
  ptsAllow7_13: 4,
  ptsAllow14_20: 1,
  ptsAllow21_27: 0,
  ptsAllow28_34: -1,
  ptsAllow35: -4,
};

export const PPR_SCORING: Scoring = { ...STANDARD_SCORING, reception: 1 };
export const HALF_PPR_SCORING: Scoring = { ...STANDARD_SCORING, reception: 0.5 };
/** Alias kept for older imports — same as Standard (NFL.com D/ST brackets). */
export const ESPN_SCORING: Scoring = { ...STANDARD_SCORING };

const NFL_PTS_ALLOW_KEYS = [
  "ptsAllow0",
  "ptsAllow1_6",
  "ptsAllow7_13",
  "ptsAllow14_20",
  "ptsAllow21_27",
  "ptsAllow28_34",
  "ptsAllow35",
] as const;

/** Old ESPN-shaped keys from earlier seasons — drop them on load. */
const LEGACY_PTS_ALLOW_KEYS = [
  "ptsAllow14_17",
  "ptsAllow18_21",
  "ptsAllow22_27",
  "ptsAllow35_45",
  "ptsAllow46",
] as const;

/**
 * Merge stored league scoring onto current defaults and migrate points-allowed
 * to NFL.com brackets (0→10, 1–6→7, … 35+→−4). Legacy ESPN PA keys are removed
 * so an old shutout of 5 cannot stick around.
 */
export function normalizeScoring(raw: Partial<Scoring> | Record<string, number> | null | undefined): Scoring {
  const incoming = { ...(raw ?? {}) } as Record<string, number>;
  for (const key of LEGACY_PTS_ALLOW_KEYS) delete incoming[key];

  const hadLegacy =
    raw != null &&
    LEGACY_PTS_ALLOW_KEYS.some((k) => Object.prototype.hasOwnProperty.call(raw, k));
  const shutout = Number(incoming["ptsAllow0"]);
  // Old ESPN default shutout was 5; treat that (or missing new brackets) as needing NFL PA.
  const needsNflPa =
    hadLegacy ||
    !Number.isFinite(shutout) ||
    shutout === 5 ||
    !NFL_PTS_ALLOW_KEYS.every((k) => Object.prototype.hasOwnProperty.call(incoming, k));

  const merged: Scoring = { ...STANDARD_SCORING, ...(incoming as Partial<Scoring>) };
  if (needsNflPa) {
    for (const key of NFL_PTS_ALLOW_KEYS) merged[key] = STANDARD_SCORING[key];
  }
  if (!Number.isFinite(Number(merged.def2ptReturn))) merged.def2ptReturn = STANDARD_SCORING.def2ptReturn;
  return merged;
}

export const SCORING_FIELDS: Array<{ key: keyof Scoring; label: string; step: number }> = [
  { key: "passYd", label: "Passing yards (per yard)", step: 0.01 },
  { key: "passTd", label: "Passing touchdown", step: 1 },
  { key: "interception", label: "Interception thrown", step: 1 },
  { key: "rushYd", label: "Rushing yards (per yard)", step: 0.01 },
  { key: "rushTd", label: "Rushing touchdown", step: 1 },
  { key: "reception", label: "Each catch (PPR)", step: 0.5 },
  { key: "recYd", label: "Receiving yards (per yard)", step: 0.01 },
  { key: "recTd", label: "Receiving touchdown", step: 1 },
  { key: "fumble", label: "Fumble lost", step: 1 },
  { key: "twoPt", label: "Two-point conversion", step: 1 },
  { key: "fg0_39", label: "Field goal 0–39 yards", step: 1 },
  { key: "fg40_49", label: "Field goal 40–49 yards", step: 1 },
  { key: "fg50", label: "Field goal 50+ yards", step: 1 },
  { key: "fgMiss", label: "Missed field goal", step: 1 },
  { key: "xpMade", label: "Extra point made", step: 1 },
  { key: "xpMiss", label: "Missed extra point", step: 1 },
  { key: "defSack", label: "Defense sack", step: 1 },
  { key: "defInt", label: "Defense interception", step: 1 },
  { key: "defFumRec", label: "Defense fumble recovery", step: 1 },
  { key: "defSafety", label: "Defense safety", step: 1 },
  { key: "defBlockKick", label: "Blocked kick", step: 1 },
  { key: "defTd", label: "Defense / return touchdown", step: 1 },
  { key: "def2ptReturn", label: "Defense 2-pt return", step: 1 },
  { key: "ptsAllow0", label: "Shutout (0 points allowed)", step: 1 },
  { key: "ptsAllow1_6", label: "1–6 points allowed", step: 1 },
  { key: "ptsAllow7_13", label: "7–13 points allowed", step: 1 },
  { key: "ptsAllow14_20", label: "14–20 points allowed", step: 1 },
  { key: "ptsAllow21_27", label: "21–27 points allowed", step: 1 },
  { key: "ptsAllow28_34", label: "28–34 points allowed", step: 1 },
  { key: "ptsAllow35", label: "35+ points allowed", step: 1 },
];

export type StatLine = Record<keyof Scoring, number>;

export const ZERO_STATS: StatLine = Object.fromEntries(
  (Object.keys(STANDARD_SCORING) as Array<keyof Scoring>).map((k) => [k, 0]),
) as StatLine;

export function scoreStats(stats: StatLine, scoring: Scoring): number {
  let total = 0;
  for (const key of Object.keys(scoring) as Array<keyof Scoring>) {
    total += (stats[key] ?? 0) * (scoring[key] ?? 0);
  }
  return Math.round(total * 100) / 100;
}
