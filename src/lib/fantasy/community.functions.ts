import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const tradeBlockInput = z.object({
  teamSlot: z.number().int().min(0).max(11),
  playerId: z.string().min(1).max(80),
  playerName: z.string().min(1).max(100),
  listed: z.boolean(),
});

export const updateTradeBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => tradeBlockInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: league } = await supabaseAdmin
      .from("league")
      .select("id, current_week")
      .eq("slug", "main")
      .single();
    if (!league) throw new Error("The league is not ready yet.");

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("name, owner, starters, bench")
      .eq("league_id", league.id)
      .eq("slot", data.teamSlot)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!team) throw new Error("Only your team can be changed.");
    const roster = [...((team.starters as Array<string | null>) ?? []), ...((team.bench as string[]) ?? [])];
    if (!roster.includes(data.playerId)) throw new Error("That player is not on your roster.");

    const action = data.listed
      ? supabaseAdmin.from("trade_block").upsert({ league_id: league.id, team_slot: data.teamSlot, user_id: context.userId, player_id: data.playerId })
      : supabaseAdmin.from("trade_block").delete().eq("league_id", league.id).eq("player_id", data.playerId).eq("user_id", context.userId);
    const { error } = await action;
    if (error) throw new Error(error.message);

    const { data: profile } = await supabaseAdmin.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
    const { error: activityError } = await supabaseAdmin.from("transactions").insert({
      league_id: league.id,
      team_slot: data.teamSlot,
      team_name: team.name,
      kind: data.listed ? "trade_block_add" : "trade_block_remove",
      added_player_name: data.listed ? data.playerName : "",
      dropped_player_name: data.listed ? "" : data.playerName,
      actor_id: context.userId,
      actor_name: profile?.display_name ?? team.owner,
      week: league.current_week,
    });
    if (activityError) throw new Error(activityError.message);
    return { ok: true as const };
  });