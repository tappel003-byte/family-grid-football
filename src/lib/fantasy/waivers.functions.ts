import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeRules } from "./rules";

export type ClaimRow = {
  id: string;
  team_slot: number;
  team_name: string;
  player_id: string;
  player_name: string;
  player_pos: string;
  player_team: string;
  drop_player_id: string | null;
  drop_player_name: string;
  week: number;
  status: string;
  actor_id: string | null;
  actor_name: string;
  created_at: string;
  resolved_at: string | null;
};

/** Pending claims first, then recently resolved. */
export const listClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ClaimRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("waiver_claims")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    return (data ?? []) as unknown as ClaimRow[];
  });

export const placeClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      playerId: string;
      playerName: string;
      playerPos: string;
      playerTeam: string;
      dropId: string | null;
      dropName: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: leagueRow } = await supabaseAdmin
      .from("league")
      .select("id, current_week, rules")
      .eq("slug", "main")
      .maybeSingle();
    if (!leagueRow) throw new Error("The league is not set up yet.");
    const rules = normalizeRules(leagueRow.rules);
    if (rules.waiverMode !== "waivers") {
      throw new Error("The league is not using waivers right now.");
    }

    const { data: teamRows } = await supabaseAdmin
      .from("teams")
      .select("id, slot, name, user_id, starters, bench")
      .eq("league_id", leagueRow.id)
      .order("slot", { ascending: true });
    const teams = (teamRows ?? []) as unknown as TeamRow[];
    const mine = teams.find((t) => t.user_id === context.userId);
    if (!mine) throw new Error("You do not have a team in this league yet.");

    const owner = teams.find((t) => idsOf(t).includes(data.playerId));
    if (owner) {
      throw new Error(
        owner.id === mine.id
          ? `${data.playerName} is already on your roster.`
          : `${data.playerName} is on ${owner.name}'s roster.`,
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("waiver_claims")
      .select("id")
      .eq("league_id", leagueRow.id)
      .eq("player_id", data.playerId)
      .eq("team_slot", mine.slot)
      .eq("status", "pending")
      .limit(1);
    if ((existing ?? []).length > 0) {
      throw new Error(`You already have a claim in for ${data.playerName}.`);
    }

    if (data.dropId && !idsOf(mine).includes(data.dropId)) {
      throw new Error(`${data.dropName} is not on your roster.`);
    }
    if (!data.dropId) {
      const size = idsOf(mine).length;
      if (size >= rules.rosterLimit) {
        throw new Error(
          `Your roster is full (${rules.rosterLimit} players) — pick someone to drop with the claim.`,
        );
      }
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email")
      .eq("id", context.userId)
      .maybeSingle();

    await supabaseAdmin.from("waiver_claims").insert({
      league_id: leagueRow.id,
      team_slot: mine.slot,
      team_name: mine.name,
      player_id: data.playerId,
      player_name: data.playerName,
      player_pos: data.playerPos,
      player_team: data.playerTeam,
      drop_player_id: data.dropId,
      drop_player_name: data.dropName,
      week: leagueRow.current_week,
      actor_id: context.userId,
      actor_name: profile?.display_name || profile?.email || "",
    });

    return { ok: true };
  });

export const cancelClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { claimId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: commishFlag } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "commissioner",
    });
    const commish = commishFlag === true;

    const { data: claim } = await supabaseAdmin
      .from("waiver_claims")
      .select("*")
      .eq("id", data.claimId)
      .maybeSingle();
    if (!claim) throw new Error("That claim is gone.");
    if ((claim as ClaimRow).status !== "pending") {
      throw new Error("That claim was already processed.");
    }

    const { data: leagueRow } = await supabaseAdmin
      .from("league")
      .select("id")
      .eq("slug", "main")
      .maybeSingle();
    const { data: teamRows } = await supabaseAdmin
      .from("teams")
      .select("slot, user_id")
      .eq("league_id", leagueRow?.id ?? "");
    const mine = (teamRows ?? []).find(
      (t: { slot: number; user_id: string | null }) => t.user_id === context.userId,
    );
    if (!commish && mine && mine.slot !== (claim as ClaimRow).team_slot) {
      throw new Error("You can only pull back your own claim.");
    }

    await supabaseAdmin
      .from("waiver_claims")
      .update({ status: "cancelled", resolved_at: new Date().toISOString() })
      .eq("id", data.claimId);
    return { ok: true };
  });

/** Runs ready claims. `force` (commissioner-only) runs every pending claim now. */
export const runWaivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { force?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { data: commishFlag } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "commissioner",
    });
    if (data.force && commishFlag !== true) {
      throw new Error("Only the commissioner can run waivers early.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processWaivers } = await import("./waivers.server");
    return processWaivers(supabaseAdmin, !!data.force);
  });
