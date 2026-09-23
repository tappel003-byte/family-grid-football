import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Move = {
  id: string;
  team_name: string;
  kind: string;
  added_player_name: string;
  dropped_player_name: string;
  actor_name: string;
  week: number;
  created_at: string;
};

type Filter = "all" | "adds" | "trades" | "ir" | "commish";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All moves" },
  { value: "adds", label: "Adds and drops" },
  { value: "trades", label: "Trades" },
  { value: "ir", label: "IR" },
  { value: "commish", label: "Commissioner changes" },
];

async function fetchMoves(): Promise<Move[]> {
  const { data } = await supabase
    .from("transactions")
    .select("id, team_name, kind, added_player_name, dropped_player_name, actor_name, week, created_at")
    .neq("kind", "lineup")
    .order("created_at", { ascending: false })
    .limit(150);
  return (data ?? []) as Move[];
}

function matches(kind: string, f: Filter) {
  if (f === "all") return true;
  if (f === "commish") return kind.startsWith("commish_");
  const base = kind.replace(/^commish_/, "");
  if (f === "adds") return ["add", "drop", "add_drop", "waiver"].includes(base) || base.startsWith("waiver");
  if (f === "trades") return base.startsWith("trade");
  if (f === "ir") return base === "ir" || base === "activate";
  return true;
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function activityText(m: Move) {
  const who = m.actor_name || "A commissioner";
  switch (m.kind) {
    case "commish_lineup": return `${who} (commissioner) changed ${m.team_name}'s starting lineup`;
    case "commish_drop": return `${who} (commissioner) dropped ${m.dropped_player_name} from ${m.team_name}`;
    case "commish_add": return `${who} (commissioner) added ${m.added_player_name} to ${m.team_name}`;
    case "commish_add_drop": return `${who} (commissioner) added ${m.added_player_name} and dropped ${m.dropped_player_name} for ${m.team_name}`;
    case "commish_ir": return `${who} (commissioner) moved ${m.dropped_player_name} to IR for ${m.team_name}`;
    case "commish_activate": return `${who} (commissioner) brought ${m.added_player_name} back from IR for ${m.team_name}`;
    case "ir": return `${m.team_name} moved ${m.dropped_player_name} to IR`;
    case "activate": return `${m.team_name} brought ${m.added_player_name} back from IR`;
    case "trade_block_add": return `${m.team_name} made ${m.added_player_name} available for trade`;
    case "trade_block_remove": return `${m.team_name} removed ${m.dropped_player_name} from the trade block`;
  }
  return null;
}

/** League moves, newest first. Owners' own lineup changes are not shown. */
export function ActivityFeed({ limit = 50 }: { limit?: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: fetchMoves,
    refetchInterval: 1000 * 60,
  });

  const shown = (data ?? []).filter((m) => matches(m.kind, filter)).slice(0, limit);

  return (
    <div>
      <div className="border-b px-4 py-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          Show
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="h-9 rounded-md border bg-background px-2 text-base"
          >
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
      </div>
      {isLoading ? (
        <p className="px-4 py-6 text-muted-foreground">Loading recent moves…</p>
      ) : !shown.length ? (
        <p className="px-4 py-6 text-muted-foreground">No moves here yet this season.</p>
      ) : (
        <ul className="divide-y">
          {shown.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <p className="text-base font-semibold">
                {activityText(m) ?? (
                  <>
                    {m.team_name}
                    {m.added_player_name && (
                      <>{" added "}<span className="text-green-700 dark:text-green-400">{m.added_player_name}</span></>
                    )}
                    {m.added_player_name && m.dropped_player_name && " and"}
                    {m.dropped_player_name && (
                      <>{" dropped "}<span className="text-red-700 dark:text-red-400">{m.dropped_player_name}</span></>
                    )}
                  </>
                )}
              </p>
              <p className="text-sm text-muted-foreground">
                Week {m.week} · {when(m.created_at)}
                {m.actor_name ? ` · ${m.actor_name}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
