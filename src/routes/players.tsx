import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown, History, Newspaper, Search, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const rows = (data ?? [])
    .map((e) => ({ ...e, player: byId.get(e.id) }))
    .filter((r) => r.player)
    .slice(0, 25);
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
  ["PROJ", "Projection"],
  ["HOT", "Last 3 avg"],
  ["AVG", "Season avg"],
  ["OWNED", "Rostered %"],
  ["STARTED", "Started %"],
  ["RISING", "Rising %"],
  ["ADDS", "Trending adds"],
  ["DROPS", "Trending drops"],
  ["PICKUP", "Best pickup"],
  ["RANK", "Overall rank"],
] as const;

type SortKey = (typeof SORTS)[number][0];

const PICKUP_ORDER: Record<string, number> = { must: 4, good: 3, stream: 2, pass: 1 };

type StatCell = { label: string; value: string; hint: string; good?: boolean; active?: boolean };

/** The numbers for one player, laid out in an even grid so columns line up. */
function StatGrid({ cells }: { cells: StatCell[] }) {
  return (
    <dl className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-8">
      {cells.map((c) => (
        <div
          key={c.label}
          title={c.hint}
          className={cn(
            "rounded-md border px-1.5 py-1 text-center",
            c.active ? "border-primary bg-primary/10" : "border-transparent bg-secondary/50",
          )}
        >
          <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {c.label}
          </dt>
          <dd
            className={cn(
              "font-display text-sm font-bold tabular-nums",
              c.good && "text-emerald-600",
            )}
          >
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

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
  const { data: drops } = useQuery(trendingQueryOptions("drop"));

  const addsById = useMemo(() => new Map((adds ?? []).map((a) => [a.id, a.count])), [adds]);
  const dropsById = useMemo(() => new Map((drops ?? []).map((a) => [a.id, a.count])), [drops]);

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
          adds: addsById.get(p.id) ?? 0,
          drops: dropsById.get(p.id) ?? 0,
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
        case "AVG":
          return b.seasonAvg - a.seasonAvg;
        case "OWNED":
          return (b.own?.owned ?? -1) - (a.own?.owned ?? -1);
        case "STARTED":
          return (b.own?.started ?? -1) - (a.own?.started ?? -1);
        case "RISING":
          return (b.own?.change ?? -999) - (a.own?.change ?? -999);
        case "ADDS":
          return b.adds - a.adds || b.proj - a.proj;
        case "DROPS":
          return b.drops - a.drops || b.proj - a.proj;
        case "PICKUP":
          return (
            (PICKUP_ORDER[b.rec?.level ?? ""] ?? 0) - (PICKUP_ORDER[a.rec?.level ?? ""] ?? 0) ||
            b.last3Avg - a.last3Avg ||
            b.proj - a.proj
          );
        default:
          return a.player.rank - b.player.rank;
      }
    });
    return list.slice(0, 100);
  }, [
    players,
    query,
    pos,
    avail,
    sort,
    ownerByPlayer,
    league,
    week,
    insights,
    market,
    addsById,
    dropsById,
  ]);

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
            </div>
            <div className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <ArrowUpDown className="h-4 w-4" /> Sort by
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {SORTS.map(([value, label]) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={sort === value ? "default" : "outline"}
                    onClick={() => setSort(value)}
                    aria-pressed={sort === value}
                    className="h-9 justify-center px-2 text-sm font-semibold"
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <ul className="divide-y">
              {results.map(({ player, owner, proj, own, news, last3Avg, seasonAvg, rec, adds, drops }) => (
                <li
                  key={player.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <PlayerCell player={player} week={week} />
                    <div className="mt-1 text-sm">
                      {owner ? (
                        <span className="text-muted-foreground">On {owner}</span>
                      ) : (
                        <span className="font-semibold text-accent-foreground">Free agent</span>
                      )}
                    </div>
                    <StatGrid
                      cells={[
                        {
                          label: "Rostered",
                          value: own ? `${own.owned}%` : "—",
                          hint: "Share of leagues nationwide where he is on a roster",
                          active: sort === "OWNED",
                        },
                        {
                          label: "Started",
                          value: own ? `${own.started}%` : "—",
                          hint: "Share of leagues starting him this week",
                          active: sort === "STARTED",
                        },
                        {
                          label: "Rising",
                          value: own ? `${own.change > 0 ? "+" : ""}${own.change}%` : "—",
                          hint: "Change in rostered % this week",
                          good: (own?.change ?? 0) >= 1,
                          active: sort === "RISING",
                        },
                        {
                          label: "Avg",
                          value: seasonAvg.toFixed(1),
                          hint: "Season average points per game",
                          active: sort === "AVG",
                        },
                        {
                          label: "Last 3",
                          value: last3Avg.toFixed(1),
                          hint: "Average over his last three games",
                          active: sort === "HOT",
                        },
                        {
                          label: "Adds",
                          value: adds ? adds.toLocaleString() : "—",
                          hint: "Times added across the country in 24 hours",
                          active: sort === "ADDS",
                        },
                        {
                          label: "Drops",
                          value: drops ? drops.toLocaleString() : "—",
                          hint: "Times dropped across the country in 24 hours",
                          active: sort === "DROPS",
                        },
                        {
                          label: `Proj wk ${week}`,
                          value: proj.toFixed(1),
                          hint: "Projected points this week",
                          active: sort === "PROJ",
                        },
                      ]}
                    />
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
                    <PlayerInsightChips player={player} week={week} showForm={false} />
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
