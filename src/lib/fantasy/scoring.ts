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
  ptsAllow0: number;
  ptsAllow1_6: number;
  ptsAllow7_13: number;
  ptsAllow14_17: number;
  ptsAllow18_21: number;
  ptsAllow22_27: number;
  ptsAllow28_34: number;
  ptsAllow35_45: number;
  ptsAllow46: number;
};

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
  ptsAllow0: 5,
  ptsAllow1_6: 4,
  ptsAllow7_13: 3,
  ptsAllow14_17: 1,
  ptsAllow18_21: 0,
  ptsAllow22_27: -1,
  ptsAllow28_34: -3,
  ptsAllow35_45: -5,
  ptsAllow46: -5,
};

export const PPR_SCORING: Scoring = { ...STANDARD_SCORING, reception: 1 };
export const HALF_PPR_SCORING: Scoring = { ...STANDARD_SCORING, reception: 0.5 };
/** The league's real ESPN rules: no PPR, 4-point passing TDs, -2 interceptions. */
export const ESPN_SCORING: Scoring = { ...STANDARD_SCORING };

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
  { key: "ptsAllow0", label: "Shutout (0 points allowed)", step: 1 },
  { key: "ptsAllow1_6", label: "1–6 points allowed", step: 1 },
  { key: "ptsAllow7_13", label: "7–13 points allowed", step: 1 },
  { key: "ptsAllow14_17", label: "14–17 points allowed", step: 1 },
  { key: "ptsAllow18_21", label: "18–21 points allowed", step: 1 },
  { key: "ptsAllow22_27", label: "22–27 points allowed", step: 1 },
  { key: "ptsAllow28_34", label: "28–34 points allowed", step: 1 },
  { key: "ptsAllow35_45", label: "35–45 points allowed", step: 1 },
  { key: "ptsAllow46", label: "46+ points allowed", step: 1 },
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
