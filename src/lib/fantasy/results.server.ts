/** Shared scoring archive + automatic week rollover (server only). */
type StatLine = Record<string, number>;


/** Same mapping the live scoring uses, kept local so this file imports nothing heavy. */
function toLine(raw: Record<string, number> | undefined): StatLine {
  if (!raw) return {};
  const n = (k: string) => {
    const v = Number(raw[k] ?? 0);
    return Number.isFinite(v) ? v : 0;
  };
  const line: StatLine = {
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
  return line;
}

function score(line: StatLine, scoring: Record<string, number>): number {
  let total = 0;
  for (const [key, weight] of Object.entries(scoring)) {
    const value = Number(line[key] ?? 0);
    const w = Number(weight ?? 0);
    if (Number.isFinite(value) && Number.isFinite(w)) total += value * w;
  }
  return Number.isFinite(total) ? total : 0;
}

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function seasonOf(): Promise<string> {
  const state = await json<{ season?: string }>("https://api.sleeper.app/v1/state/nfl");
  return state?.season ?? String(new Date().getUTCFullYear());
}


export async function archiveFinishedWeeks(supabaseAdmin: any): Promise<{ archived: number }> {
    const { data: leagueRow } = await supabaseAdmin
      .from("league")
      .select("id, current_week, scoring")
      .eq("slug", "main")
      .maybeSingle();
    if (!leagueRow) return { archived: 0 };
    const scoring = (leagueRow.scoring ?? {}) as Record<string, number>;

    const { data: teamRows } = await supabaseAdmin
      .from("teams")
      .select("slot, starters")
      .eq("league_id", leagueRow.id)
      .order("slot", { ascending: true });
    const teams = (teamRows ?? []) as Array<{ slot: number; starters: Array<string | null> | null }>;
    if (!teams.length) return { archived: 0 };

    const { data: existing } = await supabaseAdmin
      .from("weekly_results")
      .select("week")
      .eq("league_id", leagueRow.id);
    const done = new Set((existing ?? []).map((r: { week: number }) => Number(r.week)));

    const season = await seasonOf();
    const lastWeek = Math.max(0, Math.min(18, Number(leagueRow.current_week) - 1));
    let archived = 0;

    for (let week = 1; week <= lastWeek; week++) {
      if (done.has(week)) continue;
      const raw = await json<Record<string, Record<string, number>>>(
        `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`,
      );
      if (!raw) continue; // feed hiccup — try again next time
      const rows = teams.map((team) => {
        const starters = ((team.starters ?? []).filter(Boolean) as string[]) ?? [];
        const points = starters.reduce((sum, id) => sum + score(toLine(raw[id]), scoring), 0);
        return {
          league_id: leagueRow.id,
          week,
          team_slot: team.slot,
          points: Math.round(points * 10) / 10,
        };
      });
      const { error } = await supabaseAdmin
        .from("weekly_results")
        .upsert(rows, { onConflict: "league_id,week,team_slot" });
      if (!error) archived++;
    }

    return { archived };
}

/** Advances the league to Sleeper's current NFL week (never backwards), then archives finished weeks. */
export async function rollWeek(supabaseAdmin: any) {
  const state = await json<{ week?: number; season_type?: string }>("https://api.sleeper.app/v1/state/nfl");
  const target = Math.min(18, Number(state?.week ?? 0));
  const { data: row } = await supabaseAdmin.from("league").select("id, current_week").eq("slug", "main").maybeSingle();
  let advanced = false;
  if (row && state?.season_type === "regular" && target > Number(row.current_week)) {
    const { error } = await supabaseAdmin
      .from("league")
      .update({ current_week: target, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    advanced = true;
  }
  const { archived } = await archiveFinishedWeeks(supabaseAdmin);
  return { advanced, week: advanced ? target : row?.current_week ?? null, archived };
}
