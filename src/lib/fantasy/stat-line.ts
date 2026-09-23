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
    ptsAllow0: n("pts_allow_0"),
    ptsAllow1_6: n("pts_allow_1_6"),
    ptsAllow7_13: n("pts_allow_7_13"),
    ptsAllow14_17: n("pts_allow_14_20"),
    ptsAllow18_21: 0,
    ptsAllow22_27: n("pts_allow_21_27"),
    ptsAllow28_34: n("pts_allow_28_34"),
    ptsAllow35_45: n("pts_allow_35p"),
    ptsAllow46: 0,
  };
  return Object.values(line).some((value) => value !== 0) ? line : null;
}