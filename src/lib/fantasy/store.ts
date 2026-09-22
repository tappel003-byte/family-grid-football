import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FantasyTeam, League } from "./league";
import { LEAGUE_VERSION } from "./league";
import { saveLeague, toPayload } from "./league.functions";
import { PPR_SCORING, type Scoring } from "./scoring";

let league: League | null = null;
let status: "idle" | "loading" | "ready" = "idle";
let lastLocalWrite = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function leagueStatus() {
  return status;
}

async function fetchLeague(): Promise<League | null> {
  const { data: row } = await supabase
    .from("league")
    .select("id, name, current_week, scoring, schedule")
    .eq("slug", "main")
    .maybeSingle();
  if (!row) return null;

  const { data: teamRows } = await supabase
    .from("teams")
    .select("slot, name, owner, color, starters, bench, user_id")
    .eq("league_id", row.id)
    .order("slot", { ascending: true });

  const teams: FantasyTeam[] = (teamRows ?? []).map((t, i) => ({
    id: `team-${(t.slot ?? i) + 1}`,
    name: t.name,
    owner: t.owner,
    color: t.color,
    starters: (t.starters as Array<string | null>) ?? [],
    bench: (t.bench as string[]) ?? [],
    userId: t.user_id ?? null,
  }));

  if (!teams.length) return null;

  return {
    version: LEAGUE_VERSION,
    name: row.name,
    currentWeek: row.current_week,
    scoring: { ...PPR_SCORING, ...((row.scoring ?? {}) as Partial<Scoring>) },
    teams,
    schedule: (row.schedule as Array<Array<[number, number]>>) ?? [],
  };
}

let realtimeBound = false;

function bindRealtime() {
  if (realtimeBound || typeof window === "undefined") return;
  realtimeBound = true;
  supabase
    .channel("league-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "league" }, onRemoteChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, onRemoteChange)
    .subscribe();
}

async function onRemoteChange() {
  if (Date.now() - lastLocalWrite < 2500) return;
  const next = await fetchLeague();
  if (next) {
    league = next;
    emit();
  }
}

/** Loads the shared league once per browser session. */
export async function hydrateLeague(): Promise<League | null> {
  if (status !== "idle") return league;
  status = "loading";
  emit();
  try {
    league = await fetchLeague();
  } catch {
    league = null;
  }
  status = "ready";
  bindRealtime();
  emit();
  return league;
}

function queueSave() {
  if (typeof window === "undefined" || !league) return;
  lastLocalWrite = Date.now();
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (!league) return;
    lastLocalWrite = Date.now();
    void saveLeague({ data: toPayload(league) }).catch((err: unknown) => {
      console.error("Could not save the league", err);
    });
  }, 700);
}

export function setLeague(next: League) {
  league = next;
  status = "ready";
  emit();
  queueSave();
}

export function updateLeague(fn: (current: League) => League) {
  if (!league) return;
  setLeague(fn(league));
}

export async function reloadLeague() {
  league = await fetchLeague();
  emit();
}

export async function resetLeague() {
  league = null;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): League | null {
  return league;
}

function getServerSnapshot(): League | null {
  return null;
}

export function useLeagueStore(): League | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
