import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { Suspense } from "react";
import { toast } from "sonner";
import { CommissionerOnly } from "@/components/fantasy/AuthGate";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, useMembers } from "@/lib/auth";
import {
  assignTeam,
  removeMember,
  resetMemberPassword,
  setMemberRole,
} from "@/lib/fantasy/league.functions";
import { setScoreOverride } from "@/lib/fantasy/overrides.functions";
import { allOverrides, reloadLeague, reloadOverrides, scoreOverride } from "@/lib/fantasy/store";
import { RULE_POSITIONS } from "@/lib/fantasy/rules";
import { WEEKS, rosterIds, type League } from "@/lib/fantasy/league";
import {
  cancelClaim,
  listClaims,
  runWaivers,
  type ClaimRow,
} from "@/lib/fantasy/waivers.functions";
import { saveSeasonToHistory } from "@/lib/fantasy/results.functions";
import { weekDataQueryOptions } from "@/lib/fantasy/hooks";
import { scoreStats, ZERO_STATS } from "@/lib/fantasy/scoring";
import { useState } from "react";
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
      { title: "Commissioner Settings — La Familia" },
      {
        name: "description",
        content: "Adjust scoring rules, rename family teams and set the current week.",
      },
      { property: "og:title", content: "Commissioner Settings — La Familia" },
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
  const { user } = useAuth();
  const { data: members = [], refetch: refetchMembers } = useMembers(true);
  const assign = useServerFn(assignTeam);
  const changeRole = useServerFn(setMemberRole);
  const resetPassword = useServerFn(resetMemberPassword);
  const kickMember = useServerFn(removeMember);
  const saveOverride = useServerFn(setScoreOverride);
  const [fixWeek, setFixWeek] = useState<number | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  if (!league) return <LoadingScreen label="Setting up your league…" />;

  const correctionWeek = fixWeek ?? league.currentWeek;
  const overrideCount = allOverrides().size;

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

      <div className="mb-5">
        <Button asChild variant="outline" className="text-base font-semibold">
          <Link to="/import">Import rosters</Link>
        </Button>
      </div>

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
                  <select
                    aria-label={`Who manages ${team.name}`}
                    className="h-10 rounded-md border bg-background px-2 text-base sm:col-span-2"
                    value={team.userId ?? ""}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      void assign({ data: { slot: league.teams.indexOf(team), userId: value } })
                        .then(async () => {
                          await reloadLeague();
                          await refetchMembers();
                          toast.success(
                            value ? "Team manager updated" : "Team is now unassigned",
                          );
                        })
                        .catch((err: Error) => toast.error(err.message));
                    }}
                  >
                    <option value="">No family member linked yet</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 font-display text-2xl font-bold">Family members</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Everyone who has signed in. Commissioners can change scoring, weeks and rosters.
          </p>
          <ul className="mt-3 divide-y rounded-xl border">
            {members.length === 0 && (
              <li className="p-3 text-base text-muted-foreground">Nobody has signed in yet.</li>
            )}
            {members.map((m) => {
              const theirTeam = league.teams.find((t) => t.userId === m.id);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{m.display_name}</div>
                    <div className="truncate text-sm text-muted-foreground">
                      {m.email} · {theirTeam ? theirTeam.name : "no team yet"}
                    </div>
                  </div>
                  <Button
                    variant={m.role === "commissioner" ? "default" : "outline"}
                    size="sm"
                    disabled={m.id === user?.id}
                    onClick={() => {
                      const role = m.role === "commissioner" ? "member" : "commissioner";
                      void changeRole({ data: { userId: m.id, role } })
                        .then(async () => {
                          await refetchMembers();
                          toast.success(
                            role === "commissioner"
                              ? `${m.display_name} is now a commissioner`
                              : `${m.display_name} is now a regular member`,
                          );
                        })
                        .catch((err: Error) => toast.error(err.message));
                    }}
                  >
                    {m.role === "commissioner" ? "Commissioner" : "Make commissioner"}
                  </Button>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void resetPassword({ data: { userId: m.id } })
                          .then(() =>
                            toast.success(
                              `${m.display_name} can sign in again with the family password`,
                            ),
                          )
                          .catch((err: Error) => toast.error(err.message));
                      }}
                    >
                      Reset sign-in
                    </Button>
                    {theirTeam && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void assign({
                            data: { slot: league.teams.indexOf(theirTeam), userId: null },
                          })
                            .then(async () => {
                              await reloadLeague();
                              await refetchMembers();
                              toast.success(`${theirTeam.name} is free to be claimed again`);
                            })
                            .catch((err: Error) => toast.error(err.message));
                        }}
                      >
                        Unclaim team
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={m.id === user?.id}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Remove ${m.display_name} from the league? Their team goes back up for grabs.`,
                          )
                        )
                          return;
                        void kickMember({ data: { userId: m.id } })
                          .then(async () => {
                            await reloadLeague();
                            await refetchMembers();
                            toast.success(`${m.display_name} removed`);
                          })
                          .catch((err: Error) => toast.error(err.message));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              );
            })}
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

          <h2 className="mt-8 font-display text-2xl font-bold">House rules</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Roster size, how many of each position a team may carry, and when trading closes.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3">
              <Label htmlFor="roster-limit" className="text-base">
                Players per team
              </Label>
              <Input
                id="roster-limit"
                type="number"
                min={9}
                className="h-11 text-base tabular-nums"
                value={league.rules.rosterLimit}
                onChange={(e) =>
                  updateLeague((l) => ({
                    ...l,
                    rules: { ...l.rules, rosterLimit: Number(e.target.value) || 1 },
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3">
              <Label htmlFor="trade-deadline" className="text-base">
                Trade deadline week (0 = never)
              </Label>
              <Input
                id="trade-deadline"
                type="number"
                min={0}
                max={18}
                className="h-11 text-base tabular-nums"
                value={league.rules.tradeDeadlineWeek}
                onChange={(e) =>
                  updateLeague((l) => ({
                    ...l,
                    rules: { ...l.rules, tradeDeadlineWeek: Number(e.target.value) || 0 },
                  }))
                }
              />
            </div>
            {RULE_POSITIONS.map((pos) => (
              <div key={pos} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3">
                <Label htmlFor={`limit-${pos}`} className="text-base">
                  Most {pos}s allowed
                </Label>
                <Input
                  id={`limit-${pos}`}
                  type="number"
                  min={0}
                  className="h-11 text-base tabular-nums"
                  value={league.rules.positionLimits[pos] ?? 0}
                  onChange={(e) =>
                    updateLeague((l) => ({
                      ...l,
                      rules: {
                        ...l.rules,
                        positionLimits: {
                          ...l.rules.positionLimits,
                          [pos]: Math.max(0, Number(e.target.value) || 0),
                        },
                      },
                    }))
                  }
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Label htmlFor="waiver-mode" className="text-base">
                Free agents
              </Label>
              <select
                id="waiver-mode"
                className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-base"
                value={league.rules.waiverMode}
                onChange={(e) =>
                  updateLeague((l) => ({
                    ...l,
                    rules: {
                      ...l.rules,
                      waiverMode: e.target.value === "locked" ? "locked" : "free",
                    },
                  }))
                }
              >
                <option value="free">Grab anybody, anytime</option>
                <option value="locked">Locked once a player's game kicks off</option>
              </select>
            </div>
          </div>

          <h2 className="mt-8 font-display text-2xl font-bold">Fix a final score</h2>
          <p className="mt-1 text-base text-muted-foreground">
            Type a score to overrule the live total for one team in one week. Leave it blank to go
            back to the real score.
            {overrideCount > 0 ? ` ${overrideCount} correction${overrideCount === 1 ? "" : "s"} in place.` : ""}
          </p>
          <div className="mt-3">
            <Label htmlFor="fix-week" className="text-base">
              Week
            </Label>
            <select
              id="fix-week"
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-base sm:max-w-[10rem]"
              value={correctionWeek}
              onChange={(e) => {
                setFixWeek(Number(e.target.value));
                setDraft({});
              }}
            >
              {WEEKS.map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>
          <ul className="mt-3 divide-y rounded-xl border">
            {league.teams.map((team, slot) => {
              const current = scoreOverride(correctionWeek, slot);
              const value = draft[slot] ?? (current != null ? String(current) : "");
              return (
                <li key={team.id} className="flex items-center gap-3 p-3">
                  <TeamCrest team={team} />
                  <span className="min-w-0 flex-1 truncate text-base font-semibold">
                    {team.name}
                  </span>
                  <Input
                    aria-label={`Final score for ${team.name} in week ${correctionWeek}`}
                    type="number"
                    step="0.1"
                    placeholder="live"
                    className="h-10 w-24 text-base tabular-nums"
                    value={value}
                    onChange={(e) => setDraft((d) => ({ ...d, [slot]: e.target.value }))}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const raw = value.trim();
                      const points = raw === "" ? null : Number(raw);
                      void saveOverride({
                        data: { week: correctionWeek, teamSlot: slot, points, note: "" },
                      })
                        .then(async () => {
                          await reloadOverrides();
                          setDraft((d) => {
                            const next = { ...d };
                            delete next[slot];
                            return next;
                          });
                          toast.success(
                            points == null
                              ? `${team.name} back to the live score`
                              : `${team.name} set to ${points} for week ${correctionWeek}`,
                          );
                        })
                        .catch((err: Error) => toast.error(err.message));
                    }}
                  >
                    Save
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
