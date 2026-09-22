import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SLOTS, slotAccepts } from "./league";
import { normalizeRules } from "./rules";

export type MoveInput = {
  /** Player being picked up, if any. */
  addId: string | null;
  addName: string;
  addPos: string;
  /** Player being released, if any. */
  dropId: string | null;
  dropName: string;
  /** Commissioners may act for another team. */
  slot?: number | null;
};

/**
 * Adds and/or drops a player for one team. Checks ownership, roster size and
 * that nobody else already grabbed the player, then records the move.
 */
export const makeRosterMove = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: MoveInput) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: commishFlag } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "commissioner",
    });
    const isCommissioner = commishFlag === true;

    const { data: leagueRow } = await supabaseAdmin
      .from("league")
      .select("id, current_week, rules")
      .eq("slug", "main")
      .maybeSingle();
    if (!leagueRow) throw new Error("The league is not set up yet.");
    const ROSTER_LIMIT = normalizeRules(leagueRow.rules).rosterLimit;

    const { data: teamRows, error: teamsError } = await supabaseAdmin
      .from("teams")
      .select("id, slot, name, user_id, starters, bench, ir")
      .eq("league_id", leagueRow.id)
      .order("slot", { ascending: true });
    if (teamsError) throw new Error(teamsError.message);
    const teams = teamRows ?? [];

    const target =
      isCommissioner && data.slot != null
        ? teams.find((t) => t.slot === data.slot)
        : teams.find((t) => t.user_id === context.userId);
    if (!target) throw new Error("You do not have a team in this league yet.");

    const starters = ((target.starters as Array<string | null>) ?? []).slice();
    const bench = ((target.bench as string[]) ?? []).slice();
    const ir = (((target as { ir?: string[] }).ir as string[]) ?? []).slice();

    if (data.addId) {
      const taken = teams.find((t) => {
        const ids = [
          ...(((t.starters as Array<string | null>) ?? []).filter(Boolean) as string[]),
          ...(((t.bench as string[]) ?? []) as string[]),
          ...((((t as { ir?: string[] }).ir as string[]) ?? []) as string[]),
        ];
        return ids.includes(data.addId!);
      });
      if (taken) {
        throw new Error(
          taken.id === target.id
            ? `${data.addName} is already on your roster.`
            : `${data.addName} was just picked up by ${taken.name}.`,
        );
      }
    }

    let freedSlot = -1;
    if (data.dropId) {
      const si = starters.indexOf(data.dropId);
      const bi = bench.indexOf(data.dropId);
      const ii = ir.indexOf(data.dropId);
      if (si === -1 && bi === -1 && ii === -1)
        throw new Error(`${data.dropName} is not on this roster.`);
      if (si >= 0) {
        starters[si] = null;
        freedSlot = si;
      } else if (bi >= 0) {
        bench.splice(bi, 1);
      } else {
        ir.splice(ii, 1);
      }
    }

    if (data.addId) {
      const size = starters.filter(Boolean).length + bench.length;
      if (size >= ROSTER_LIMIT) {
        throw new Error(
          `Your roster is full (${ROSTER_LIMIT} players). Drop someone to add ${data.addName}.`,
        );
      }
      const slotName = freedSlot >= 0 ? SLOTS[freedSlot] : undefined;
      if (freedSlot >= 0 && slotName && slotAccepts(slotName, data.addPos)) {
        starters[freedSlot] = data.addId;
      } else {
        bench.push(data.addId);
      }
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
      kind: data.addId && data.dropId ? "add_drop" : data.addId ? "add" : "drop",
      added_player_id: data.addId,
      added_player_name: data.addName,
      dropped_player_id: data.dropId,
      dropped_player_name: data.dropName,
      actor_id: context.userId,
      actor_name: profile?.display_name || profile?.email || "",
      week: leagueRow.current_week,
    });

    return { ok: true, teamSlot: target.slot };
  });
