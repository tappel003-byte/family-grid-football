// ============= Full file contents =============

import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Check, ChevronDown, ChevronUp, History, Newspaper, Search, TrendingDown, TrendingUp } from "lucide-react";
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
          <PlayerCell player={r.player!} compact showGame={false} />
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
  ["PTS", "Total points"],
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
  { label: "Production", keys: ["PROJ", "PTS", "AVG", "HOT", "RANK"] },
  { label: "Ownership", keys: ["OWNED", "STARTED", "RISING"] },
  { label: "Hype", keys: ["ADDS", "DROPS", "PICKUP"] },
];

const PICKUP_ORDER: Record<string, number> = { must: 4, good: 3, stream: 2, pass: 1 };

/** Compact number formatting for hype counts (511,590 -> 512K). */
const COMPACT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Shape of the row data each stat column reads from. */
type PlayerRow = {
  rank: number;
  proj: number;
  own: { owned: number; started: number; change: number } | null;
  last3Avg: number;
  seasonPts: number;
  seasonAvg: number;
  adds: number;
  drops: number;
  rec: { label: string } | null;
};

/** One scrolling stat column: short heading, width, and how to print the value. */
const COLUMNS: Record<SortKey, { short: string; w: string; value: (r: PlayerRow) => string }> = {
  PROJ: { short: "Proj", w: "w-14", value: (r) => r.proj.toFixed(1) },
  PTS: { short: "Pts", w: "w-14", value: (r) => r.seasonPts.toFixed(1) },
  AVG: { short: "Avg", w: "w-14", value: (r) => r.seasonAvg.toFixed(1) },
  HOT: { short: "L3", w: "w-14", value: (r) => (r.last3Avg > 0 ? r.last3Avg.toFixed(1) : "—") },
  RANK: { short: "Rnk", w: "w-14", value: (r) => `#${r.rank}` },
  OWNED: { short: "Rst%", w: "w-14", value: (r) => (r.own ? `${r.own.owned}%` : "—") },
  STARTED: { short: "Str%", w: "w-14", value: (r) => (r.own ? `${r.own.started}%` : "—") },
  RISING: {
    short: "Ris%",
    w: "w-14",
    value: (r) => (r.own ? `${r.own.change > 0 ? "+" : ""}${r.own.change}` : "—"),
  },
  ADDS: { short: "Adds", w: "w-14", value: (r) => (r.adds > 0 ? COMPACT.format(r.adds) : "—") },
  DROPS: { short: "Drops", w: "w-14", value: (r) => (r.drops > 0 ? COMPACT.format(r.drops) : "—") },
  PICKUP: { short: "Pickup", w: "w-24", value: (r) => r.rec?.label ?? "—" },
};


