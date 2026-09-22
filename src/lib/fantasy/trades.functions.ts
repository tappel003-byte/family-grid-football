import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeRules } from "./rules";

export type TradeRow = {
  id: string;
  fromSlot: number;
  toSlot: number;
  fromTeamName: string;
  toTeamName: string;
  fromPlayerIds: string[];
  toPlayerIds: string[];
  fromPlayerNames: string[];
  toPlayerNames: string[];
  note: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  week: number;
  proposerName: string;
  resolverName: string;
  createdAt: string;
};

async function loadContext(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: leagueRow } = await supabaseAdmin
    .from("league")
    .select("id, current_week, rules")
    .eq("slug", "main")
    .maybeSingle();
  if (!leagueRow) throw new Error("The league is not set up yet.");

  const { data: teamRows, error } = await supabaseAdmin
    .from("teams")
    .select("id, slot, name, user_id, starters, bench")
    .eq("league_id", leagueRow.id)
    .order("slot", { ascending: true });
  if (error) throw new Error(error.message);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("display_name, email")
    .eq("id", userId)
    .maybeSingle();

  return {
    supabaseAdmin,
    leagueRow,
    rules: normalizeRules(leagueRow.rules),
    teams: teamRows ?? [],
    actorName: profile?.display_name || profile?.email || "",
  };
}

function mapTrade(t: any): TradeRow {
  return {
    id: t.id,
    fromSlot: t.from_slot,
    toSlot: t.to_slot,
    fromTeamName: t.from_team_name,
    toTeamName: t.to_team_name,
    fromPlayerIds: t.from_player_ids ?? [],
    toPlayerIds: t.to_player_ids ?? [],
    fromPlayerNames: t.from_player_names ?? [],
    toPlayerNames: t.to_player_names ?? [],
    note: t.note ?? "",
    status: t.status,
    week: t.week,
    proposerName: t.proposer_name ?? "",
    resolverName: t.resolver_name ?? "",
    createdAt: t.created_at,
  };
}

/** Every trade in the league, newest first. */
export const listTrades = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, leagueRow } = await loadContext(context.userId);
    const { data, error } = await supabaseAdmin
      .from("trades")
      .select("*")
      .eq("league_id", leagueRow.id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapTrade);
  });

export type ProposeInput = {
  /** Slot of the team making the offer. Commissioners may set this; everyone else gets their own. */
  fromSlot?: number | null;
  toSlot: number;
  fromPlayerIds: string[];
  toPlayerIds: string[];
  fromPlayerNames: string[];
  toPlayerNames: string[];
  note: string;
};

