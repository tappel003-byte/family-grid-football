import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

let cachedSession: Session | null = null;

/** The signed-in family member, or null when nobody is signed in. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(cachedSession);
  const [loading, setLoading] = useState(cachedSession === null);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      cachedSession = next;
      if (!active) return;
      setSession(next);
      setLoading(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      cachedSession = data.session;
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export type Member = {
  id: string;
  email: string;
  display_name: string;
  role: "commissioner" | "member";
};

export function useMembers(enabled: boolean) {
  return useQuery({
    queryKey: ["family-members"],
    enabled,
    queryFn: async (): Promise<Member[]> => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleFor = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email,
        display_name: p.display_name || p.email,
        role: (roleFor.get(p.id) as Member["role"]) ?? "member",
      }));
    },
  });
}

/** Session plus whether this person is a commissioner. */
export function useAuth() {
  const { session, user, loading } = useSession();

  const { data: isCommissioner = false, isLoading: roleLoading } = useQuery({
    queryKey: ["my-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return (data ?? []).some((r) => r.role === "commissioner");
    },
  });

  return {
    session,
    user,
    loading: loading || (!!user && roleLoading),
    isCommissioner,
    displayName:
      (user?.user_metadata?.["full_name"] as string | undefined) ??
      user?.email?.split("@")[0] ??
      "",
  };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = "/";
}
