import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Background plumbing: saves each finished week's final scores, and turns a
 * finished season into a History entry. Scores come straight from the NFL feed
 * using the league's scoring rules, so archived totals always match the app.
 */

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

async function seasonOf(): Promise<string> {
  const state = await json<{ season?: string }>("https://api.sleeper.app/v1/state/nfl");
  return state?.season ?? String(new Date().getUTCFullYear());
}

export const archiveWeeks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ archived: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
  });

/** Commissioner action: writes this season's final standings into the record book. */
export const saveSeasonToHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { season?: number }) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: commishFlag } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "commissioner",
    });
    if (commishFlag !== true) throw new Error("Only the commissioner can close out a season.");

    const { data: leagueRow } = await supabaseAdmin
      .from("league")
      .select("id, current_week, schedule")
      .eq("slug", "main")
      .maybeSingle();
    if (!leagueRow) throw new Error("The league is not set up yet.");

    const { data: teamRows } = await supabaseAdmin
      .from("teams")
      .select("slot, name, owner")
      .eq("league_id", leagueRow.id)
      .order("slot", { ascending: true });
    const teams = (teamRows ?? []) as Array<{ slot: number; name: string; owner: string }>;
    if (!teams.length) throw new Error("No teams to archive.");

    const { data: resultRows } = await supabaseAdmin
      .from("weekly_results")
      .select("week, team_slot, points")
      .eq("league_id", leagueRow.id);
    const results = (resultRows ?? []) as Array<{ week: number; team_slot: number; points: string | number }>;
    if (!results.length) {
      throw new Error("No saved weekly results yet — the scores save automatically as weeks finish.");
    }
    const pointsAt = new Map<string, number>();
    for (const r of results) pointsAt.set(`${r.week}:${r.team_slot}`, Number(r.points));

    const stats = teams.map((t) => ({ slot: t.slot, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 }));
    const schedule = (leagueRow.schedule ?? []) as Array<Array<[number, number]>>;
    for (let w = 1; w < schedule.length + 1; w++) {
      for (const [h, a] of schedule[w - 1] ?? []) {
        const hp = pointsAt.get(`${w}:${h}`);
        const ap = pointsAt.get(`${w}:${a}`);
        if (hp == null || ap == null) continue;
        const home = stats[h];
        const away = stats[a];
        if (!home || !away) continue;
        home.pf += hp;
        home.pa += ap;
        away.pf += ap;
        away.pa += hp;
        if (hp > ap) {
          home.wins++;
          away.losses++;
        } else if (ap > hp) {
          away.wins++;
          home.losses++;
        } else {
          home.ties++;
          away.ties++;
        }
      }
    }

    stats.sort((x, y) => y.wins * 2 + y.ties - (x.wins * 2 + x.ties) || y.pf - x.pf);
    const standings = stats.map((s, i) => {
      const team = teams[s.slot]!;
      return {
        place: i + 1,
        team: team.name,
        owner: team.owner,
        record: `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`,
      };
    });
    const top = stats[0]!;
    const best = teams[top.slot]!;

    const season = data.season ?? new Date().getUTCFullYear();
    const { error } = await supabaseAdmin.from("season_history").upsert(
      {
        season,
        regular_season_best: `${best.name}${best.owner ? ` · ${best.owner}` : ""} (${top.wins}-${top.losses}${top.ties ? `-${top.ties}` : ""})`,
        notes: "",
        standings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "season" },
    );
    if (error) throw new Error(error.message);

    return { ok: true, season, best: best.name };
  });
