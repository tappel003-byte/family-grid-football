import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeRules } from "./rules";

export type IrInput = {
  playerId: string;
  playerName: string;
  /** true = park them on injured reserve, false = bring them back to the bench. */
  toIR: boolean;
  /** Commissioners may act for another team. */
  slot?: number | null;
};

/** Moves one player between a team's active roster and its injured-reserve spot(s). */
export const setInjuredReserve = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: IrInput) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: leagueRow } = await supabaseAdmin
      .from("league")
      .select("id, current_week, rules")
      .eq("slug", "main")
      .maybeSingle();
    if (!leagueRow) throw new Error("The league is not set up yet.");
    const rules = normalizeRules(leagueRow.rules);
    if (rules.irSlots <= 0) throw new Error("Injured reserve is turned off in this league.");

    const { data: teamRows, error: teamsError } = await supabaseAdmin
      .from("teams")
      .select("id, slot, name, user_id, starters, bench, ir")
      .eq("league_id", leagueRow.id)
      .order("slot", { ascending: true });
    if (teamsError) throw new Error(teamsError.message);
    const teams = teamRows ?? [];

    const target = teams.find((t) => t.user_id === context.userId);
    if (!target) throw new Error("You do not have a team in this league yet.");

    const starters = ((target.starters as Array<string | null>) ?? []).slice();
    const bench = ((target.bench as string[]) ?? []).slice();
    const ir = (((target as { ir?: string[] }).ir as string[]) ?? []).slice();

    if (data.toIR) {
      if (ir.includes(data.playerId)) throw new Error(`${data.playerName} is already on IR.`);
      if (ir.length >= rules.irSlots) {
        throw new Error(
          rules.irSlots === 1
            ? "You only get one injured-reserve spot. Take someone off IR first."
            : `Your ${rules.irSlots} injured-reserve spots are full.`,
        );
      }
      const si = starters.indexOf(data.playerId);
      const bi = bench.indexOf(data.playerId);
      if (si === -1 && bi === -1) throw new Error(`${data.playerName} is not on this roster.`);
      if (si >= 0) starters[si] = null;
      else bench.splice(bi, 1);
      ir.push(data.playerId);
    } else {
      const ii = ir.indexOf(data.playerId);
      if (ii === -1) throw new Error(`${data.playerName} is not on injured reserve.`);
      const size = starters.filter(Boolean).length + bench.length;
      if (size >= rules.rosterLimit) {
        throw new Error(
          `Your roster is full (${rules.rosterLimit} players). Drop someone before activating ${data.playerName}.`,
        );
      }
      ir.splice(ii, 1);
      bench.push(data.playerId);
    }

    const { error: updateError } = await supabaseAdmin
      .from("teams")
      .update({ starters, bench, ir, updated_at: new Date().toISOString() })
      .eq("id", target.id);
    if (updateError) throw new Error(updateError.message);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name, email")
      .eq("id", context.userId)
      .maybeSingle();

    await supabaseAdmin.from("transactions").insert({
      league_id: leagueRow.id,
      team_slot: target.slot,
      team_name: target.name,
      kind: data.toIR ? "ir" : "activate",
      added_player_id: data.toIR ? null : data.playerId,
      added_player_name: data.toIR ? "" : data.playerName,
      dropped_player_id: data.toIR ? data.playerId : null,
      dropped_player_name: data.toIR ? data.playerName : "",
      actor_id: context.userId,
      actor_name: profile?.display_name || profile?.email || "",
      week: leagueRow.current_week,
    });

    return { ok: true };
  });
