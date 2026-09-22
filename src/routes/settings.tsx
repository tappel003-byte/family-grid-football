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
  const claimsFetch = useServerFn(listClaims);
  const runClaimList = useServerFn(runWaivers);
  const pullClaim = useServerFn(cancelClaim);
  const closeSeason = useServerFn(saveSeasonToHistory);
  const queryClient = useQueryClient();
  const { data: claims = [] } = useQuery<ClaimRow[]>({
    queryKey: ["waiver-claims"],
    queryFn: claimsFetch,
  });

  /** Worst record picks first: order teams by wins (fewest first), then points. */
  async function setOrderFromStandings() {
    if (!league) return;
    try {
      const weeksPlayed = Math.max(0, league.currentWeek - 1);
      const weeks = Array.from({ length: weeksPlayed }, (_, i) => i + 1);
      const results = await Promise.all(
        weeks.map((w) => queryClient.fetchQuery(weekDataQueryOptions(w))),
      );
      const pts = (slot: number, week: number) => {
        const data = results[week - 1];
        const team = league.teams[slot];
        if (!team) return 0;
        return rosterIds(team)
          .filter(Boolean)
          .reduce((sum, id) => {
            const line = data?.stats[id];
            if (!line) return sum;
            const v = scoreStats(line, league.scoring);
            return sum + (Number.isFinite(v) ? v : 0);
          }, 0);
      };
      const recs = league.teams.map((_, slot) => {
        let wins = 0,
          losses = 0,
          ties = 0,
          pf = 0;
        for (let w = 1; w <= weeksPlayed; w++) {
          const pair = (league.schedule[w - 1] ?? []).find(
            ([h, a]) => h === slot || a === slot,
          );
          if (!pair) continue;
          const mine = pts(slot, w);
          const other = pair[0] === slot ? pair[1] : pair[0];
          const theirs = pts(other, w);
          pf += mine;
          if (mine > theirs) wins++;
          else if (mine < theirs) losses++;
          else ties++;
        }
        return { slot, wins, losses, ties, pf };
      });
      recs.sort((x, y) => x.wins * 2 + x.ties - (y.wins * 2 + y.ties) || x.pf - y.pf);
      updateLeague((l) => ({
        ...l,
        rules: { ...l.rules, waiverOrder: recs.map((r) => r.slot) },
      }));
      toast.success("Claim order set — the team with the worst record picks first");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set the claim order");
    }
  }


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
                      waiverMode: e.target.value as League["rules"]["waiverMode"],
                    },
                  }))
                }
              >
                <option value="free">Grab anybody, anytime</option>
                <option value="locked">Locked once a player's game kicks off</option>
                <option value="waivers">Claim order — pickups wait and process in order</option>
              </select>
            </div>
          </div>

          {league.rules.waiverMode === "waivers" && (
            <div className="mt-4 rounded-xl border bg-secondary/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold">Claim order</h3>
                  <p className="text-sm text-muted-foreground">
                    When several families want the same player, the team with the worse record
                    picks first.
                  </p>
                </div>
                <Button variant="outline" onClick={() => void setOrderFromStandings()}>
                  Set from current standings
                </Button>
              </div>
              <ol className="mt-3 space-y-1 text-base">
                {(league.rules.waiverOrder.length
                  ? league.rules.waiverOrder
                  : league.teams.map((_, i) => i)
                ).map((slot, i) => {
                  const team = league.teams[slot];
                  if (!team) return null;
                  return (
                    <li key={slot} className="flex items-center gap-2">
                      <span className="w-6 text-right font-display font-bold tabular-nums text-muted-foreground">
                        {i + 1}.
                      </span>
                      <span className="font-semibold">{team.name}</span>
                      <span className="truncate text-muted-foreground">{team.owner}</span>
                    </li>
                  );
                })}
              </ol>
              {league.rules.waiverOrder.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  No order set yet — teams pick in slot order until you set one.
                </p>
              )}
            </div>
          )}

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

        <section>
          <h2 className="font-display text-2xl font-bold">Waiver claims</h2>
          <p className="mt-1 text-muted-foreground">
            When the league uses claim order, pickups wait here until waivers run.
          </p>
          {claims.filter((c) => c.status === "pending").length === 0 ? (
            <p className="mt-3 text-muted-foreground">No claims waiting.</p>
          ) : (
            <ul className="mt-3 divide-y rounded-xl border">
              {claims
                .filter((c) => c.status === "pending")
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 p-3">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-semibold">
                        {c.team_name} → {c.player_name} ({c.player_pos})
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {c.drop_player_id
                          ? `dropping ${c.drop_player_name}`
                          : "no drop needed"}
                        {c.actor_name ? ` · by ${c.actor_name}` : ""}
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void pullClaim({ data: { claimId: c.id } })
                          .then(() => queryClient.invalidateQueries({ queryKey: ["waiver-claims"] }))
                          .then(() => toast.success("Claim pulled back"))
                          .catch((err: Error) => toast.error(err.message))
                      }
                    >
                      Pull back
                    </Button>
                  </li>
                ))}
            </ul>
          )}
          <Button
            className="mt-4"
            onClick={() =>
              void runClaimList({ data: { force: true } })
                .then((res) => {
                  queryClient.invalidateQueries({ queryKey: ["waiver-claims"] });
                  return reloadLeague().then(() => res);
                })
                .then((res) =>
                  toast.success(
                    res.won + res.lost === 0
                      ? "No claims to process right now"
                      : `Waivers done — ${res.won} claim${res.won === 1 ? "" : "s"} won`,
                  ),
                )
                .catch((err: Error) => toast.error(err.message))
            }
          >
            Run waivers now
          </Button>
        </section>

        <section>
          <h2 className="font-display text-2xl font-bold">Close out the season</h2>
          <p className="mt-1 max-w-prose text-muted-foreground">
            At the end of the year, save this season's final record into the History page. The
            weekly scores save themselves automatically as weeks finish — this button turns them
            into the official record book entry. You can still fill in the champion afterwards on
            the History page once playoffs end.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            onClick={() =>
              void closeSeason({ data: {} })
                .then((res) => toast.success(`${res.season} saved to History — best record: ${res.best}`))
                .catch((err: Error) => toast.error(err.message))
            }
          >
            Save {new Date().getFullYear()} to History
          </Button>
        </section>
      </div>
    </>
  );
}
