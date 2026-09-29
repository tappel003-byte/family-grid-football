import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Background plumbing: saves each finished week's final scores, and turns a
 * finished season into a History entry. Scores come straight from the NFL feed
 * using the league's scoring rules, so archived totals always match the app.
 */

export const archiveWeeks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ archived: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { rollWeek } = await import("./results.server");
    const { archived } = await rollWeek(supabaseAdmin);
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
