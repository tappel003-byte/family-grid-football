import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SLOTS, slotAccepts } from "./league";
import { normalizeRules } from "./rules";

/** How long a claim waits before it processes on its own (commissioner can run early). */
const AUTO_PROCESS_MS = 1000 * 60 * 60 * 24;

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

type TeamRow = {
  id: string;
  slot: number;
  name: string;
  user_id: string | null;
  starters: Array<string | null> | null;
  bench: string[] | null;
};

function idsOf(team: TeamRow): string[] {
  return [
    ...(((team.starters as Array<string | null>) ?? []).filter(Boolean) as string[]),
    ...(((team.bench as string[]) ?? []) as string[]),
  ];
}

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
      .eq("status", "pending")
      .limit(1);
    if ((existing ?? []).length > 0) {
      throw new Error(`Someone already has a claim in for ${data.playerName}.`);
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

/**
 * Runs every pending claim in claiming order (worst team picks first).
 * `force` is commissioner-only; without it the claim must be a day old,
 * which lets any family member's app trigger the nightly run.
 */
export const runWaivers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { force?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: commishFlag } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "commissioner",
    });
    if (data.force && commishFlag !== true) {
      throw new Error("Only the commissioner can run waivers early.");
    }

    const { data: leagueRow } = await supabaseAdmin
      .from("league")
      .select("id, current_week, rules")
      .eq("slug", "main")
      .maybeSingle();
    if (!leagueRow) throw new Error("The league is not set up yet.");
    const rules = normalizeRules(leagueRow.rules);
    if (rules.waiverMode !== "waivers") throw new Error("Waivers are not turned on.");

    const { data: pending } = await supabaseAdmin
      .from("waiver_claims")
      .select("*")
      .eq("league_id", leagueRow.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const claims = (pending ?? []) as unknown as ClaimRow[];
    if (!claims.length) return { won: 0, lost: 0 };

    const oldest = claims.reduce(
      (min, c) => Math.min(min, Date.parse(c.created_at) || Date.now()),
      Number.POSITIVE_INFINITY,
    );
    if (!data.force && Date.now() - oldest < AUTO_PROCESS_MS) {
      return { won: 0, lost: 0, waiting: true };
    }

    const { data: teamRows } = await supabaseAdmin
      .from("teams")
      .select("id, slot, name, user_id, starters, bench")
      .eq("league_id", leagueRow.id)
      .order("slot", { ascending: true });
    const teams = ((teamRows ?? []) as unknown as TeamRow[]).slice();

    const priority = (slot: number): [number, number] => {
      const idx = rules.waiverOrder.indexOf(slot);
      return [idx === -1 ? 999 : idx, slot];
    };
    const ordered = claims.slice().sort((a, b) => {
      const [pa, sa] = priority(a.team_slot);
      const [pb, sb] = priority(b.team_slot);
      return pa - pb || sa - sb;
    });

    let won = 0;
    let lost = 0;

    for (const claim of ordered) {
      const team = teams.find((t) => t.slot === claim.team_slot);
      if (!team) {
        await supabaseAdmin
          .from("waiver_claims")
          .update({ status: "lost", resolved_at: new Date().toISOString() })
          .eq("id", claim.id);
        lost++;
        continue;
      }

      // Is the player still a free agent?
      const owner = teams.find((t) => idsOf(t).includes(claim.player_id));
      let reason = "";
      if (owner) reason = owner.id === team.id ? "already on your roster" : `won by ${owner.name}`;

      const starters = (((team.starters as Array<string | null>) ?? []) as Array<string | null>).slice();
      const bench = ((team.bench as string[]) ?? []).slice();

      let freedSlot = -1;
      if (!reason && claim.drop_player_id) {
        const si = starters.indexOf(claim.drop_player_id);
        const bi = bench.indexOf(claim.drop_player_id);
        if (si === -1 && bi === -1) {
          reason = `${claim.drop_player_name} is no longer on your roster`;
        } else if (si >= 0) {
          starters[si] = null;
          freedSlot = si;
        } else {
          bench.splice(bi, 1);
        }
      }

      if (!reason) {
        const size = starters.filter(Boolean).length + bench.length;
        if (size >= rules.rosterLimit) {
          reason = "no roster space";
        } else if (freedSlot >= 0) {
          const slotName = SLOTS[freedSlot];
          if (slotName && slotAccepts(slotName, claim.player_pos)) {
            starters[freedSlot] = claim.player_id;
          } else {
            bench.push(claim.player_id);
          }
        } else {
          bench.push(claim.player_id);
        }
      }

      if (reason) {
        await supabaseAdmin
          .from("waiver_claims")
          .update({ status: "lost", resolved_at: new Date().toISOString() })
          .eq("id", claim.id);
        lost++;
        continue;
      }

      team.starters = starters;
      team.bench = bench;
      const { error: updateError } = await supabaseAdmin
        .from("teams")
        .update({ starters, bench, updated_at: new Date().toISOString() })
        .eq("id", team.id);
      if (updateError) {
        await supabaseAdmin
          .from("waiver_claims")
          .update({ status: "lost", resolved_at: new Date().toISOString() })
          .eq("id", claim.id);
        lost++;
        continue;
      }

      await supabaseAdmin.from("transactions").insert({
        league_id: leagueRow.id,
        team_slot: team.slot,
        team_name: team.name,
        kind: "waiver",
        added_player_id: claim.player_id,
        added_player_name: claim.player_name,
        dropped_player_id: claim.drop_player_id,
        dropped_player_name: claim.drop_player_name,
        actor_id: claim.actor_id,
        actor_name: claim.actor_name,
        week: claim.week,
      });
      await supabaseAdmin
        .from("waiver_claims")
        .update({ status: "won", resolved_at: new Date().toISOString() })
        .eq("id", claim.id);
      won++;
    }

    return { won, lost };
  });
