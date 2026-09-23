import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

let cachedSession: Session | null = null;
const KEEP_SIGNED_IN_KEY = "la-familia-keep-signed-in";
const SESSION_BACKUP_KEY = "la-familia-session-backup";
const ACTIVE_TAB_KEY = "la-familia-active-tab";

function canUseStorage() {
  return typeof window !== "undefined";
}

function keepSignedIn() {
  return !canUseStorage() || window.localStorage.getItem(KEEP_SIGNED_IN_KEY) !== "false";
}

function saveSessionBackup(session: Session | null) {
  if (!canUseStorage()) return;
  if (session && keepSignedIn()) {
    window.localStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(session));
  }
}

async function restoreRememberedSession() {
  if (!canUseStorage() || !keepSignedIn()) return null;
  const raw = window.localStorage.getItem(SESSION_BACKUP_KEY);
  if (!raw) return null;
  try {
    const saved = JSON.parse(raw) as Partial<Session>;
    if (typeof saved.access_token !== "string" || typeof saved.refresh_token !== "string") return null;
    const { data, error } = await supabase.auth.setSession({
      access_token: saved.access_token,
      refresh_token: saved.refresh_token,
    });
    if (error) {
      window.localStorage.removeItem(SESSION_BACKUP_KEY);
      return null;
    }
    return data.session;
  } catch {
    window.localStorage.removeItem(SESSION_BACKUP_KEY);
    return null;
  }
}

export function setKeepSignedIn(value: boolean, session: Session | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(KEEP_SIGNED_IN_KEY, String(value));
  if (value) {
    window.sessionStorage.removeItem(ACTIVE_TAB_KEY);
    saveSessionBackup(session);
  } else {
    window.localStorage.removeItem(SESSION_BACKUP_KEY);
    window.sessionStorage.setItem(ACTIVE_TAB_KEY, "true");
  }
}

/** The signed-in family member, or null when nobody is signed in. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(cachedSession);
  const [loading, setLoading] = useState(cachedSession === null);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      cachedSession = next;
      if (event === "SIGNED_OUT") {
        if (canUseStorage()) window.localStorage.removeItem(SESSION_BACKUP_KEY);
      } else {
        saveSessionBackup(next);
      }
      if (!active) return;
      setSession(next);
      setLoading(false);
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      let next = data.session;
      if (next && !keepSignedIn() && !window.sessionStorage.getItem(ACTIVE_TAB_KEY)) {
        await supabase.auth.signOut();
        next = null;
      } else if (!next) {
        next = await restoreRememberedSession();
      }
      cachedSession = next;
      saveSessionBackup(next);
      if (!active) return;
      setSession(next);
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
