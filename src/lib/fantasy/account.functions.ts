import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyAccount = {
  email: string;
  displayName: string;
  timeZone: string;
  isCommissioner: boolean;
  team: { slot: number; name: string; color: string; division: string } | null;
};

/** Everything the signed-in family member can see and change about themselves. */
export const getMyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAccount> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profile }, { data: roles }, { data: team }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("email, display_name, time_zone")
        .eq("id", context.userId)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId),
      supabaseAdmin
        .from("teams")
        .select("slot, name, color, division")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    return {
      email: profile?.email ?? "",
      displayName: profile?.display_name ?? "",
      timeZone: profile?.time_zone ?? "America/Denver",
      isCommissioner: (roles ?? []).some((r) => r.role === "commissioner"),
      team: team
        ? {
            slot: team.slot,
            name: team.name,
            color: team.color,
            division: team.division ?? "",
          }
        : null,
    };
  });

/** Save your own name, team name and team colour. Never touches anyone else. */
export const saveMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { displayName: string; teamName?: string; color?: string; timeZone?: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const displayName = data.displayName.trim().slice(0, 60);
    if (!displayName) throw new Error("Please enter your name.");
    const timeZone = data.timeZone?.trim() || "America/Denver";
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format();
    } catch {
      throw new Error("Please choose a valid time zone.");
    }

    await supabaseAdmin
      .from("profiles")
      .update({ display_name: displayName, time_zone: timeZone })
      .eq("id", context.userId);

    await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      user_metadata: { full_name: displayName },
    });

    const teamName = data.teamName?.trim().slice(0, 40);
    const color = /^#[0-9a-fA-F]{6}$/.test(data.color ?? "") ? data.color : undefined;

    const { error } = await supabaseAdmin
      .from("teams")
      .update({
        owner: displayName,
        ...(teamName ? { name: teamName } : {}),
        ...(color ? { color } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    return { ok: true as const };
  });
