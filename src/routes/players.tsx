import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, Search, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { PlayerCell } from "@/components/fantasy/PlayerCell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  playersQueryOptions,
  trendingQueryOptions,
  useLeague,
  scoreFor,
} from "@/lib/fantasy/hooks";
import { rosterIds } from "@/lib/fantasy/league";
import type { SlimPlayer } from "@/lib/sleeper.functions";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

export const Route = createFileRoute("/players")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Player Research — Family Football" },
      {
        name: "description",
        content: "Search every NFL player, filter by position and see who the country is adding.",
      },
      { property: "og:title", content: "Player Research — Family Football" },
      {
        property: "og:description",
        content: "Search every NFL player, filter by position and see trending adds and drops.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <PlayersPage />
      </Suspense>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="text-lg">
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell>No players found.</AppShell>,
});

function TrendingList({ type, byId }: { type: "add" | "drop"; byId: Map<string, SlimPlayer> }) {
  const { data, isPending } = useQuery(trendingQueryOptions(type));
  if (isPending) return <p className="p-4 text-muted-foreground">Loading trends…</p>;
  const rows = (data ?? []).map((e) => ({ ...e, player: byId.get(e.id) })).filter((r) => r.player);
  if (!rows.length) return <p className="p-4 text-muted-foreground">No trend data right now.</p>;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <PlayerCell player={r.player!} compact />
          <span className="shrink-0 font-display text-lg font-bold tabular-nums">
            {type === "add" ? "+" : "−"}
            {r.count.toLocaleString()}
          </span>
        </li>
      ))}
    </ul>
  );
}

function PlayersPage() {
  const { league, players, byId } = useLeague();
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");
  const [avail, setAvail] = useState<"ALL" | "FA" | "ROSTERED">("ALL");
  const [sort, setSort] = useState<"PROJ" | "RANK">("PROJ");

  const week = league?.currentWeek ?? 1;
  useWeekData(week);

  const ownerByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of league?.teams ?? []) for (const id of rosterIds(t)) map.set(id, t.name);
    return map;
  }, [league]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = players
      .filter((p) => (pos === "ALL" || p.pos === pos) && (!q || p.name.toLowerCase().includes(q)))
      .filter((p) => {
        if (avail === "ALL") return true;
        const owned = ownerByPlayer.has(p.id);
        return avail === "FA" ? !owned : owned;
      })
      .map((p) => ({
        player: p,
        owner: ownerByPlayer.get(p.id) ?? null,
        proj: league ? scoreFor(p, week, league).projected : 0,
      }));
    list.sort((a, b) =>
      sort === "PROJ" ? b.proj - a.proj : a.player.rank - b.player.rank,
    );
    return list.slice(0, 100);
  }, [players, query, pos, avail, sort, ownerByPlayer, league, week]);

  return (
    <>
      <PageTitle title="Player Research" subtitle="Live NFL rosters, injuries and waiver trends" />
      <Tabs defaultValue="search">
        <TabsList className="h-11">
          <TabsTrigger value="search" className="text-base">
            Search
          </TabsTrigger>
          <TabsTrigger value="adds" className="text-base">
            Trending Adds
          </TabsTrigger>
          <TabsTrigger value="drops" className="text-base">
            Trending Drops
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <div className="mb-4 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any NFL player"
                aria-label="Search players"
                className="h-12 pl-11 text-base"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((p) => (
                <Button
                  key={p}
                  variant={pos === p ? "default" : "outline"}
                  onClick={() => setPos(p)}
                  className="font-semibold"
                >
                  {p}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["ALL", "All players"],
                  ["FA", "Free agents"],
                  ["ROSTERED", "On a team"],
                ] as const
              ).map(([v, label]) => (
                <Button
                  key={v}
                  variant={avail === v ? "default" : "outline"}
                  onClick={() => setAvail(v)}
                  className="font-semibold"
                >
                  {label}
                </Button>
              ))}
              <Button
                variant="secondary"
                onClick={() => setSort(sort === "PROJ" ? "RANK" : "PROJ")}
                className="font-semibold"
              >
                <ArrowUpDown className="mr-1.5 h-4 w-4" />
                {sort === "PROJ" ? "Top projected" : "Overall rank"}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <ul className="divide-y">
              {results.map(({ player, owner, proj }) => (
                <li
                  key={player.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <PlayerCell player={player} />
                    <div className="mt-1 text-sm">
                      {owner ? (
                        <span className="text-muted-foreground">On {owner}</span>
                      ) : (
                        <span className="font-semibold text-accent-foreground">Free agent</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-xl font-bold tabular-nums">
                      {proj.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">proj wk {week}</div>
                  </div>
                </li>
              ))}
              {!results.length && (
                <li className="px-4 py-8 text-center text-muted-foreground">
                  No players match that search.
                </li>
              )}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="adds" className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b bg-secondary/60 px-4 py-3 font-display text-lg font-bold">
              <TrendingUp className="h-5 w-5" /> Most added in the last 24 hours
            </div>
            <TrendingList type="add" byId={byId} />
          </div>
        </TabsContent>

        <TabsContent value="drops" className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b bg-secondary/60 px-4 py-3 font-display text-lg font-bold">
              <TrendingDown className="h-5 w-5" /> Most dropped in the last 24 hours
            </div>
            <TrendingList type="drop" byId={byId} />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
