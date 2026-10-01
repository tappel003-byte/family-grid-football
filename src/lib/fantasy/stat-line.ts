import { ZERO_STATS, type StatLine } from "./scoring";

type RawStats = Record<string, number> | undefined;

/** Convert Sleeper's raw weekly or season totals into every La Familia scoring field. */
export function rawToStatLine(raw: RawStats): StatLine | null {
  if (!raw) return null;
  const n = (key: string): number => {
    const value = Number(raw[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  const line: StatLine = {
    ...ZERO_STATS,
    passYd: n("pass_yd"),
    passTd: n("pass_td"),
    interception: n("pass_int"),
    rushYd: n("rush_yd"),
    rushTd: n("rush_td"),
    reception: n("rec"),
    recYd: n("rec_yd"),
    recTd: n("rec_td"),
    fumble: n("fum_lost"),
    twoPt: n("pass_2pt") + n("rush_2pt") + n("rec_2pt"),
    fgMade: n("fgm"),
    fg0_39: n("fgm_0_19") + n("fgm_20_29") + n("fgm_30_39"),
    fg40_49: n("fgm_40_49"),
    fg50: n("fgm_50p"),
    fgMiss: n("fgmiss"),
    xpMade: n("xpm"),
    xpMiss: n("xpmiss"),
    defSack: n("sack"),
    defInt: n("int"),
    defFumRec: n("fum_rec"),
    defSafety: n("safe"),
    defTd: n("def_td") + n("def_st_td") + n("st_td"),
    defBlockKick: n("blk_kick"),
    ...pointsAllowedTier(raw),
  };
  return Object.values(line).some((value) => value !== 0) ? line : null;
}

/** One tier = 1 from the literal pts_allow; all 0 when pts_allow is missing (never a shutout). */
export function pointsAllowedTier(raw: Record<string, number>) {
  const t = { ptsAllow0: 0, ptsAllow1_6: 0, ptsAllow7_13: 0, ptsAllow14_17: 0, ptsAllow18_21: 0, ptsAllow22_27: 0, ptsAllow28_34: 0, ptsAllow35_45: 0, ptsAllow46: 0 };
  if (!Object.prototype.hasOwnProperty.call(raw, "pts_allow")) return t;
  const pa = raw["pts_allow"];
  if (typeof pa !== "number" || !Number.isFinite(pa)) return t;
  if (pa <= 0) t.ptsAllow0 = 1;
  else if (pa <= 6) t.ptsAllow1_6 = 1;
  else if (pa <= 13) t.ptsAllow7_13 = 1;
  else if (pa <= 17) t.ptsAllow14_17 = 1;
  else if (pa <= 21) t.ptsAllow18_21 = 1;
  else if (pa <= 27) t.ptsAllow22_27 = 1;
  else if (pa <= 34) t.ptsAllow28_34 = 1;
  else if (pa <= 45) t.ptsAllow35_45 = 1;
  else t.ptsAllow46 = 1;
  return t;
}