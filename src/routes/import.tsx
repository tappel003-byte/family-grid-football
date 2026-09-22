import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { CommissionerOnly } from "@/components/fantasy/AuthGate";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { PlayerCell } from "@/components/fantasy/PlayerCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { playersQueryOptions, useLeague } from "@/lib/fantasy/hooks";
import { updateLeague } from "@/lib/fantasy/store";
import { BENCH_SIZE, SLOTS, slotAccepts, rosterIds, type FantasyTeam } from "@/lib/fantasy/league";
import { buildPlayerIndex, matchRoster, type MatchResult } from "@/lib/fantasy/import";
import { readRosterImage } from "@/lib/fantasy/ocr.functions";
import type { SlimPlayer } from "@/lib/sleeper.functions";

export const Route = createFileRoute("/import")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Import Rosters — La Familia" },
      {
        name: "description",
        content: "Commissioner tool to paste, scan or search in every family team's roster.",
      },
      { property: "og:title", content: "Import Rosters — La Familia" },
      {
        property: "og:description",
        content: "Commissioner tool to paste, scan or search in every family team's roster.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <CommissionerOnly>
        <ImportPage />
      </CommissionerOnly>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="text-lg">
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell>Nothing here.</AppShell>,
});

/** Lay a list of players into starting slots, the rest onto the bench. */
function layoutRoster(ids: string[], byId: Map<string, SlimPlayer>) {
  const pool = ids
    .map((id) => byId.get(id))
    .filter((p): p is SlimPlayer => !!p)
    .sort((a, b) => a.rank - b.rank);
  const starters: (string | null)[] = SLOTS.map(() => null);
  const used = new Set<string>();
  SLOTS.forEach((slot, i) => {
    const pick = pool.find((p) => !used.has(p.id) && slotAccepts(slot, p.pos));
    if (pick) {
      starters[i] = pick.id;
      used.add(pick.id);
    }
  });
  const bench = pool.filter((p) => !used.has(p.id)).map((p) => p.id).slice(0, BENCH_SIZE);
  return { starters, bench };
}

function ImportPage() {
  const { league, players, byId } = useLeague();
  const index = useMemo(() => buildPlayerIndex(players), [players]);
  const [teamId, setTeamId] = useState<string | null>(null);

  if (!league) return <LoadingScreen />;

  const team = league.teams.find((t) => t.id === teamId) ?? league.teams[0]!;

  return (
    <>
      <PageTitle
        title="Import Rosters"
        subtitle="Paste a roster, upload a screenshot, or search players in one at a time. Everyone sees the change right away."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {league.teams.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTeamId(t.id)}
            className={cn(
              "rounded-xl border px-4 py-2 text-base font-semibold",
              t.id === team.id ? "border-primary bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            {t.name}
          </button>
        ))}
      </div>

      <TeamImporter
        key={team.id}
        team={team}
        week={league.currentWeek}
        byId={byId}
        players={players}
        index={index}
      />
    </>
  );
}

