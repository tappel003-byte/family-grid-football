import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLeague } from "@/lib/fantasy/hooks";
import { reloadLeague } from "@/lib/fantasy/store";
import { cancelClaim, listClaims, runWaivers, type ClaimRow } from "@/lib/fantasy/waivers.functions";
import { formatRunTime, lastWaiverRun, nextWaiverRun } from "@/lib/fantasy/waiver-cycle";
import { useTimeZone } from "@/lib/timezone";

export const Route = createFileRoute("/waivers")({
  head: () => ({
    meta: [
      { title: "Waivers — La Familia" },
      { name: "description", content: "Pending waiver claims, pick order, and results for La Familia." },
      { property: "og:title", content: "Waivers — La Familia" },
      { property: "og:description", content: "See who's claimed whom and when waivers run." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <PageTitle title="Waivers" subtitle="Claims run Wednesday at 12:01 AM Eastern — lowest-ranked team picks first" />
      <Suspense fallback={<LoadingScreen />}>
        <WaiversPage />
      </Suspense>
    </AppShell>
  ),
  errorComponent: ({ error }) => <AppShell><p role="alert">{error.message}</p></AppShell>,
  notFoundComponent: () => <AppShell>Nothing here.</AppShell>,
});

function ClaimLine({ c, action }: { c: ClaimRow; action?: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <span className="min-w-0">
        <span className="block truncate font-semibold">
          {c.team_name} → {c.player_name} <span className="text-muted-foreground">({c.player_pos})</span>
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {c.drop_player_id ? `dropping ${c.drop_player_name}` : "no drop"}
          {c.status !== "pending" ? ` · ${c.status === "won" ? "Won" : c.status === "lost" ? "Lost" : "Cancelled"}` : ""}
        </span>
      </span>
      {action}
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function WaiversPage() {
  const { league: maybeLeague } = useLeague();
  const { user } = useAuth();
  const tz = useTimeZone();
  const queryClient = useQueryClient();
  const fetchClaims = useServerFn(listClaims);
  const run = useServerFn(runWaivers);
  const cancel = useServerFn(cancelClaim);
  const { data: claims = [] } = useQuery<ClaimRow[]>({ queryKey: ["waiver-claims"], queryFn: fetchClaims });

  const waiverMode = maybeLeague?.rules.waiverMode;
  // Backup to the automatic Wednesday run: process anything overdue on open.
  useEffect(() => {
    if (waiverMode !== "waivers") return;
    void run({ data: {} })
      .then((res) => {
        if (res.won + res.lost > 0) {
          void queryClient.invalidateQueries({ queryKey: ["waiver-claims"] });
          void reloadLeague();
        }
      })
      .catch(() => undefined);
  }, [waiverMode, run, queryClient]);

  if (!maybeLeague) return <LoadingScreen />;
  const league = maybeLeague;

  const mySlot = league.teams.findIndex((t) => t.userId === user?.id);
  const order = league.rules.waiverOrder;
  const rank = (slot: number) => {
    const i = order.indexOf(slot);
    return i === -1 ? 999 + slot : i;
  };
  const pending = claims
    .filter((c) => c.status === "pending")
    .sort((a, b) => rank(a.team_slot) - rank(b.team_slot) || a.created_at.localeCompare(b.created_at));
  const mine = claims.filter((c) => c.team_slot === mySlot);
  const lastRun = lastWaiverRun();
  const results = claims
    .filter((c) => c.status === "won" || c.status === "lost")
    .slice(0, 20);

  const pullBack = (id: string) =>
    void cancel({ data: { claimId: id } })
      .then(() => queryClient.invalidateQueries({ queryKey: ["waiver-claims"] }))
      .then(() => toast.success("Claim cancelled"))
      .catch((err: Error) => toast.error(err.message));

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/40 bg-primary/10 p-4">
        <p className="font-semibold">Next waiver run: {formatRunTime(nextWaiverRun(), tz)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Wednesday opens free agency. Any unowned player is an instant Add until his game starts.
          After kickoff, Claim stays available and waits for the next run. Last run: {formatRunTime(lastRun, tz)}.
        </p>
      </div>

      <Section title="Your claims">
        {mine.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No claims yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-md border">
            {mine.slice(0, 15).map((c) => (
              <ClaimLine
                key={c.id}
                c={c}
                action={
                  c.status === "pending" ? (
                    <Button variant="outline" size="sm" onClick={() => pullBack(c.id)}>Cancel</Button>
                  ) : undefined
                }
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title="League claim list">
        <p className="mt-1 text-sm text-muted-foreground">In pick order — top goes first.</p>
        {pending.length === 0 ? (
          <p className="mt-2 text-muted-foreground">No claims waiting.</p>
        ) : (
          <ol className="mt-2 divide-y rounded-md border">
            {pending.map((c) => <ClaimLine key={c.id} c={c} />)}
          </ol>
        )}
      </Section>

      <Section title="Recent results">
        {results.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Nothing processed yet.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-md border">
            {results.map((c) => <ClaimLine key={c.id} c={c} />)}
          </ul>
        )}
      </Section>
    </div>
  );
}
