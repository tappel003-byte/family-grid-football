import { createContext, useContext, type ReactNode } from "react";

export const DEFAULT_TIME_ZONE = "America/Denver";

const TimeZoneContext = createContext(DEFAULT_TIME_ZONE);

export function TimeZoneProvider({ value, children }: { value?: string; children: ReactNode }) {
  return <TimeZoneContext.Provider value={value || DEFAULT_TIME_ZONE}>{children}</TimeZoneContext.Provider>;
}

export function useTimeZone() {
  return useContext(TimeZoneContext);
}

export function formatGameTime(startsAt: string | undefined, timeZone: string) {
  if (!startsAt) return null;
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(date);
}