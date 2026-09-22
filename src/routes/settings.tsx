import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { toast } from "sonner";
import { CommissionerOnly } from "@/components/fantasy/AuthGate";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TeamCrest } from "@/components/fantasy/MatchupBoard";
import { WeekSelector } from "@/components/fantasy/WeekSelector";
import { playersQueryOptions, useLeague } from "@/lib/fantasy/hooks";
import { buildLeague } from "@/lib/fantasy/league";
import { resetLeague, setLeague, updateLeague } from "@/lib/fantasy/store";
import {
  HALF_PPR_SCORING,
  PPR_SCORING,
  SCORING_FIELDS,
  STANDARD_SCORING,
  type Scoring,
} from "@/lib/fantasy/scoring";

export const Route = createFileRoute("/settings")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Commissioner Settings — Family Football" },
      {
        name: "description",
        content: "Adjust scoring rules, rename family teams and set the current week.",
      },
      { property: "og:title", content: "Commissioner Settings — Family Football" },
      {
        property: "og:description",
        content: "Adjust scoring rules, rename family teams and set the current week.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <CommissionerOnly>
        <Suspense fallback={<LoadingScreen />}>
          <SettingsPage />
        </Suspense>
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

function SettingsPage() {
  const { league, players } = useLeague();
  if (!league) return <LoadingScreen label="Setting up your league…" />;

  const applyPreset = (scoring: Scoring, name: string) => {
    updateLeague((l) => ({ ...l, scoring: { ...scoring } }));
    toast.success(`${name} scoring applied`);
  };

  const setScoring = (key: keyof Scoring, value: number) =>
    updateLeague((l) => ({ ...l, scoring: { ...l.scoring, [key]: value } }));

  return (
    <>
      <PageTitle
        title="Commissioner Settings"
        subtitle="Only the commissioner should change these — they affect everyone's scores."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-display text-2xl font-bold">League</h2>
          <div className="mt-4 grid gap-4">
            <div>
              <Label htmlFor="league-name" className="text-base">
                League name
              </Label>
              <Input
                id="league-name"
                className="mt-1 h-11 text-base"
                value={league.name}
                onChange={(e) => updateLeague((l) => ({ ...l, name: e.target.value }))}
              />
            </div>
            <div>
              <span className="text-base font-medium">Current week</span>
              <div className="mt-1">
                <WeekSelector
                  week={league.currentWeek}
                  onChange={(w) => updateLeague((l) => ({ ...l, currentWeek: w }))}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {[8, 10].map((count) => (
                <Button
                  key={count}
                  variant="outline"
                  onClick={() => {
                    setLeague(buildLeague(players, count));
                    toast.success(`New ${count}-team league drafted`);
                  }}
                >
                  Redraft as {count} teams
                </Button>
              ))}
              <Button
                variant="ghost"
                onClick={() => {
                  resetLeague();
                  toast.success("League reset");
                }}
              >
                Reset league
              </Button>
            </div>
          </div>

          <h2 className="mt-8 font-display text-2xl font-bold">Teams</h2>
          <ul className="mt-3 divide-y rounded-xl border">
            {league.teams.map((team) => (
              <li key={team.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-3">
                <TeamCrest team={team} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    className="h-10 text-base"
                    aria-label={`${team.name} name`}
                    value={team.name}
                    onChange={(e) =>
                      updateLeague((l) => ({
                        ...l,
                        teams: l.teams.map((t) =>
                          t.id === team.id ? { ...t, name: e.target.value } : t,
                        ),
                      }))
                    }
                  />
                  <Input
                    className="h-10 text-base"
                    aria-label={`${team.name} owner`}
                    value={team.owner}
                    onChange={(e) =>
                      updateLeague((l) => ({
                        ...l,
                        teams: l.teams.map((t) =>
                          t.id === team.id ? { ...t, owner: e.target.value } : t,
                        ),
                      }))
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-display text-2xl font-bold">Scoring rules</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => applyPreset(STANDARD_SCORING, "Standard")}>Standard</Button>
            <Button onClick={() => applyPreset(HALF_PPR_SCORING, "Half PPR")} variant="outline">
              Half PPR
            </Button>
            <Button onClick={() => applyPreset(PPR_SCORING, "PPR")} variant="outline">
              PPR
            </Button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {SCORING_FIELDS.map((field) => (
              <div key={field.key} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3">
                <Label htmlFor={field.key} className="text-base leading-snug">
                  {field.label}
                </Label>
                <Input
                  id={field.key}
                  type="number"
                  step={field.step}
                  className="h-11 text-base tabular-nums"
                  value={league.scoring[field.key]}
                  onChange={(e) => setScoring(field.key, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
