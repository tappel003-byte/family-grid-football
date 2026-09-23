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

async function fetchMoves(): Promise<Move[]> {
  const { data } = await supabase
    .from("transactions")
    .select("id, team_name, kind, added_player_name, dropped_player_name, actor_name, week, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Move[];
}

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function activityText(m: Move) {
  if (m.kind === "lineup") return `${m.team_name} changed its starting lineup`;
  if (m.kind === "trade_block_add") return `${m.team_name} made ${m.added_player_name} available for trade`;
  if (m.kind === "trade_block_remove") return `${m.team_name} removed ${m.dropped_player_name} from the trade block`;
  return null;
}

/** Every roster and lineup move in the league, newest first. */
export function ActivityFeed({ limit = 50 }: { limit?: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => (await fetchMoves()).slice(0, limit),
    refetchInterval: 1000 * 60,
  });

  if (isLoading) return <p className="px-4 py-6 text-muted-foreground">Loading recent moves…</p>;
  if (!data?.length)
    return <p className="px-4 py-6 text-muted-foreground">No roster moves yet this season.</p>;

  return (
    <ul className="divide-y">
      {data.map((m) => (
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
  );
}
