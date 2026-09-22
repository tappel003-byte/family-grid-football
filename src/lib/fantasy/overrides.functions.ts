import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireCommissioner(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "commissioner",
  });
  if (data !== true) throw new Error("Only a commissioner can correct a score.");
}

export type OverrideInput = {
  week: number;
  teamSlot: number;
  /** null clears the correction and goes back to the live score. */
  points: number | null;
  note: string;
};

/** Commissioner sets or clears a hand-entered final score for one team in one week. */
export const setScoreOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: OverrideInput) => data)
  .handler(async ({ data, context }) => {
    await requireCommissioner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: leagueRow } = await supabaseAdmin
      .from("league")
      .select("id")
      .eq("slug", "main")
      .maybeSingle();
    if (!leagueRow) throw new Error("The league is not set up yet.");

    if (data.points == null || !Number.isFinite(data.points)) {
      const { error } = await supabaseAdmin
        .from("score_overrides")
        .delete()
        .eq("league_id", leagueRow.id)
        .eq("week", data.week)
        .eq("team_slot", data.teamSlot);
      if (error) throw new Error(error.message);
      return { ok: true, cleared: true };
    }

    const { error } = await supabaseAdmin.from("score_overrides").upsert(
      {
        league_id: leagueRow.id,
        week: data.week,
        team_slot: data.teamSlot,
        points: data.points,
        note: data.note ?? "",
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "league_id,week,team_slot" },
    );
    if (error) throw new Error(error.message);
    return { ok: true, cleared: false };
  });