function TeamImporter({
  team,
  week,
  byId,
  players,
  index,
}: {
  team: FantasyTeam;
  week: number;
  byId: Map<string, SlimPlayer>;
  players: SlimPlayer[];
  index: ReturnType<typeof buildPlayerIndex>;
}) {
  const [name, setName] = useState(team.name);
  const [owner, setOwner] = useState(team.owner);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<MatchResult[] | null>(null);
  const [reading, setReading] = useState(false);
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const current = rosterIds(team)
    .map((id) => byId.get(id))
    .filter((p): p is SlimPlayer => !!p);

  const saveDetails = () => {
    updateLeague((l) => ({
      ...l,
      teams: l.teams.map((t) => (t.id === team.id ? { ...t, name, owner } : t)),
    }));
    toast.success("Team details saved");
  };

  const setRoster = (ids: string[]) => {
    const unique = [...new Set(ids)];
    updateLeague((l) => ({
      ...l,
      teams: l.teams.map((t) =>
        t.id === team.id ? { ...t, ...layoutRoster(unique, byId) } : t,
      ),
    }));
  };

  const review = (raw: string) => {
    const matches = matchRoster(raw, index);
    if (!matches.length) {
      toast.error("No player names found in that text.");
      return;
    }
    setRows(matches);
  };

  const onFile = async (file: File) => {
    setReading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that file."));
        reader.readAsDataURL(file);
      });
      const result = await readRosterImage({ data: { imageDataUrl: dataUrl } });
      if (!result.lines.length) throw new Error("No players spotted in that screenshot.");
      if (result.teamName && !owner) setName(result.teamName);
      setText(result.lines.join("\n"));
      review(result.lines.join("\n"));
      toast.success(`Found ${result.lines.length} players in the screenshot`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const applyRows = () => {
    const ids = (rows ?? []).map((r) => r.playerId).filter((id): id is string => !!id);
    if (!ids.length) {
      toast.error("Pick at least one player first.");
      return;
    }
    setRoster(ids);
    setRows(null);
    setText("");
    toast.success(`${name}'s roster set with ${ids.length} players`);
  };

  const searchResults = query.trim().length >= 2
    ? players
        .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  const addPlayer = (p: SlimPlayer) => {
    setRoster([...rosterIds(team), p.id]);
    setQuery("");
    toast.success(`${p.name} added to ${team.name}`);
  };

  const removePlayer = (id: string) => {
    setRoster(rosterIds(team).filter((x) => x !== id));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-display text-xl font-bold">1. Team details</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="team-name" className="text-base">Team name</Label>
            <Input id="team-name" className="mt-1 h-11 text-base" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="team-owner" className="text-base">Owner</Label>
            <Input id="team-owner" className="mt-1 h-11 text-base" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
        </div>
        <Button className="mt-3 text-base font-semibold" onClick={saveDetails}>
          Save team details
        </Button>

        <h2 className="mt-7 font-display text-xl font-bold">2. Bring in the roster</h2>
        <p className="mt-1 text-base text-muted-foreground">
          Paste the roster from ESPN or Yahoo (one player per line), or upload a screenshot.
        </p>
        <Textarea
          rows={9}
          className="mt-3 text-base"
          placeholder={"Josh Allen QB BUF\nBijan Robinson RB ATL\nEagles D/ST"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button className="text-base font-semibold" onClick={() => review(text)} disabled={!text.trim()}>
            Review players
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          <Button
            variant="outline"
            className="text-base font-semibold"
            disabled={reading}
            onClick={() => fileRef.current?.click()}
          >
            {reading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="mr-2 h-4 w-4" />
            )}
            {reading ? "Reading screenshot…" : "Upload screenshot"}
          </Button>
        </div>

        {rows && (
          <div className="mt-5 rounded-xl border">
            <div className="flex items-center justify-between border-b bg-secondary/60 px-4 py-2">
              <span className="font-display text-lg font-bold">
                3. Check the matches ({rows.filter((r) => r.playerId).length}/{rows.length})
              </span>
              <Button size="sm" onClick={applyRows}>Use this roster</Button>
            </div>
            <ul className="max-h-[28rem] divide-y overflow-y-auto">
              {rows.map((row, i) => (
                <li key={`${row.raw}-${i}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                  <span className="truncate text-base">{row.raw}</span>
                  {row.candidates.length === 0 ? (
                    <span className="text-base font-semibold text-injury-out">No match found</span>
                  ) : (
                    <Select
                      value={row.playerId ?? ""}
                      onValueChange={(v) =>
                        setRows((prev) =>
                          (prev ?? []).map((r, j) => (j === i ? { ...r, playerId: v, status: "matched" } : r)),
                        )
                      }
                    >
                      <SelectTrigger className={cn("h-11 text-base", !row.playerId && "border-injury-questionable")}>
                        <SelectValue placeholder="Pick the right player" />
                      </SelectTrigger>
                      <SelectContent>
                        {row.candidates.map((c) => (
                          <SelectItem key={c.id} value={c.id} className="text-base">
                            {c.name} · {c.team} {c.pos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-display text-xl font-bold">Add a player by name</h2>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-12 pl-10 text-base"
            placeholder="Search any NFL player…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {searchResults.length > 0 && (
          <ul className="mt-3 divide-y rounded-xl border">
            {searchResults.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <PlayerCell player={p} compact />
                <Button size="sm" variant="outline" onClick={() => addPlayer(p)}>
                  <UserPlus className="mr-1.5 h-4 w-4" /> Add
                </Button>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-7 font-display text-xl font-bold">
          {team.name}&rsquo;s roster ({current.length})
        </h2>
        {current.length === 0 ? (
          <p className="mt-2 text-base text-muted-foreground">No players yet.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-xl border">
            {current.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <PlayerCell player={p} compact />
                <Button size="sm" variant="ghost" onClick={() => removePlayer(p.id)} aria-label={`Remove ${p.name}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
