/** Shared scoring archive + automatic week rollover (server only). */
import { normalizeScoring } from "./scoring";
import { pointsAllowedTier } from "./stat-line";
type StatLine = Record<string, number>;

/** Same mapping the live scoring uses, kept local so this file imports nothing heavy. */
export function toLine(raw: Record<string, number> | undefined): StatLine {
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
    def2ptReturn: n("def_2pt") + n("st_2pt") + n("def_st_2pt"),
    ...pointsAllowedTier(raw),
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

async function writeWeekLineups(
  supabaseAdmin: any,
  leagueId: string,
  week: number,
  firstWins: boolean,
): Promise<void> {
  if (!leagueId || week < 1) return;
  const { data: teamRows } = await supabaseAdmin
    .from("teams")
    .select("slot, starters")
    .eq("league_id", leagueId)
    .order("slot", { ascending: true });
  const teams = (teamRows ?? []) as Array<{ slot: number; starters: Array<string | null> | null }>;
  if (!teams.length) return;

  const rows = teams.map((team) => ({
    league_id: leagueId,
    week,
    team_slot: team.slot,
    starters: team.starters ?? [],
    frozen_at: new Date().toISOString(),
  }));

  const { error } = await supabaseAdmin.from("weekly_lineups").upsert(rows, {
    onConflict: "league_id,week,team_slot",
    ignoreDuplicates: firstWins,
  });
  if (error && !/weekly_lineups|schema cache|does not exist/i.test(error.message ?? "")) {
    throw new Error(error.message);
  }
}

/**
 * Freeze each team's starters for a finished week. First freeze wins —
 * later roster moves (waivers, next-week sets) cannot rewrite the scoring lineup.
 * No-op if the weekly_lineups table isn't migrated yet.
 */
export async function freezeWeekLineups(
  supabaseAdmin: any,
  leagueId: string,
  week: number,
): Promise<void> {
  await writeWeekLineups(supabaseAdmin, leagueId, week, true);
}

/** Last-write snapshot of the live lineup for the week still in progress. */
export async function snapshotWeekLineups(
  supabaseAdmin: any,
  leagueId: string,
  week: number,
): Promise<void> {
  await writeWeekLineups(supabaseAdmin, leagueId, week, false);
}

export async function archiveFinishedWeeks(
  supabaseAdmin: any,
  regularSeasonOver = false,
): Promise<{ archived: number }> {
  const { data: leagueRow } = await supabaseAdmin
    .from("league")
    .select("id, current_week, scoring")
    .eq("slug", "main")
    .maybeSingle();
  if (!leagueRow) return { archived: 0 };
  const scoring = normalizeScoring(leagueRow.scoring as Record<string, number> | null) as unknown as Record<
    string,
    number
  >;

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
  const lastWeek = Math.max(
    0,
    Math.min(18, Number(leagueRow.current_week) - (regularSeasonOver ? 0 : 1)),
  );
  let archived = 0;

  for (let week = 1; week <= lastWeek; week++) {
    if (done.has(week)) continue;
    const raw = await json<Record<string, Record<string, number>>>(
      `https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`,
    );
    if (!raw) continue; // feed hiccup — try again next time (uses frozen lineups)

    const { data: frozenRows } = await supabaseAdmin
      .from("weekly_lineups")
      .select("team_slot, starters")
      .eq("league_id", leagueRow.id)
      .eq("week", week);
    const frozenBySlot = new Map<number, Array<string | null>>(
      ((frozenRows ?? []) as Array<{ team_slot: number; starters: Array<string | null> }>).map(
        (row) => [row.team_slot, row.starters ?? []],
      ),
    );

    const rows = teams.map((team) => {
      const starters = (
        (frozenBySlot.get(team.slot) ?? team.starters ?? []).filter(Boolean) as string[]
      );
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
  const { data: row } = await supabaseAdmin
    .from("league")
    .select("id, current_week")
    .eq("slug", "main")
    .maybeSingle();
  let advanced = false;
  if (row && state?.season_type === "regular" && target > Number(row.current_week)) {
    // Freeze the week we're leaving BEFORE advancing — so Wednesday waivers
    // can't rewrite Sunday's scoring lineup if Sleeper stats retry later.
    await freezeWeekLineups(supabaseAdmin, row.id, Number(row.current_week));
    const { error } = await supabaseAdmin
      .from("league")
      .update({ current_week: target, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    advanced = true;
  }
  // Once the NFL moves past the regular season, the final week is finished too.
  const regularSeasonOver =
    !!state?.season_type && state.season_type !== "regular" && state.season_type !== "pre";
  if (regularSeasonOver && row) {
    await freezeWeekLineups(supabaseAdmin, row.id, Number(row.current_week));
  }
  const { archived } = await archiveFinishedWeeks(supabaseAdmin, regularSeasonOver);
  return { advanced, week: advanced ? target : row?.current_week ?? null, archived };
}
