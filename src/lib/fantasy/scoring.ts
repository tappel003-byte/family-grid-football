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
  fgMade: number;
  xpMade: number;
  defSack: number;
  defInt: number;
  defTd: number;
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
  fgMade: 3,
  xpMade: 1,
  defSack: 1,
  defInt: 2,
  defTd: 6,
};

export const PPR_SCORING: Scoring = { ...STANDARD_SCORING, reception: 1 };
export const HALF_PPR_SCORING: Scoring = { ...STANDARD_SCORING, reception: 0.5 };

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
  { key: "fgMade", label: "Field goal made", step: 1 },
  { key: "xpMade", label: "Extra point made", step: 1 },
  { key: "defSack", label: "Defense sack", step: 1 },
  { key: "defInt", label: "Defense interception", step: 1 },
  { key: "defTd", label: "Defense touchdown", step: 1 },
];

export type StatLine = {
  passYd: number;
  passTd: number;
  interception: number;
  rushYd: number;
  rushTd: number;
  reception: number;
  recYd: number;
  recTd: number;
  fumble: number;
  fgMade: number;
  xpMade: number;
  defSack: number;
  defInt: number;
  defTd: number;
};

export function scoreStats(stats: StatLine, scoring: Scoring): number {
  let total = 0;
  for (const key of Object.keys(scoring) as Array<keyof Scoring>) {
    total += stats[key] * scoring[key];
  }
  return Math.round(total * 100) / 100;
}