export const proposeTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ProposeInput) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, leagueRow, rules, teams, actorName } = await loadContext(
      context.userId,
    );
    const { data: commishFlag } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "commissioner",
    });
    const isCommissioner = commishFlag === true;

    if (rules.tradeDeadlineWeek > 0 && leagueRow.current_week > rules.tradeDeadlineWeek) {
      throw new Error(
        `The trade deadline was week ${rules.tradeDeadlineWeek}. No more trades this season.`,
      );
    }

    const from =
      isCommissioner && data.fromSlot != null
        ? teams.find((t) => t.slot === data.fromSlot)
        : teams.find((t) => t.user_id === context.userId);
    if (!from) throw new Error("You do not have a team in this league yet.");

    const to = teams.find((t) => t.slot === data.toSlot);
    if (!to) throw new Error("That team is not in the league.");
    if (to.id === from.id) throw new Error("You cannot trade with yourself.");
    if (!data.fromPlayerIds.length && !data.toPlayerIds.length) {
      throw new Error("Pick at least one player to trade.");
    }

    const onRoster = (team: typeof from, ids: string[]) => {
      const all = [
        ...(((team.starters as Array<string | null>) ?? []).filter(Boolean) as string[]),
        ...(((team.bench as string[]) ?? []) as string[]),
      ];
      return ids.every((id) => all.includes(id));
    };
    if (!onRoster(from, data.fromPlayerIds) || !onRoster(to, data.toPlayerIds)) {
      throw new Error("One of those players is no longer on that roster.");
    }

    const { error } = await supabaseAdmin.from("trades").insert({
      league_id: leagueRow.id,
      from_slot: from.slot,
      to_slot: to.slot,
      from_team_name: from.name,
      to_team_name: to.name,
      from_player_ids: data.fromPlayerIds,
      to_player_ids: data.toPlayerIds,
      from_player_names: data.fromPlayerNames,
      to_player_names: data.toPlayerNames,
      note: data.note ?? "",
      status: "pending",
      week: leagueRow.current_week,
      proposer_id: context.userId,
      proposer_name: actorName,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type RespondInput = {
  tradeId: string;
  action: "accept" | "decline" | "cancel";
};

/** Accept, decline or cancel a trade. Accepting swaps the players on both rosters. */
export const respondToTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: RespondInput) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, leagueRow, rules, teams, actorName } = await loadContext(
      context.userId,
    );
    const { data: commishFlag } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "commissioner",
    });
    const isCommissioner = commishFlag === true;

    const { data: trade } = await supabaseAdmin
      .from("trades")
      .select("*")
      .eq("id", data.tradeId)
      .maybeSingle();
    if (!trade) throw new Error("That trade no longer exists.");
    if (trade.status !== "pending") throw new Error("That trade has already been settled.");

    const from = teams.find((t) => t.slot === trade.from_slot);
    const to = teams.find((t) => t.slot === trade.to_slot);
    if (!from || !to) throw new Error("One of those teams is gone.");

    if (data.action === "cancel") {
      if (!isCommissioner && from.user_id !== context.userId) {
        throw new Error("Only the team that offered this trade can cancel it.");
      }
    } else if (!isCommissioner && to.user_id !== context.userId) {
      throw new Error("Only the team receiving this offer can answer it.");
    }

    if (data.action !== "accept") {
      const { error } = await supabaseAdmin
        .from("trades")
        .update({
          status: data.action === "cancel" ? "cancelled" : "declined",
          resolver_id: context.userId,
          resolver_name: actorName,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", trade.id)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return { ok: true, status: data.action === "cancel" ? "cancelled" : "declined" };
    }

    const give: string[] = trade.from_player_ids ?? [];
    const get: string[] = trade.to_player_ids ?? [];

    const apply = (team: typeof from, out: string[], incoming: string[]) => {
      const starters = ((team.starters as Array<string | null>) ?? []).slice();
      const bench = ((team.bench as string[]) ?? []).slice();
      for (const id of out) {
        const si = starters.indexOf(id);
        const bi = bench.indexOf(id);
        if (si === -1 && bi === -1) {
          throw new Error("A player in this trade is no longer on the right roster.");
        }
        if (si >= 0) starters[si] = null;
        else bench.splice(bi, 1);
      }
      for (const id of incoming) bench.push(id);
      const size = starters.filter(Boolean).length + bench.length;
      if (size > rules.rosterLimit) {
        throw new Error(
          `${team.name} would end up with ${size} players — the limit is ${rules.rosterLimit}.`,
        );
      }
      return { starters, bench };
    };

    const fromNext = apply(from, give, get);
    const toNext = apply(to, get, give);

    const stamp = new Date().toISOString();
    const [a, b] = await Promise.all([
      supabaseAdmin.from("teams").update({ ...fromNext, updated_at: stamp }).eq("id", from.id),
      supabaseAdmin.from("teams").update({ ...toNext, updated_at: stamp }).eq("id", to.id),
    ]);
    if (a.error) throw new Error(a.error.message);
    if (b.error) throw new Error(b.error.message);

    await supabaseAdmin
      .from("trades")
      .update({
        status: "accepted",
        resolver_id: context.userId,
        resolver_name: actorName,
        resolved_at: stamp,
      })
      .eq("id", trade.id);

    const names = (list: string[]) => (list.length ? list.join(", ") : "nobody");
    await supabaseAdmin.from("transactions").insert([
      {
        league_id: leagueRow.id,
        team_slot: from.slot,
        team_name: from.name,
        kind: "trade",
        added_player_name: names(trade.to_player_names ?? []),
        dropped_player_name: names(trade.from_player_names ?? []),
        actor_id: context.userId,
        actor_name: actorName,
        week: leagueRow.current_week,
      },
      {
        league_id: leagueRow.id,
        team_slot: to.slot,
        team_name: to.name,
        kind: "trade",
        added_player_name: names(trade.from_player_names ?? []),
        dropped_player_name: names(trade.to_player_names ?? []),
        actor_id: context.userId,
        actor_name: actorName,
        week: leagueRow.current_week,
      },
    ]);

    return { ok: true, status: "accepted" };
  });
