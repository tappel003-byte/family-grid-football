import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import type { League } from "@/lib/fantasy/league";
import { ownedIds } from "@/lib/fantasy/league";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { listMyWatchlist, setWatched } from "@/lib/fantasy/community";
import { scoreFor } from "@/lib/fantasy/hooks";
import { Button } from "@/components/ui/button";
import { AddDropButton } from "./AddDropButton";
import { InjuryBadge } from "./PlayerCell";
import { PlayerCardTrigger } from "./PlayerSheet";

/**
 * Players you've bookmarked from research. Lives under the position matrix
 * on My Team so you can Claim/Add or clear them without leaving the page.
 */
export function TeamWatchlist({
  league,
  byId,
  week,
}: {
  league: League;
  byId: Map<string, SlimPlayer>;
  week: number;
}) {
  const queryClient = useQueryClient();
  const { data: watchedIds = [], isLoading } = useQuery({
    queryKey: ["my-watchlist"],
    queryFn: listMyWatchlist,
  });

  const ownerByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of league.teams) {
      for (const id of ownedIds(t)) map.set(id, t.name);
    }
    return map;
  }, [league.teams]);

  const watched = useMemo(() => {
    const list = watchedIds
      .map((id) => byId.get(id))
      .filter((p): p is SlimPlayer => !!p);
    list.sort((a, b) => {
      const pos = a.pos.localeCompare(b.pos);
      if (pos) return pos;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [watchedIds, byId]);

  async function remove(player: SlimPlayer) {
    try {
      await setWatched(player.id, false);
      await queryClient.invalidateQueries({ queryKey: ["my-watchlist"] });
      toast.success(`Removed ${player.name} from your watchlist`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your watchlist.");
    }
  }

  return (
    <section className="mt-6">
      <h2 className="mb-1 font-display text-2xl font-bold">Watchlist</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Players you&apos;re tracking. Claim or Add from here, or remove when you&apos;re done.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your watchlist…</p>
      ) : watched.length === 0 ? (
        <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          Nobody on your watchlist yet. Bookmark players on{" "}
          <Link
            to="/players"
            search={{ f: undefined }}
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            Players
          </Link>{" "}
          and they&apos;ll show up here.
        </div>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card shadow-sm">
          {watched.map((player) => {
            const owner = ownerByPlayer.get(player.id) ?? null;
            const proj = scoreFor(player, week, league).projected;
            return (
              <li key={player.id} className="flex flex-wrap items-center gap-2 p-3 sm:flex-nowrap">
                <PlayerCardTrigger
                  player={player}
                  week={week}
                  league={league}
                  className="min-w-0 flex-1 rounded-lg px-1 py-0.5 hover:bg-secondary/60"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="truncate text-sm font-semibold">{player.name}</span>
                    <InjuryBadge injury={player.injury} size="sm" />
                    <span className="text-xs font-semibold text-muted-foreground">
                      {player.pos} · {player.team} · Proj {Number.isInteger(proj) ? proj : proj.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {owner ? `On ${owner}` : "Free agent"}
                  </p>
                </PlayerCardTrigger>
                <div className="flex shrink-0 items-center gap-1.5 [&_button]:h-8 [&_button]:px-2.5 [&_button]:text-xs">
                  {!owner && <AddDropButton player={player} league={league} byId={byId} />}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    aria-label={`Remove ${player.name} from watchlist`}
                    onClick={() => void remove(player)}
                  >
                    <Bookmark className="h-3.5 w-3.5" fill="currentColor" />
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
