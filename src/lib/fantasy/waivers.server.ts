import { SLOTS, slotAccepts } from "./league";
import { normalizeRules } from "./rules";
import { lastWaiverRun } from "./waiver-cycle";
import type { ClaimRow } from "./waivers.functions";

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

/**
 * Worst record picks first. Records come from the archived weekly results,
 * so this needs no live feed.
 */
async function standingsOrder(
  admin: any,
  leagueId: string,
  slots: number[],
): Promise<number[]> {
  const { data: leagueRow } = await admin
    .from("league")
    .select("schedule")
    .eq("id", leagueId)
    .maybeSingle();
  const schedule = (leagueRow?.schedule ?? []) as Array<Array<[number, number]>>;
  const { data: rows } = await admin
    .from("weekly_results")
    .select("week, team_slot, points")
    .eq("league_id", leagueId);
  const results = (rows ?? []) as Array<{ week: number; team_slot: number; points: number }>;
  if (!results.length) return [];

  const pointsOf = (slot: number, week: number) =>
    Number(results.find((r) => r.team_slot === slot && r.week === week)?.points ?? 0);

  const weeks = [...new Set(results.map((r) => r.week))].sort((a, b) => a - b);
  const records = slots.map((slot) => {
    let score = 0;
    let pf = 0;
    for (const week of weeks) {
      const pair = (schedule[week - 1] ?? []).find(([h, a]) => h === slot || a === slot);
      if (!pair) continue;
      const mine = pointsOf(slot, week);
      const theirs = pointsOf(pair[0] === slot ? pair[1] : pair[0], week);
      pf += mine;
      if (mine > theirs) score += 2;
      else if (mine === theirs) score += 1;
    }
    return { slot, score, pf };
  });
  records.sort((a, b) => a.score - b.score || a.pf - b.pf || a.slot - b.slot);
  return records.map((r) => r.slot);
}

/**
 * Processes pending claims in claim order (worst record first). Without
 * `force`, only claims placed before the latest Wednesday 12:01am ET run.
 */
export async function processWaivers(
  admin: any,
  force: boolean,
): Promise<{ won: number; lost: number; waiting?: boolean }> {
  const { data: leagueRow } = await admin
    .from("league")
    .select("id, current_week, rules")
    .eq("slug", "main")
    .maybeSingle();
  if (!leagueRow) throw new Error("The league is not set up yet.");
  const rules = normalizeRules(leagueRow.rules);
  if (rules.waiverMode !== "waivers") throw new Error("Waivers are not turned on.");

  const { data: pending } = await admin
    .from("waiver_claims")
    .select("*")
    .eq("league_id", leagueRow.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  const claims = (pending ?? []) as unknown as ClaimRow[];
  if (!claims.length) return { won: 0, lost: 0 };

  const boundary = lastWaiverRun(Date.now());
  const ready = claims.filter((c) => (Date.parse(c.created_at) || 0) < boundary);
  const toRun = force ? claims : ready;
  if (toRun.length === 0) return { won: 0, lost: 0, waiting: true };

  const { data: teamRows } = await admin
    .from("teams")
    .select("id, slot, name, user_id, starters, bench")
    .eq("league_id", leagueRow.id)
    .order("slot", { ascending: true });
  const teams = ((teamRows ?? []) as unknown as TeamRow[]).slice();

  let order = rules.waiverOrder;
  if (rules.autoWaiverOrder) {
    const computed = await standingsOrder(
      admin,
      leagueRow.id,
      teams.map((t) => t.slot),
    );
    if (computed.length) {
      order = computed;
      await admin
        .from("league")
        .update({ rules: { ...rules, waiverOrder: computed } as never })
        .eq("id", leagueRow.id);
    }
  }

  const priority = (slot: number): [number, number] => {
    const idx = order.indexOf(slot);
    return [idx === -1 ? 999 : idx, slot];
  };
  const ordered = toRun.slice().sort((a, b) => {
    const [pa, sa] = priority(a.team_slot);
    const [pb, sb] = priority(b.team_slot);
    return pa - pb || sa - sb;
  });

  let won = 0;
  let lost = 0;

  for (const claim of ordered) {
    const team = teams.find((t) => t.slot === claim.team_slot);
    if (!team) {
      await admin
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
      await admin
        .from("waiver_claims")
        .update({ status: "lost", resolved_at: new Date().toISOString() })
        .eq("id", claim.id);
      lost++;
      continue;
    }

    team.starters = starters;
    team.bench = bench;
    const { error: updateError } = await admin
      .from("teams")
      .update({ starters, bench, updated_at: new Date().toISOString() })
      .eq("id", team.id);
    if (updateError) {
      await admin
        .from("waiver_claims")
        .update({ status: "lost", resolved_at: new Date().toISOString() })
        .eq("id", claim.id);
      lost++;
      continue;
    }

    await admin.from("transactions").insert({
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
    await admin
      .from("waiver_claims")
      .update({ status: "won", resolved_at: new Date().toISOString() })
      .eq("id", claim.id);
    won++;
  }

  return { won, lost };
}
