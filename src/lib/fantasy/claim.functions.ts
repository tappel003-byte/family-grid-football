import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";

export type ClaimableTeam = {
  slot: number;
  name: string;
  owner: string;
  color: string;
  division: string;
  claimed: boolean;
};

function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input.trim().toLowerCase(), "utf8").digest();
  const b = createHash("sha256").update(expected.trim().toLowerCase(), "utf8").digest();
  return timingSafeEqual(a, b);
}

function emailForSlot(slot: number) {
  return `team-${slot + 1}@lafamiliafantasyfootball.com`;
}

/** The ten helmets shown on the claim screen (no private data). */
export const listClaimTeams = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: league } = await supabaseAdmin
    .from("league")
    .select("id, name")
    .eq("slug", "main")
    .maybeSingle();
  if (!league) return { leagueName: "La Familia", teams: [] as ClaimableTeam[] };

  const { data: teams } = await supabaseAdmin
    .from("teams")
    .select("slot, name, owner, color, division, user_id")
    .eq("league_id", league.id)
    .order("slot");

  return {
    leagueName: league.name,
    teams: (teams ?? []).map((t) => ({
      slot: t.slot,
      name: t.name,
      owner: t.owner,
      color: t.color,
      division: t.division ?? "",
      claimed: !!t.user_id,
    })),
  };
});

/**
 * Claim a team with the shared family password. Returns the sign-in email the
 * browser then uses with that same password. Deliberately low-friction: this
 * is a private ten-person family league.
 */
export const claimTeam = createServerFn({ method: "POST" })
  .inputValidator((data: { slot: number; password: string; displayName: string }) => data)
  .handler(async ({ data }) => {
    const expected = process.env["FAMILY_PASSWORD"];
    if (!expected) throw new Error("The family password has not been set up yet.");
    if (!data.password || !matches(data.password, expected)) {
      return { ok: false as const, message: "That family password doesn't match." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: league } = await supabaseAdmin
      .from("league")
      .select("id")
      .eq("slug", "main")
      .maybeSingle();
    if (!league) throw new Error("The league isn't set up yet.");

    const { data: team } = await supabaseAdmin
      .from("teams")
      .select("id, slot, name, owner, user_id")
      .eq("league_id", league.id)
      .eq("slot", data.slot)
      .maybeSingle();
    if (!team) return { ok: false as const, message: "That team no longer exists." };

    const name = data.displayName.trim() || team.owner || team.name;
    let email = emailForSlot(team.slot);
    let userId = team.user_id ?? null;

    if (userId) {
      // Team already claimed — let them back in with the family password.
      const { data: existing } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (existing?.user) {
        email = existing.user.email ?? email;
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: expected });
      } else {
        userId = null;
      }
    }

    if (!userId) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: expected,
        email_confirm: true,
        user_metadata: { full_name: name },
      });
      if (error || !created?.user) {
        // Account for this helmet already exists from an earlier claim.
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
        const found = list?.users.find((u) => u.email === email);
        if (!found) throw new Error(error?.message ?? "Could not create the account.");
        userId = found.id;
        await supabaseAdmin.auth.admin.updateUserById(userId, { password: expected });
      } else {
        userId = created.user.id;
      }
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email, display_name: name }, { onConflict: "id" });

    // One person, one team.
    await supabaseAdmin
      .from("teams")
      .update({ user_id: null })
      .eq("league_id", league.id)
      .eq("user_id", userId);

    await supabaseAdmin
      .from("teams")
      .update({ user_id: userId, owner: name, updated_at: new Date().toISOString() })
      .eq("id", team.id);

    return { ok: true as const, email };
  });
