import { createFileRoute } from "@tanstack/react-router";
import { Suspense, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { TeamCrest } from "@/components/fantasy/MatchupBoard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { playersQueryOptions, useLeague } from "@/lib/fantasy/hooks";
import { rosterIds, type FantasyTeam } from "@/lib/fantasy/league";
import { listTrades, proposeTrade, respondToTrade } from "@/lib/fantasy/trades.functions";
import { reloadLeague } from "@/lib/fantasy/store";
import { cn } from "@/lib/utils";
import { listTradeBlock } from "@/lib/fantasy/community";
import { Handshake } from "lucide-react";

export const Route = createFileRoute("/trades")({
  validateSearch: (search: Record<string, unknown>) => ({
    with: typeof search["with"] === "number"
      ? search["with"]
      : typeof search["with"] === "string" && search["with"] !== "" && Number.isFinite(Number(search["with"]))
        ? Number(search["with"])
        : undefined,
    want: typeof search["want"] === "string" ? search["want"] : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Trades — La Familia" },
      {
        name: "description",
        content: "Offer a trade to another family team, then accept or decline offers you get.",
      },
      { property: "og:title", content: "Trades — La Familia" },
      {
        property: "og:description",
        content: "Offer a trade to another family team, then accept or decline offers you get.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <TradesPage />
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
  notFoundComponent: () => <AppShell>Nothing here.</AppShell>,
});

function PlayerPicker({
  team,
  byId,
  picked,
  onToggle,
  heading,
}: {
  team: FantasyTeam;
  byId: Map<string, { id: string; name: string; pos: string; team: string }>;
  picked: Set<string>;
  onToggle: (id: string) => void;
  heading: string;
}) {
  const ids = rosterIds(team);
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        <TeamCrest team={team} />
        <div className="min-w-0">
          <div className="text-sm uppercase tracking-wide text-muted-foreground">{heading}</div>
          <div className="truncate font-display text-lg font-bold">{team.name}</div>
        </div>
      </div>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {ids.map((id) => {
          const p = byId.get(id);
          if (!p) return null;
          const on = picked.has(id);
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onToggle(id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-base transition-colors",
                  on ? "border-primary bg-primary/10 font-semibold" : "hover:bg-secondary",
                )}
              >
                <span className="truncate">{p.name}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {p.pos} · {p.team}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TradesPage() {
  const { league, byId } = useLeague();
  const { user, isCommissioner } = useAuth();
  const search = Route.useSearch();
  const propose = useServerFn(proposeTrade);
  const respond = useServerFn(respondToTrade);
  const trades = useQuery({ queryKey: ["trades"], queryFn: () => listTrades() });
  const tradeBlock = useQuery({ queryKey: ["trade-block"], queryFn: listTradeBlock });

  const [partnerSlot, setPartnerSlot] = useState<number | null>(search.with ?? null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [theirs, setTheirs] = useState<Set<string>>(
    () => (search.want ? new Set([search.want]) : new Set()),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  /** Light confirm before accepting — trades move players immediately. */
  const [confirmAcceptId, setConfirmAcceptId] = useState<string | null>(null);

  // Deep-link from watchlist: pre-pick the other team and the player you want.
  useEffect(() => {
    if (typeof search.with === "number") setPartnerSlot(search.with);
    if (search.want) setTheirs(new Set([search.want]));
  }, [search.with, search.want]);

  if (!league) return <LoadingScreen label="Setting up your league…" />;

  const myIndex = league.teams.findIndex((t) => !!user && t.userId === user.id);
  const myTeam = myIndex >= 0 ? league.teams[myIndex]! : null;
  // Don't treat your own slot as a trade partner (bad deep-link).
  const activePartnerSlot =
    partnerSlot != null && partnerSlot !== myIndex ? partnerSlot : null;
  const partner = activePartnerSlot != null ? league.teams[activePartnerSlot] ?? null : null;
  const deadline = league.rules.tradeDeadlineWeek;
  const closed = deadline > 0 && league.currentWeek > deadline;

  const toggle = (set: Set<string>, apply: (s: Set<string>) => void) => (id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };

  const names = (ids: Set<string>) =>
    [...ids].map((id) => byId.get(id)?.name ?? "Unknown player");

  const send = () => {
    if (!myTeam || activePartnerSlot == null) return;
    setBusy(true);
    void propose({
      data: {
        toSlot: activePartnerSlot,
        fromPlayerIds: [...mine],
        toPlayerIds: [...theirs],
        fromPlayerNames: names(mine),
        toPlayerNames: names(theirs),
        note,
      },
    })
      .then(async () => {
        toast.success(`Offer sent to ${partner?.name ?? "them"}`);
        setMine(new Set());
        setTheirs(new Set());
        setNote("");
        await trades.refetch();
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setBusy(false));
  };

  const act = (tradeId: string, action: "accept" | "decline" | "cancel") => {
    setBusy(true);
    void respond({ data: { tradeId, action } })
      .then(async () => {
        toast.success(
          action === "accept"
            ? "Trade done — both rosters updated"
            : action === "decline"
              ? "Offer declined"
              : "Offer pulled back",
        );
        setConfirmAcceptId(null);
        await Promise.all([reloadLeague(), trades.refetch()]);
      })
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setBusy(false));
  };

  const pendingAccept = (trades.data ?? []).find((t) => t.id === confirmAcceptId);

  return (
    <>
      <PageTitle
        title="Trades"
        subtitle={
          closed
            ? `Trading closed after week ${deadline}.`
            : deadline > 0
              ? `Offer players to another family team. Trade deadline is week ${deadline}.`
              : "Offer players to another family team."
        }
      />

      {(tradeBlock.data ?? []).length > 0 && (
        <section className="mb-5 rounded-lg border bg-card p-4">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold"><Handshake className="h-5 w-5 text-primary" /> On the trade block</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(tradeBlock.data ?? []).map((row) => {
              const player = byId.get(row.player_id);
              const team = league.teams[row.team_slot];
              if (!player || !team) return null;
              return <Button key={row.id} variant="outline" className="h-auto justify-between py-3" onClick={() => { setPartnerSlot(row.team_slot); setTheirs(new Set([row.player_id])); }} disabled={row.team_slot === myIndex}><span className="truncate">{player.name}</span><span className="ml-2 text-xs text-muted-foreground">{team.name}</span></Button>;
            })}
          </div>
        </section>
      )}

      {!myTeam ? (
        <div className="rounded-2xl border bg-card p-6 text-lg">
          Your account isn't linked to a team yet, so you can't make an offer.
        </div>
      ) : (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-display text-2xl font-bold">Make an offer</h2>
          <div className="mt-3">
            <Label htmlFor="trade-partner" className="text-base">
              Trade with
            </Label>
            <select
              id="trade-partner"
              className="mt-1 h-11 w-full rounded-md border bg-background px-3 text-base sm:max-w-sm"
              value={activePartnerSlot ?? ""}
              onChange={(e) => {
                setPartnerSlot(e.target.value === "" ? null : Number(e.target.value));
                setTheirs(new Set());
              }}
            >
              <option value="">Pick a team…</option>
              {league.teams.map((t, i) =>
                i === myIndex ? null : (
                  <option key={t.id} value={i}>
                    {t.name} ({t.owner})
                  </option>
                ),
              )}
            </select>
          </div>

          {partner && (
            <>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <PlayerPicker
                  team={myTeam}
                  byId={byId}
                  picked={mine}
                  onToggle={toggle(mine, setMine)}
                  heading="You give up"
                />
                <PlayerPicker
                  team={partner}
                  byId={byId}
                  picked={theirs}
                  onToggle={toggle(theirs, setTheirs)}
                  heading="You get back"
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div>
                  <Label htmlFor="trade-note" className="text-base">
                    Message (optional)
                  </Label>
                  <Input
                    id="trade-note"
                    className="mt-1 h-11 text-base"
                    placeholder="Need a running back, help me out"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <Button
                  className="h-11 text-base"
                  disabled={busy || closed || (mine.size === 0 && theirs.size === 0)}
                  onClick={send}
                >
                  Send offer
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      <h2 className="mt-8 font-display text-2xl font-bold">Offers</h2>
      <ul className="mt-3 space-y-3">
        {(trades.data ?? []).length === 0 && (
          <li className="rounded-2xl border bg-card p-5 text-base text-muted-foreground">
            No trades yet this season.
          </li>
        )}
        {(trades.data ?? []).map((t) => {
          const iSent = myIndex === t.fromSlot;
          const iGotIt = myIndex === t.toSlot;
          const canAnswer = t.status === "pending" && (iGotIt || isCommissioner);
          const canCancel = t.status === "pending" && (iSent || isCommissioner);
          return (
            <li key={t.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-lg font-bold">
                  {t.fromTeamName} → {t.toTeamName}
                </p>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-semibold capitalize",
                    t.status === "pending" && "bg-secondary",
                    t.status === "accepted" && "bg-green-600/15 text-green-700 dark:text-green-400",
                    (t.status === "declined" || t.status === "cancelled") &&
                      "bg-destructive/10 text-destructive",
                  )}
                >
                  {t.status}
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-base sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">{t.fromTeamName} sends: </span>
                  {t.fromPlayerNames.join(", ") || "nobody"}
                </p>
                <p>
                  <span className="text-muted-foreground">{t.toTeamName} sends: </span>
                  {t.toPlayerNames.join(", ") || "nobody"}
                </p>
              </div>
              {t.note && <p className="mt-2 text-base italic text-muted-foreground">“{t.note}”</p>}
              <p className="mt-1 text-sm text-muted-foreground">
                Week {t.week} · offered by {t.proposerName || "a family member"}
              </p>
              {(canAnswer || canCancel) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canAnswer && (
                    <>
                      <Button disabled={busy} onClick={() => setConfirmAcceptId(t.id)}>
                        Accept trade
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => act(t.id, "decline")}
                      >
                        Decline
                      </Button>
                    </>
                  )}
                  {canCancel && (
                    <Button variant="ghost" disabled={busy} onClick={() => act(t.id, "cancel")}>
                      Pull it back
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!confirmAcceptId}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmAcceptId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept this trade?</DialogTitle>
            <DialogDescription>
              Players move right away on both rosters. You can&apos;t undo this from here.
            </DialogDescription>
          </DialogHeader>
          {pendingAccept && (
            <div className="space-y-1 rounded-xl border bg-secondary/40 p-4 text-sm">
              <p>
                <span className="font-semibold">{pendingAccept.fromTeamName} sends:</span>{" "}
                {pendingAccept.fromPlayerNames.join(", ") || "nobody"}
              </p>
              <p>
                <span className="font-semibold">{pendingAccept.toTeamName} sends:</span>{" "}
                {pendingAccept.toPlayerNames.join(", ") || "nobody"}
              </p>
            </div>
          )}
          <div className="mt-2 flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmAcceptId(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy || !confirmAcceptId}
              onClick={() => confirmAcceptId && act(confirmAcceptId, "accept")}
            >
              {busy ? "Accepting…" : "Yes, accept"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
