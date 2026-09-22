import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { League, FantasyTeam } from "./league";

type TeamRow = {
  slot: number;
  name: string;
  owner: string;
  color: string;
  starters: Array<string | null>;
  bench: string[];
  ir: string[];
  userId?: string | null;
  division?: string;
};

export type LeaguePayload = {
  name: string;
  currentWeek: number;
  scoring: Record<string, number>;
  rules: Record<string, unknown>;
  schedule: Array<Array<[number, number]>>;
  teams: TeamRow[];
};

export function toPayload(league: League): LeaguePayload {
  return {
    name: league.name,
    currentWeek: league.currentWeek,
    scoring: league.scoring as unknown as Record<string, number>,
    rules: league.rules as unknown as Record<string, unknown>,
    schedule: league.schedule,
    teams: league.teams.map((t: FantasyTeam, i) => ({
      slot: i,
      name: t.name,
      owner: t.owner,
      color: t.color,
      starters: t.starters,
      bench: t.bench,
      userId: t.userId ?? null,
      division: t.division ?? "",
    })),
  };
}

async function isCommissioner(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "commissioner",
  });
  return data === true;
}

/**
 * Saves the league. Commissioners may change everything; everyone else may only
 * change the lineup of the team they own.
 */
export const saveLeague = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: LeaguePayload) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const commish = await isCommissioner(context);

    const { data: existing } = await supabaseAdmin
      .from("league")
      .select("id")
      .eq("slug", "main")
      .maybeSingle();

    let leagueId = existing?.id;

    if (!commish) {
      if (!leagueId) throw new Error("Only the commissioner can create the league.");
      const { data: myTeam } = await supabaseAdmin
        .from("teams")
        .select("id, slot")
        .eq("league_id", leagueId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!myTeam) throw new Error("You do not have a team in this league yet.");
      const mine = data.teams.find((t) => t.slot === myTeam.slot);
      if (!mine) throw new Error("Your team was not part of this change.");
      const { error } = await supabaseAdmin
        .from("teams")
        .update({
          starters: mine.starters,
          bench: mine.bench,
          updated_at: new Date().toISOString(),
        })
        .eq("id", myTeam.id);
      if (error) throw new Error(error.message);
      return { ok: true, scope: "team" as const };
    }

    if (!leagueId) {
      const { data: created, error } = await supabaseAdmin
        .from("league")
        .insert({
          slug: "main",
          name: data.name,
          current_week: data.currentWeek,
          scoring: data.scoring,
          rules: (data.rules ?? {}) as never,
          schedule: data.schedule,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      leagueId = created.id;
    } else {
      const { error } = await supabaseAdmin
        .from("league")
        .update({
          name: data.name,
          current_week: data.currentWeek,
          scoring: data.scoring,
          rules: (data.rules ?? {}) as never,
          schedule: data.schedule,
          updated_at: new Date().toISOString(),
        })
        .eq("id", leagueId);
      if (error) throw new Error(error.message);
    }

    const rows = data.teams.map((t) => ({
      league_id: leagueId!,
      slot: t.slot,
      name: t.name,
      owner: t.owner,
      color: t.color,
      starters: t.starters,
      bench: t.bench,
      user_id: t.userId ?? null,
      division: t.division ?? "",
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabaseAdmin
      .from("teams")
      .upsert(rows, { onConflict: "league_id,slot" });
    if (upsertError) throw new Error(upsertError.message);

    const { error: pruneError } = await supabaseAdmin
      .from("teams")
      .delete()
      .eq("league_id", leagueId)
      .gte("slot", data.teams.length);
    if (pruneError) throw new Error(pruneError.message);

    return { ok: true, scope: "league" as const };
  });

/** Commissioner links a family member's account to one team. */
export const assignTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { slot: number; userId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!(await isCommissioner(context))) throw new Error("Commissioners only.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: leagueRow } = await supabaseAdmin
      .from("league")
      .select("id")
      .eq("slug", "main")
      .maybeSingle();
    if (!leagueRow) throw new Error("No league yet.");

    if (data.userId) {
      // one team per person
      await supabaseAdmin
        .from("teams")
        .update({ user_id: null })
        .eq("league_id", leagueRow.id)
        .eq("user_id", data.userId);
    }

    const { error } = await supabaseAdmin
      .from("teams")
      .update({ user_id: data.userId, updated_at: new Date().toISOString() })
      .eq("league_id", leagueRow.id)
      .eq("slot", data.slot);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Commissioner promotes or demotes another family member. */
export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string; role: "commissioner" | "member" }) => data)
  .handler(async ({ data, context }) => {
    if (!(await isCommissioner(context))) throw new Error("Commissioners only.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type SeasonInput = {
  season: number;
  champion: string;
  champion_owner: string;
  runner_up: string;
  runner_up_owner: string;
  regular_season_best: string;
  notes: string;
  standings: Array<{ place: number; team: string; owner: string; record: string }>;
};

export const saveSeason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SeasonInput) => data)
  .handler(async ({ data, context }) => {
    if (!(await isCommissioner(context))) throw new Error("Commissioners only.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("season_history")
      .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "season" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSeason = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { season: number }) => data)
  .handler(async ({ data, context }) => {
    if (!(await isCommissioner(context))) throw new Error("Commissioners only.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("season_history")
      .delete()
      .eq("season", data.season);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Commissioner hands a family member a fresh start: password back to the family password. */
export const resetMemberPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    if (!(await isCommissioner(context))) throw new Error("Commissioners only.");
    const password = process.env["FAMILY_PASSWORD"];
    if (!password) throw new Error("The family password is not set up yet.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Commissioner removes a family member completely and frees up their team. */
export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    if (!(await isCommissioner(context))) throw new Error("Commissioners only.");
    if (data.userId === context.userId) throw new Error("You cannot remove your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin.from("teams").update({ user_id: null }).eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