function PlayersPage() {
  const { league, players, byId } = useLeague();
  const { f } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");
  const [avail, setAvail] = useState<"ALL" | "FA" | "ROSTERED">(f === "FA" ? "FA" : "ALL");
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [group, setGroup] = useState(SORT_GROUPS[0]!.label);
  const [sort, setSort] = useState<SortKey>("PROJ");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortOpen, setSortOpen] = useState(false);

  const columns = SORT_GROUPS.find((g) => g.label === group)?.keys ?? SORT_GROUPS[0]!.keys;

  /** Tap a heading: sort by it, tap again to flip the direction. */
  const headingTap = (key: SortKey) => {
    if (key === sort) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(key);
      setDir("desc");
    }
  };

  const pickGroup = (label: string) => {
    setGroup(label);
    const first = SORT_GROUPS.find((g) => g.label === label)?.keys[0];
    if (first) {
      setSort(first);
      setDir("desc");
    }
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });


  // Close the sort menu as soon as the user starts scrolling the list.
  useEffect(() => {
    if (!sortOpen) return;
    const close = () => setSortOpen(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    window.addEventListener("touchmove", close, { passive: true });
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("touchmove", close);
    };
  }, [sortOpen]);

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

  /** Our own overall rank: every player ordered by season points in this league's scoring. */
  const rankById = useMemo(() => {
    const map = new Map<string, number>();
    players
      .map((p) => [p.id, insights?.players[p.id]?.seasonPts ?? 0, p.name] as const)
      .sort((a, b) => b[1] - a[1] || a[2].localeCompare(b[2]))
      .forEach(([id], i) => map.set(id, i + 1));
    return map;
  }, [players, insights]);

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
          rank: rankById.get(p.id) ?? 9999,
          owner: ownerByPlayer.get(p.id) ?? null,
          proj,
          own,
          news: market?.news[p.id] ?? null,
          last3Avg: info?.last3Avg ?? 0,
          seasonPts: info?.seasonPts ?? 0,
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
    type Row = (typeof list)[number];
    const desc = (a: Row, b: Row) => {
      switch (sort) {
        case "PROJ":
          return b.proj - a.proj;
        case "PTS":
          return b.seasonPts - a.seasonPts || b.proj - a.proj;
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
          return a.rank - b.rank;
      }
    };
    const factor = dir === "asc" ? -1 : 1;
    list.sort((a, b) => factor * desc(a, b));

    return list.slice(0, 100);
  }, [
    players,
    query,
    pos,
    avail,
    sort,
    dir,
    ownerByPlayer,
    league,
    week,
    insights,
    market,
    addsById,
    dropsById,
    rankById,
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
              <DropdownMenu modal={false} open={sortOpen} onOpenChange={setSortOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-3 text-sm font-semibold">
                    {group}
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Stats shown
                  </DropdownMenuLabel>
                  {SORT_GROUPS.map((g) => (
                    <DropdownMenuItem
                      key={g.label}
                      onClick={() => pickGroup(g.label)}
                      className="h-9 justify-between text-sm font-medium"
                    >
                      {g.label}
                      {group === g.label && <Check className="h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

            </div>

            {/* Locked player column on the left, stat columns scroll sideways. */}
            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="flex items-stretch border-b bg-secondary/40">
                  <div className="sticky left-0 z-10 w-44 shrink-0 border-r bg-secondary/40 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:w-72 sm:px-3">
                    Players
                  </div>
                  {columns.map((key) => {
                    const active = sort === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => headingTap(key)}
                        aria-label={`Sort by ${SORT_LABEL[key]}`}
                        className={cn(
                          "flex shrink-0 items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
                          COLUMNS[key].w,
                          active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {COLUMNS[key].short}
                        {active &&
                          (dir === "desc" ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronUp className="h-3 w-3" />
                          ))}
                      </button>
                    );
                  })}
                </div>

                {results.map((row) => {
                  const { player, owner, news, rec } = row;
                  const open = expanded.has(player.id);
                  return (
                    <div key={player.id} className="flex items-stretch border-b last:border-b-0">
                      <div className="sticky left-0 z-10 w-44 shrink-0 border-r bg-card px-2 py-2 sm:w-72 sm:px-3">
                        <PlayerCell player={player} week={week} photo="desktop" showGame={false} />
                        {!owner && (
                          <div className="mt-1 text-xs font-semibold text-accent-foreground">
                            Free agent
                          </div>
                        )}
                        {open && (
                          <div className="mt-1.5">
                            {owner && <p className="text-sm text-muted-foreground">On {owner}</p>}
                            {rec && <p className="text-sm text-muted-foreground">{rec.reason}</p>}
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
                        )}
                        <div className="mt-1.5 flex items-center gap-1.5 [&_button]:h-7 [&_button]:px-2 [&_button]:text-xs">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-1.5 text-xs font-semibold"
                            aria-expanded={open}
                            onClick={() => toggleExpanded(player.id)}
                          >
                            {open ? "Less" : "Details"}
                          </Button>
                          <Button
                            size="icon"
                            variant={watched.has(player.id) ? "default" : "outline"}
                            aria-label={
                              watched.has(player.id)
                                ? `Remove ${player.name} from watchlist`
                                : `Watch ${player.name}`
                            }
                            onClick={() => void toggleWatch(player.id)}
                          >
                            <Bookmark
                              className="h-4 w-4"
                              fill={watched.has(player.id) ? "currentColor" : "none"}
                            />
                          </Button>
                          {league && <AddDropButton player={player} league={league} byId={byId} />}
                        </div>
                      </div>
                      {columns.map((key) => (
                        <div
                          key={key}
                          className={cn(
                            "flex shrink-0 items-center justify-center px-1 text-sm font-bold tabular-nums",
                            COLUMNS[key].w,
                            sort === key ? "bg-primary/5 text-primary" : "text-foreground",
                          )}
                        >
                          {COLUMNS[key].value(row)}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {!results.length && (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    No players match that search.
                  </div>
                )}
              </div>
            </div>

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
