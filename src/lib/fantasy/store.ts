import { useSyncExternalStore } from "react";
import type { League } from "./league";
import { LEAGUE_VERSION } from "./league";

const KEY = "family-ff-league-v3";

let league: League | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function load(): League | null {
  if (loaded) return league;
  loaded = true;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as League;
    if (parsed.version !== LEAGUE_VERSION) return null;
    league = parsed;
  } catch {
    league = null;
  }
  return league;
}

function persist() {
  if (typeof window === "undefined" || !league) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(league));
  } catch {
    /* ignore quota errors */
  }
}

export function setLeague(next: League) {
  league = next;
  persist();
  emit();
}

export function updateLeague(fn: (current: League) => League) {
  if (!league) return;
  setLeague(fn(league));
}

export function resetLeague() {
  league = null;
  if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): League | null {
  return load();
}

function getServerSnapshot(): League | null {
  return null;
}

export function useLeagueStore(): League | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
