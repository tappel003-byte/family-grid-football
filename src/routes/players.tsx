// ============= Full file contents =============

import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Check, ChevronDown, History, Newspaper, Search, TrendingDown, TrendingUp } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { listMyWatchlist, setWatched } from "@/lib/fantasy/community";
import { useQueryClient } from "@tanstack/react-query";

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

const SORT_LABEL: Record<SortKey, string> = Object.fromEntries(SORTS) as Record<SortKey, string>;

/** The 10 sorts, grouped the way you'd talk about them. */
const SORT_GROUPS: { label: string; keys: SortKey[] }[] = [
  { label: "Production", keys: ["PROJ", "AVG", "HOT", "RANK"] },
  { label: "Ownership", keys: ["OWNED", "STARTED", "RISING"] },
  { label: "Hype", keys: ["ADDS", "DROPS", "PICKUP"] },
];

const PICKUP_ORDER: Record<string, number> = { must: 4, good: 3, stream: 2, pass: 1 };

/** Shared grid so the column headers and every player row line up. */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_3.25rem] gap-x-1.5 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem] sm:gap-x-3";

/** One right-aligned number column (ESPN-style). */
function NumCol({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div
      className={cn(
        "pt-0.5 text-right font-display text-sm font-bold tabular-nums",
        active ? "text-primary underline decoration-primary/40 underline-offset-4" : "text-foreground",
      )}
    >
      <span className="sr-only">{label}: </span>
      {value}
    </div>
  );
}

function PlayersPage() {
  const { league, players, byId } = useLeague();
  const { f } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");
  const [avail, setAvail] = useState<"ALL" | "FA" | "ROSTERED">(f === "FA" ? "FA" : "ALL");
  const [watchedOnly, setWatchedOnly] = useState(false);
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
  const queryClient = useQueryClient();
  const { data: watchedIds = [] } = useQuery({ queryKey: ["my-watchlist"], queryFn: listMyWatchlist });
  const watched = useMemo(() => new Set(watchedIds), [watchedIds]);

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
      .filter((p) => !watchedOnly || watched.has(p.id))
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
    watchedOnly,
    watched,
  ]);

  const toggleWatch = async (playerId: string) => {
    await setWatched(playerId, !watched.has(playerId));
    await queryClient.invalidateQueries({ queryKey: ["my-watchlist"] });
  };

  return (
    <InsightsProvider week={week} scoring={league?.scoring ?? STANDARD_SCORING}>
      <PageTitle title="Player Research" subtitle="Recent form, matchups, byes and waiver trends" />
      <Tabs defaultValue="search">
        <TabsList className="h-11">
          <TabsTrigger value="search" className="text-base">
            Search
          </TabsTrigger>
          <TabsTrigger value="adds" className="text-base">
            <span className="sm:hidden">Adds</span>
            <span className="hidden sm:inline">Trending Adds</span>
          </TabsTrigger>
          <TabsTrigger value="drops" className="text-base">
            <span className="sm:hidden">Drops</span>
            <span className="hidden sm:inline">Trending Drops</span>
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-base">
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          {/* One slim control band: search + position chips, then availability */}
          <div className="mb-3 flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[9rem] flex-1 sm:w-52 sm:flex-none">
                <Search className="absolute left-3 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search any NFL player"
                  aria-label="Search players"
                  className="h-10 pl-10 text-base"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POSITIONS.map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={pos === p ? "default" : "outline"}
                    onClick={() => setPos(p)}
                    aria-pressed={pos === p}
                    className="h-10 rounded-full px-3.5 text-sm font-semibold"
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1" role="group" aria-label="Show">
              {(
                [
                  ["ALL", "All players"],
                  ["FA", "Free agents"],
                  ["ROSTERED", "On a team"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAvail(v)}
                  aria-pressed={avail === v}
                  className={cn(
                    "h-9 rounded-lg text-sm font-semibold transition-colors",
                    avail === v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant={watchedOnly ? "default" : "outline"} className="h-10 justify-start sm:w-fit" onClick={() => setWatchedOnly((value) => !value)}>
              <Bookmark className="mr-2 h-4 w-4" /> Watchlist ({watched.size})
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            {/* List header: count + grouped sort dropdown (ESPN-style) */}
            <div className="flex items-center justify-between gap-2 border-b bg-secondary/60 px-3 py-2 sm:px-4">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {results.length} players
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-3 text-sm font-semibold">
                    Sort: {SORT_LABEL[sort]}
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {SORT_GROUPS.map((group, gi) => (
                    <div key={group.label}>
                      {gi > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {group.label}
                      </DropdownMenuLabel>
                      {group.keys.map((key) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => setSort(key)}
                          className="h-9 justify-between text-sm font-medium"
                        >
                          {SORT_LABEL[key]}
                          {sort === key && <Check className="h-4 w-4" />}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Column headers, aligned with the rows below */}
            <div
              className={cn(
                ROW_GRID,
                "border-b px-3 py-2 text-[10px] font-bold uppercase tracking-wide sm:px-4",
              )}
            >
              <span className="text-muted-foreground">Player</span>
              {(
                [
                  ["OWNED", "%Rost"],
                  ["STARTED", "%Start"],
                  ["PROJ", "Proj"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSort(key)}
                  className={cn(
                    "justify-self-end",
                    sort === key
                      ? "text-primary underline underline-offset-2"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <ul className="divide-y">
              {results.map(({ player, owner, proj, own, news, last3Avg, rec, adds, drops }) => (
                <li
                  key={player.id}
                  className={cn(ROW_GRID, "items-start px-3 py-2.5 sm:px-4 sm:py-3")}
                >
                  <div className="min-w-0">
                    <PlayerCell player={player} week={week} photo="desktop" />
                    <div className="mt-1 text-sm">
                      {owner ? (
                        <span className="text-muted-foreground">On {owner}</span>
                      ) : (
                        <span className="font-semibold text-accent-foreground">Free agent</span>
                      )}
                    </div>
                    {(last3Avg > 0 || adds > 0 || drops > 0) && (
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {[
                          last3Avg > 0 ? `Last 3 ${last3Avg.toFixed(1)}` : null,
                          adds > 0 ? `${adds.toLocaleString()} adds` : null,
                          drops > 0 ? `${drops.toLocaleString()} drops` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
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
                  <NumCol label="Rostered percent" value={own ? `${own.owned}` : "—"} active={sort === "OWNED"} />
                  <NumCol label="Started percent" value={own ? `${own.started}` : "—"} active={sort === "STARTED"} />
                  <NumCol label="Projected points" value={proj.toFixed(1)} active={sort === "PROJ"} />
                  <div className="col-span-3 flex items-center justify-end gap-2 pt-1.5">
                    <Button size="icon" variant={watched.has(player.id) ? "default" : "outline"} aria-label={watched.has(player.id) ? `Remove ${player.name} from watchlist` : `Watch ${player.name}`} onClick={() => void toggleWatch(player.id)}>
                      <Bookmark className="h-4 w-4" fill={watched.has(player.id) ? "currentColor" : "none"} />
                    </Button>
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
              <History className="h-5 w-5" /> Recent league activity
            </div>
            <ActivityFeed limit={10} />
          </div>
        </TabsContent>
      </Tabs>
    </InsightsProvider>
  );
}
