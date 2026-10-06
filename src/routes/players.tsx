// ============= Full file contents =============

import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Check, ChevronDown, ChevronUp, HelpCircle, History, Search, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { PlayerCell } from "@/components/fantasy/PlayerCell";
import { AddDropButton } from "@/components/fantasy/AddDropButton";
import { PlayerSheet, PlayerCardTrigger } from "@/components/fantasy/PlayerSheet";
import { ActivityFeed } from "@/components/fantasy/ActivityFeed";
import {
  InsightsProvider,
  insightsQueryOptions,
  isOnBye,
  matchupFor,
} from "@/components/fantasy/PlayerInsights";
import { recommendFor } from "@/lib/fantasy/recommend";
import { STANDARD_SCORING } from "@/lib/fantasy/scoring";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { ownedIds, type League } from "@/lib/fantasy/league";
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
        {error instanceof Error ? error.message : String(error)}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell>No players found.</AppShell>,
});

function TrendingList({
  type,
  byId,
  week,
  league,
}: {
  type: "add" | "drop";
  byId: Map<string, SlimPlayer>;
  week: number;
  league: League | null;
}) {
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
          <PlayerCardTrigger player={r.player!} week={week} league={league}>
            <PlayerCell player={r.player!} compact showGame={false} />
          </PlayerCardTrigger>
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
  ["W0", "Week A"],
  ["W1", "Week B"],
  ["W2", "Week C"],
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
const WEEK_SORT_KEYS = ["W0", "W1", "W2"] as const;
type WeekSortKey = (typeof WEEK_SORT_KEYS)[number];

/** Last three finished NFL weeks before `currentWeek`, oldest first (e.g. 2,3,4). */
function recentCompletedWeeks(currentWeek: number): number[] {
  const weeks: number[] = [];
  for (let w = currentWeek - 1; w >= 1 && weeks.length < 3; w--) weeks.push(w);
  return weeks.reverse();
}

function weekSortKeys(recentWeeks: number[]): SortKey[] {
  return WEEK_SORT_KEYS.slice(0, recentWeeks.length) as SortKey[];
}

/** Production keeps L3; week-by-week lives in its own dropdown. */
function productionKeys(): SortKey[] {
  return ["PROJ", "PTS", "AVG", "HOT", "RANK"];
}

/** Own menu: Wk2 · Wk3 · Wk4 · L3 (rolling). L3 also stays under Production. */
function lastThreeKeys(recentWeeks: number[]): SortKey[] {
  return [...weekSortKeys(recentWeeks), "HOT"];
}

function sortLabel(key: SortKey, recentWeeks: number[]): string {
  const weekIndex = WEEK_SORT_KEYS.indexOf(key as WeekSortKey);
  if (weekIndex >= 0) {
    const weekNum = recentWeeks[weekIndex];
    return weekNum ? `Week ${weekNum}` : "Week";
  }
  return Object.fromEntries(SORTS)[key] ?? key;
}

function sortShort(key: SortKey, recentWeeks: number[]): string {
  const weekIndex = WEEK_SORT_KEYS.indexOf(key as WeekSortKey);
  if (weekIndex >= 0) {
    const weekNum = recentWeeks[weekIndex];
    return weekNum ? `Wk${weekNum}` : "Wk";
  }
  return COLUMNS_BASE[key as Exclude<SortKey, WeekSortKey>]?.short ?? key;
}

const LAST_THREE_LABEL = "Last three weeks";

const SORT_GROUP_DEFS: { label: string; keys: (recentWeeks: number[]) => SortKey[] }[] = [
  { label: "Production", keys: () => productionKeys() },
  { label: LAST_THREE_LABEL, keys: lastThreeKeys },
  { label: "Ownership", keys: () => ["OWNED", "STARTED", "RISING"] },
  { label: "Hype", keys: () => ["ADDS", "DROPS", "PICKUP"] },
  {
    label: "All",
    keys: (recentWeeks) => [
      ...productionKeys(),
      ...weekSortKeys(recentWeeks),
      "OWNED",
      "STARTED",
      "RISING",
      "ADDS",
      "DROPS",
      "PICKUP",
    ],
  },
];

function productionHelp(): ReadonlyArray<{ short: string; text: string }> {
  return [
    { short: "Proj", text: "Projected fantasy points for this week." },
    { short: "Pts", text: "Total fantasy points scored this season." },
    { short: "Avg", text: "Average fantasy points per game this season." },
    { short: "L3", text: "Average fantasy points over the last 3 finished weeks." },
    { short: "Rnk", text: "Rank by total points: overall for All players, or within the selected position." },
  ];
}

function lastThreeHelp(recentWeeks: number[]): ReadonlyArray<{ short: string; text: string }> {
  return [
    ...recentWeeks.map((w) => ({
      short: `Wk${w}`,
      text: `Fantasy points scored in week ${w}.`,
    })),
    { short: "L3", text: "Average fantasy points over those same last 3 finished weeks." },
  ];
}

const GROUP_HELP_BASE: Record<string, ReadonlyArray<{ short: string; text: string }>> = {
  Ownership: [
    { short: "Rst%", text: "Percentage of Sleeper leagues where the player is rostered." },
    { short: "Str%", text: "Percentage of Sleeper leagues where the player is starting." },
    { short: "Ris%", text: "Recent change in the player's rostered percentage." },
  ],
  Hype: [
    { short: "Adds", text: "How many Sleeper teams added the player recently." },
    { short: "Drops", text: "How many Sleeper teams dropped the player recently." },
    {
      short: "Pickup",
      text: "La Familia's waiver recommendation based on form, opportunity and matchup.",
    },
  ],
};

function StatLegend({ group, recentWeeks }: { group: string; recentWeeks: number[] }) {
  const rows =
    group === "Production"
      ? productionHelp()
      : group === LAST_THREE_LABEL
        ? lastThreeHelp(recentWeeks)
        : group === "All"
          ? [
              ...productionHelp(),
              ...lastThreeHelp(recentWeeks).filter((row) => row.short !== "L3"),
              ...(GROUP_HELP_BASE["Ownership"] ?? []),
              ...(GROUP_HELP_BASE["Hype"] ?? []),
            ]
          : (GROUP_HELP_BASE[group] ?? productionHelp());
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          aria-label={`What do the ${group} abbreviations mean?`}
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[70vh] w-72 overflow-y-auto">
        <p className="mb-2 font-display text-base font-bold">
          {group === "All" ? "All stats" : `${group} stats`}
        </p>
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.short} className="grid grid-cols-[3.25rem_1fr] gap-2">
              <span className="font-bold text-foreground">{row.short}</span>
              <span className="text-sm text-muted-foreground">{row.text}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

const PICKUP_ORDER: Record<string, number> = { must: 4, good: 3, stream: 2, pass: 1 };

const COMPACT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

type PlayerRow = {
  rank: number;
  proj: number;
  own: { owned: number; started: number; change: number } | null;
  last3Avg: number;
  weekPts: number[];
  seasonPts: number;
  seasonAvg: number;
  adds: number;
  drops: number;
  rec: { label: string } | null;
};

const COLUMNS_BASE: Record<
  Exclude<SortKey, WeekSortKey>,
  { short: string; w: string; value: (r: PlayerRow) => string }
> = {
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

function columnDef(
  key: SortKey,
  recentWeeks: number[],
): { short: string; w: string; value: (r: PlayerRow) => string } {
  const weekIndex = WEEK_SORT_KEYS.indexOf(key as WeekSortKey);
  if (weekIndex >= 0) {
    return {
      short: sortShort(key, recentWeeks),
      w: "w-14",
      value: (r) => {
        const pts = r.weekPts[weekIndex];
        if (pts == null) return "—";
        return pts.toFixed(1);
      },
    };
  }
  return COLUMNS_BASE[key as Exclude<SortKey, WeekSortKey>];
}

function PlayersPage() {
  const { league, players, byId } = useLeague();
  const { f } = Route.useSearch();
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState("ALL");
  const [avail, setAvail] = useState<"ALL" | "FA" | "ROSTERED">(f === "FA" ? "FA" : "ALL");
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [group, setGroup] = useState(SORT_GROUP_DEFS[0]!.label);
  const [sort, setSort] = useState<SortKey>("PROJ");
  const [dir, setDir] = useState<"desc" | "asc">("desc");
  const [cardId, setCardId] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);

  const week = league?.currentWeek ?? 1;
  const recentWeeks = useMemo(() => recentCompletedWeeks(week), [week]);
  const sortGroups = useMemo(
    () =>
      SORT_GROUP_DEFS.map((g) => ({ label: g.label, keys: g.keys(recentWeeks) })).filter(
        (g) => g.keys.length > 0,
      ),
    [recentWeeks],
  );
  const columns = sortGroups.find((g) => g.label === group)?.keys ?? sortGroups[0]!.keys;

  useEffect(() => {
    if (!columns.includes(sort)) {
      setSort(columns[0] ?? "PROJ");
      setDir("desc");
    }
  }, [columns, sort]);

  const headingTap = (key: SortKey) => {
    if (key === sort) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSort(key);
      setDir("desc");
    }
  };

  const pickGroup = (label: string) => {
    setGroup(label);
    const first = sortGroups.find((g) => g.label === label)?.keys[0];
    if (first) {
      setSort(first);
      setDir("desc");
    }
  };

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

  const ranks = useMemo(() => {
    const overall = new Map<string, number>();
    const byPosition = new Map<string, Map<string, number>>();
    const rankedPlayers = players.map((p) => ({
      id: p.id,
      pos: p.pos,
      points: insights?.players[p.id]?.seasonPts ?? 0,
      name: p.name,
    }));
    const compare = (a: (typeof rankedPlayers)[number], b: (typeof rankedPlayers)[number]) =>
      b.points - a.points || a.name.localeCompare(b.name);

    [...rankedPlayers].sort(compare).forEach((player, index) => overall.set(player.id, index + 1));

    for (const position of new Set(rankedPlayers.map((player) => player.pos))) {
      const positionRanks = new Map<string, number>();
      [...rankedPlayers]
        .filter((player) => player.pos === position)
        .sort(compare)
        .forEach((player, index) => positionRanks.set(player.id, index + 1));
      byPosition.set(position, positionRanks);
    }

    return { overall, byPosition };
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
        const weekPts = recentWeeks.map((w) => {
          const entry = info?.gameLog.find((g) => g.week === w);
          return entry?.pts ?? 0;
        });
        return {
          player: p,
          rank: (pos === "ALL" ? ranks.overall : ranks.byPosition.get(pos))?.get(p.id) ?? 9999,
          owner: ownerByPlayer.get(p.id) ?? null,
          proj,
          own,
          news: market?.news[p.id] ?? null,
          last3Avg: info?.last3Avg ?? 0,
          weekPts,
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
    const weekSortIndex = WEEK_SORT_KEYS.indexOf(sort as WeekSortKey);
    const desc = (a: Row, b: Row) => {
      switch (sort) {
        case "PROJ":
          return b.proj - a.proj;
        case "PTS":
          return b.seasonPts - a.seasonPts || b.proj - a.proj;
        case "W0":
        case "W1":
        case "W2":
          return (b.weekPts[weekSortIndex] ?? 0) - (a.weekPts[weekSortIndex] ?? 0) || b.proj - a.proj;
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
    recentWeeks,
    insights,
    market,
    addsById,
    dropsById,
    ranks,
    watchedOnly,
    watched,
  ]);

  const toggleWatch = async (playerId: string) => {
    await setWatched(playerId, !watched.has(playerId));
    await queryClient.invalidateQueries({ queryKey: ["my-watchlist"] });
  };

  const cardRow = cardId ? (results.find((r) => r.player.id === cardId) ?? null) : null;

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
            <Button
              variant={watchedOnly ? "default" : "outline"}
              className="h-10 justify-start sm:w-fit"
              onClick={() => setWatchedOnly((value) => !value)}
            >
              <Bookmark className="mr-2 h-4 w-4" /> Watchlist ({watched.size})
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b bg-secondary/60 px-3 py-2 sm:px-4">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {results.length} players
              </span>
              <div className="flex items-center gap-1">
                <StatLegend group={group} recentWeeks={recentWeeks} />
                <DropdownMenu modal={false} open={sortOpen} onOpenChange={setSortOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 rounded-full px-3 text-sm font-semibold"
                    >
                      {group === "All" ? "All stats" : group}
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Stats shown
                    </DropdownMenuLabel>
                    {sortGroups.map((g) => (
                      <DropdownMenuItem
                        key={g.label}
                        onClick={() => pickGroup(g.label)}
                        className="h-9 justify-between text-sm font-medium"
                      >
                        {g.label === "All" ? "All stats" : g.label}
                        {group === g.label && <Check className="h-4 w-4" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-max">
                <div className="flex items-stretch border-b bg-secondary/40">
                  <div className="sticky left-0 z-10 w-44 shrink-0 border-r bg-secondary/40 px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:w-72 sm:px-3">
                    Players
                  </div>
                  {columns.map((key) => {
                    const col = columnDef(key, recentWeeks);
                    const active = sort === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => headingTap(key)}
                        aria-label={`Sort by ${sortLabel(key, recentWeeks)}`}
                        className={cn(
                          "flex shrink-0 items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors",
                          col.w,
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {col.short}
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
                  const { player, owner } = row;
                  return (
                    <div key={player.id} className="flex items-stretch border-b last:border-b-0">
                      <div className="sticky left-0 z-10 w-44 shrink-0 border-r bg-card px-2 py-2 sm:w-72 sm:px-3">
                        <button
                          type="button"
                          className="block w-full cursor-pointer rounded-lg text-left"
                          onClick={() => setCardId(player.id)}
                          aria-label={`Open ${player.name}'s full player card`}
                        >
                          <PlayerCell
                            player={player}
                            week={week}
                            photo="desktop"
                            showGame={false}
                            research={!owner}
                          />
                        </button>
                        {!owner && (
                          <div className="mt-1 text-xs font-semibold text-accent-foreground">
                            Free agent
                          </div>
                        )}

                        <div className="mt-1.5 flex items-center gap-1.5 [&_button]:h-7 [&_button]:px-2 [&_button]:text-xs">
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
                      {columns.map((key) => {
                        const col = columnDef(key, recentWeeks);
                        return (
                          <div
                            key={key}
                            className={cn(
                              "flex shrink-0 items-center justify-center px-1 text-sm font-bold tabular-nums",
                              col.w,
                              sort === key ? "bg-primary/5 text-primary" : "text-foreground",
                            )}
                          >
                            {col.value(row)}
                          </div>
                        );
                      })}
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
            <TrendingList type="add" byId={byId} week={week} league={league} />
          </div>
        </TabsContent>

        <TabsContent value="drops" className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b bg-secondary/60 px-4 py-3 font-display text-lg font-bold">
              <TrendingDown className="h-5 w-5" /> Most dropped in the last 24 hours
            </div>
            <TrendingList type="drop" byId={byId} week={week} league={league} />
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

      {cardRow && (
        <PlayerSheet
          row={cardRow}
          posRank={ranks.byPosition.get(cardRow.player.pos)?.get(cardRow.player.id) ?? null}
          week={week}
          league={league}
          open
          onOpenChange={(o) => {
            if (!o) setCardId(null);
          }}
        />
      )}
    </InsightsProvider>
  );
}
