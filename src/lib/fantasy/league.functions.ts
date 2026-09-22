import { createServerFn } from "@tanstack/react-start";
import type { League, FantasyTeam } from "./league";

type TeamRow = {
  slot: number;
  name: string;
  owner: string;
  color: string;
  starters: Array<string | null>;
  bench: string[];
};

export type LeaguePayload = {
  name: string;
  currentWeek: number;
  scoring: Record<string, number>;
  schedule: Array<Array<[number, number]>>;
  teams: TeamRow[];
};

export function toPayload(league: League): LeaguePayload {
  return {
    name: league.name,
    currentWeek: league.currentWeek,
    scoring: league.scoring as unknown as Record<string, number>,
    schedule: league.schedule,
    teams: league.teams.map((t: FantasyTeam, i) => ({
      slot: i,
      name: t.name,
      owner: t.owner,
      color: t.color,
      starters: t.starters,
      bench: t.bench,
    })),
  };
}

/** Writes the whole league. This is a private family league, so any visitor may edit. */
export const saveLeague = createServerFn({ method: "POST" })
  .inputValidator((data: LeaguePayload) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("league")
      .select("id")
      .eq("slug", "main")
      .maybeSingle();

    let leagueId = existing?.id;
    if (!leagueId) {
      const { data: created, error } = await supabaseAdmin
        .from("league")
        .insert({
          slug: "main",
          name: data.name,
          current_week: data.currentWeek,
          scoring: data.scoring,
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
  .inputValidator((data: SeasonInput) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("season_history")
      .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "season" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSeason = createServerFn({ method: "POST" })
  .inputValidator((data: { season: number }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("season_history")
      .delete()
      .eq("season", data.season);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
