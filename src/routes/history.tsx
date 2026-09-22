import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { AppShell, PageTitle } from "@/components/fantasy/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteSeason, saveSeason, type SeasonInput } from "@/lib/fantasy/league.functions";

type Standing = { place: number; team: string; owner: string; record: string };

type SeasonRow = SeasonInput & { standings: Standing[] };

const FIRST_SEASON = 2012;

function emptySeason(season: number): SeasonRow {
  return {
    season,
    champion: "",
    champion_owner: "",
    runner_up: "",
    runner_up_owner: "",
    regular_season_best: "",
    notes: "",
    standings: [],
  };
}

function standingsToText(rows: Standing[]) {
  return rows.map((r) => [r.team, r.owner, r.record].filter(Boolean).join(" | ")).join("\n");
}

function textToStandings(text: string): Standing[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => {
      const [team = "", owner = "", record = ""] = line.split("|").map((p) => p.trim());
      return { place: i + 1, team: team.replace(/^\d+[.)]\s*/, ""), owner, record };
    });
}

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "League History — Family Football" },
      {
        name: "description",
        content: "Every champion and final standing in the family league since 2013.",
      },
      { property: "og:title", content: "League History — Family Football" },
      {
        property: "og:description",
        content: "Every champion and final standing in the family league since 2013.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <HistoryPage />
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

function HistoryPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<SeasonRow | null>(null);

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ["season-history"],
    queryFn: async (): Promise<SeasonRow[]> => {
      const { data, error } = await supabase
        .from("season_history")
        .select("*")
        .order("season", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({
        season: r.season,
        champion: r.champion,
        champion_owner: r.champion_owner,
        runner_up: r.runner_up,
        runner_up_owner: r.runner_up_owner,
        regular_season_best: r.regular_season_best,
        notes: r.notes,
        standings: (r.standings as Standing[]) ?? [],
      }));
    },
  });

  const takenSeasons = new Set(seasons.map((s) => s.season));
  const nextSeason =
    Array.from({ length: new Date().getFullYear() - FIRST_SEASON + 1 }, (_, i) => FIRST_SEASON + i)
      .reverse()
      .find((y) => !takenSeasons.has(y)) ?? new Date().getFullYear();

  const titlesByOwner = new Map<string, number>();
  for (const s of seasons) {
    const who = s.champion_owner || s.champion;
    if (who) titlesByOwner.set(who, (titlesByOwner.get(who) ?? 0) + 1);
  }
  const dynasty = [...titlesByOwner.entries()].sort((a, b) => b[1] - a[1]);

  const { isCommissioner } = useAuth();

  const save = async (row: SeasonRow) => {
    await saveSeason({ data: row });
    await queryClient.invalidateQueries({ queryKey: ["season-history"] });
    setEditing(null);
    toast.success(`${row.season} season saved`);
  };

  const remove = async (season: number) => {
    await deleteSeason({ data: { season } });
    await queryClient.invalidateQueries({ queryKey: ["season-history"] });
    toast.success(`${season} season removed`);
  };

  return (
    <>
      <PageTitle
        title="League History"
        subtitle={`Champions and final standings since ${FIRST_SEASON}.`}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {isCommissioner && (
          <Button onClick={() => setEditing(emptySeason(nextSeason))} className="text-base font-semibold">
            <Plus className="mr-2 h-4 w-4" /> Add a season
          </Button>
        )}
        {dynasty.length > 0 && (
          <p className="text-base text-muted-foreground">
            Most titles:{" "}
            <span className="font-semibold text-foreground">
              {dynasty
                .slice(0, 3)
                .map(([who, n]) => `${who} (${n})`)
                .join(" · ")}
            </span>
          </p>
        )}
      </div>

      {isLoading && <p className="text-lg text-muted-foreground">Loading past seasons…</p>}

      {!isLoading && seasons.length === 0 && (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <Trophy className="mx-auto h-10 w-10 text-accent" />
          <h2 className="mt-3 font-display text-2xl font-bold">No seasons saved yet</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Add a season to start the record book going back to {FIRST_SEASON}.
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {seasons.map((s) => (
          <article key={s.season} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-secondary/60 px-5 py-4">
              <div className="flex items-center gap-4">
                <span className="font-display text-3xl font-bold tabular-nums">{s.season}</span>
                <div>
                  <div className="flex items-center gap-2 font-display text-xl font-bold">
                    <Trophy className="h-5 w-5 text-accent" />
                    {s.champion || "Champion not recorded"}
                  </div>
                  {s.champion_owner && (
                    <div className="text-base text-muted-foreground">{s.champion_owner}</div>
                  )}
                </div>
              </div>
              {isCommissioner && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
                    <Pencil className="mr-1.5 h-4 w-4" /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(s.season)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                  </Button>
                </div>
              )}
            </header>
            <div className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
              <dl className="space-y-2 text-base">
                <div>
                  <dt className="text-sm uppercase tracking-widest text-muted-foreground">
                    Runner-up
                  </dt>
                  <dd className="font-semibold">
                    {s.runner_up || "—"}
                    {s.runner_up_owner && (
                      <span className="font-normal text-muted-foreground"> · {s.runner_up_owner}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm uppercase tracking-widest text-muted-foreground">
                    Best regular season
                  </dt>
                  <dd className="font-semibold">{s.regular_season_best || "—"}</dd>
                </div>
                {s.notes && (
                  <div>
                    <dt className="text-sm uppercase tracking-widest text-muted-foreground">Notes</dt>
                    <dd>{s.notes}</dd>
                  </div>
                )}
              </dl>
              {s.standings.length > 0 && (
                <ol className="divide-y rounded-xl border">
                  {s.standings.map((row) => (
                    <li
                      key={row.place}
                      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2"
                    >
                      <span className="font-display text-lg font-bold tabular-nums text-muted-foreground">
                        {row.place}
                      </span>
                      <span className="truncate">
                        <span className="font-semibold">{row.team}</span>
                        {row.owner && (
                          <span className="text-muted-foreground"> · {row.owner}</span>
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground">{row.record}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </article>
        ))}
      </div>

      {editing && <SeasonDialog value={editing} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}

function SeasonDialog({
  value,
  onClose,
  onSave,
}: {
  value: SeasonRow;
  onClose: () => void;
  onSave: (row: SeasonRow) => Promise<void>;
}) {
  const [form, setForm] = useState<SeasonRow>(value);
  const [standingsText, setStandingsText] = useState(standingsToText(value.standings));
  const [busy, setBusy] = useState(false);

  const field = (key: keyof SeasonRow, label: string) => (
    <div>
      <Label htmlFor={key} className="text-base">
        {label}
      </Label>
      <Input
        id={key}
        className="mt-1 h-11 text-base"
        value={String(form[key] ?? "")}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Season record</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="season" className="text-base">
              Season
            </Label>
            <Input
              id="season"
              type="number"
              className="mt-1 h-11 text-base tabular-nums"
              value={form.season}
              onChange={(e) => setForm({ ...form, season: Number(e.target.value) })}
            />
          </div>
          {field("champion", "Champion team")}
          {field("champion_owner", "Champion owner")}
          {field("runner_up", "Runner-up team")}
          {field("runner_up_owner", "Runner-up owner")}
          {field("regular_season_best", "Best regular season")}
        </div>
        <div className="mt-2">
          <Label htmlFor="standings" className="text-base">
            Final standings — one team per line: Team | Owner | 10-4
          </Label>
          <Textarea
            id="standings"
            rows={8}
            className="mt-1 text-base"
            placeholder={"Grandpa's Gridiron | Papa Ray | 11-3\nMom's Monsters | Linda | 9-5"}
            value={standingsText}
            onChange={(e) => setStandingsText(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="notes" className="text-base">
            Notes
          </Label>
          <Textarea
            id="notes"
            rows={2}
            className="mt-1 text-base"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void onSave({ ...form, standings: textToStandings(standingsText) })
                .catch((err: Error) => toast.error(err.message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Saving…" : "Save season"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
