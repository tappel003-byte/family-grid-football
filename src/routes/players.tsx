import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, History, Search, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { PlayerCell } from "@/components/fantasy/PlayerCell";
import { AddDropButton } from "@/components/fantasy/AddDropButton";
import { ActivityFeed } from "@/components/fantasy/ActivityFeed";
import {
  InsightsProvider,
  PlayerInsightChips,
  insightsQueryOptions,
  isOnBye,
  matchupFor,
} from "@/components/fantasy/PlayerInsights";
import { recommendFor } from "@/lib/fantasy/recommend";
import { STANDARD_SCORING } from "@/lib/fantasy/scoring";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  marketQueryOptions,
  playersQueryOptions,
  trendingQueryOptions,
  useLeague,
  useWeekData,
  scoreFor,
} from "@/lib/fantasy/hooks";
import { ownedIds } from "@/lib/fantasy/league";
import type { SlimPlayer } from "@/lib/sleeper.functions";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DEF"];

export const Route = createFileRoute("/players")({
  validateSearch: (search: Record<string, unknown>) => ({
    f: typeof search["f"] === "string" ? search["f"] : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Player Research — La Familia" },
      {
        name: "description",
        content: "Search every NFL player, filter by position and see who the country is adding.",
      },
      { property: "og:title", content: "Player Research — La Familia" },
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

const SORTS = [
  ["PROJ", "Top projected"],
  ["HOT", "Hot last 3 weeks"],
  ["OWNED", "Most rostered"],
  ["STARTED", "Most started"],
  ["RANK", "Overall rank"],
] as const;

type SortKey = (typeof SORTS)[number][0];

function PlayersPage() {
  const { league, players, byId } = useLeague();
  const { f } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");
  const [avail, setAvail] = useState<"ALL" | "FA" | "ROSTERED">(f === "FA" ? "FA" : "ALL");
  const [sort, setSort] = useState<SortKey>("PROJ");

  const week = league?.currentWeek ?? 1;
  useWeekData(week);
  const { data: insights } = useQuery({
    ...insightsQueryOptions(week, league?.scoring ?? STANDARD_SCORING),
    enabled: !!league,
  });
  const { data: market } = useQuery(marketQueryOptions);
  const { data: adds } = useQuery(trendingQueryOptions("add"));

  const addsById = useMemo(() => new Map((adds ?? []).map((a) => [a.id, a.count])), [adds]);

  const ownerByPlayer = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of league?.teams ?? []) for (const id of ownedIds(t)) map.set(id, t.name);
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
      .map((p) => {
        const info = insights?.players[p.id];
        const own = market?.ownership[p.id] ?? null;
        const proj = league ? scoreFor(p, week, league).projected : 0;
        const free = !ownerByPlayer.has(p.id);
        return {
          player: p,
          owner: ownerByPlayer.get(p.id) ?? null,
          proj,
          own,
          news: market?.news[p.id] ?? null,
          last3Avg: info?.last3Avg ?? 0,
          seasonAvg: info?.seasonAvg ?? 0,
          hot: info?.last3Avg ?? 0,
          rec: recommendFor({
            free,
            own,
            last3Avg: info?.last3Avg ?? 0,
            seasonAvg: info?.seasonAvg ?? 0,
            projected: proj,
            onBye: isOnBye(insights ?? null, p, week),
            injury: p.injury,
            matchup: matchupFor(insights ?? null, p)?.grade?.grade ?? null,
            trendingAdds: addsById.get(p.id) ?? 0,
          }),
        };
      });
    list.sort((a, b) => {
      switch (sort) {
        case "PROJ":
          return b.proj - a.proj;
        case "HOT":
          return b.hot - a.hot;
        case "OWNED":
          return (b.own?.owned ?? -1) - (a.own?.owned ?? -1);
        case "STARTED":
          return (b.own?.started ?? -1) - (a.own?.started ?? -1);
        default:
          return a.player.rank - b.player.rank;
      }
    });
    return list.slice(0, 100);
  }, [players, query, pos, avail, sort, ownerByPlayer, league, week, insights, market, addsById]);

  return (
    <InsightsProvider week={week} scoring={league?.scoring ?? STANDARD_SCORING}>
      <PageTitle title="Player Research" subtitle="Recent form, matchups, byes and waiver trends" />
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
          <TabsTrigger value="activity" className="text-base">
            Activity
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
                onClick={() => {
                  const i = SORTS.findIndex(([v]) => v === sort);
                  setSort(SORTS[(i + 1) % SORTS.length]![0]);
                }}
                className="font-semibold"
              >
                <ArrowUpDown className="mr-1.5 h-4 w-4" />
                {SORTS.find(([v]) => v === sort)?.[1]}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <ul className="divide-y">
              {results.map(({ player, owner, proj, own, news, last3Avg, seasonAvg, rec }) => (
                <li
                  key={player.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <PlayerCell player={player} week={week} />
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      {owner ? (
                        <span className="text-muted-foreground">On {owner}</span>
                      ) : (
                        <span className="font-semibold text-accent-foreground">Free agent</span>
                      )}
                      {own && (
                        <>
                          <span
                            className="text-muted-foreground"
                            title="Share of fantasy leagues across the country where this player is on a roster"
                          >
                            Rostered <b className="text-foreground tabular-nums">{own.owned}%</b>
                          </span>
                          <span
                            className="text-muted-foreground"
                            title="Share of leagues that have him in their starting lineup this week"
                          >
                            Started <b className="text-foreground tabular-nums">{own.started}%</b>
                          </span>
                          {own.change >= 1 && (
                            <span className="font-semibold text-emerald-600">
                              +{own.change}% this week
                            </span>
                          )}
                        </>
                      )}
                      <span className="text-muted-foreground" title="Average points per game">
                        Avg <b className="text-foreground tabular-nums">{seasonAvg.toFixed(1)}</b> ·
                        last 3 <b className="text-foreground tabular-nums">{last3Avg.toFixed(1)}</b>
                      </span>
                    </div>
                    {rec && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wide",
                            rec.level === "must" && "bg-emerald-600 text-white",
                            rec.level === "good" && "bg-emerald-600/15 text-emerald-700",
                            rec.level === "stream" && "bg-secondary text-secondary-foreground",
                            rec.level === "pass" && "bg-muted text-muted-foreground",
                          )}
                        >
                          {rec.label}
                        </span>
                        <span className="text-muted-foreground">{rec.reason}</span>
                      </div>
                    )}
                    {news && (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
                        <Newspaper className="mt-0.5 h-4 w-4 shrink-0" />
                        {news.link ? (
                          <a
                            href={news.link}
                            target="_blank"
                            rel="noreferrer"
                            className="underline underline-offset-2 hover:text-foreground"
                          >
                            {news.headline}
                          </a>
                        ) : (
                          news.headline
                        )}
                      </p>
                    )}
                    <PlayerInsightChips player={player} week={week} />
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <div className="font-display text-xl font-bold tabular-nums">
                        {proj.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground">proj wk {week}</div>
                    </div>
                    {league && <AddDropButton player={player} league={league} byId={byId} />}
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

        <TabsContent value="activity" className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b bg-secondary/60 px-4 py-3 font-display text-lg font-bold">
              <History className="h-5 w-5" /> Recent adds and drops
            </div>
            <ActivityFeed />
          </div>
        </TabsContent>
      </Tabs>
    </InsightsProvider>
  );
}
