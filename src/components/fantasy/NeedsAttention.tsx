import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarOff, Handshake } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { League } from "@/lib/fantasy/league";
import { isOnBye, useInsights } from "@/components/fantasy/PlayerInsights";
import { isInactive } from "@/components/fantasy/PlayerCell";
import { listTrades } from "@/lib/fantasy/trades.functions";
import type { SlimPlayer } from "@/lib/sleeper.functions";

type Item = {
  key: string;
  icon: "out" | "bye" | "empty" | "trade";
  text: string;
  to: string;
  params?: Record<string, string>;
};

/**
 * Home strip: only your actionable items. Additive — does not change league data.
 */
export function NeedsAttention({
  league,
  byId,
}: {
  league: League;
  byId: Map<string, SlimPlayer>;
}) {
  const { user } = useAuth();
  const insights = useInsights();
  const fetchTrades = useServerFn(listTrades);
  const { data: trades = [] } = useQuery({
    queryKey: ["trades", "attention"],
    queryFn: () => fetchTrades(),
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  const myIndex = league.teams.findIndex((t) => !!user && t.userId === user.id);
  const myTeam = myIndex >= 0 ? league.teams[myIndex] : undefined;
  if (!myTeam) return null;

  const week = league.currentWeek;
  const items: Item[] = [];

  myTeam.starters.forEach((id, slot) => {
    if (!id) {
      items.push({
        key: `empty-${slot}`,
        icon: "empty",
        text: `Empty ${["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF"][slot] ?? "slot"} in your lineup`,
        to: "/my-team",
      });
      return;
    }
    const player = byId.get(id);
    if (!player) return;
    if (isInactive(player.injury)) {
      items.push({
        key: `out-${id}`,
        icon: "out",
        text: `${player.name} is out — swap them on My Team`,
        to: "/my-team",
      });
    } else if (isOnBye(insights, player, week)) {
      items.push({
        key: `bye-${id}`,
        icon: "bye",
        text: `${player.name} is on bye — still in your lineup`,
        to: "/my-team",
      });
    }
  });

  for (const trade of trades) {
    if (trade.status !== "pending") continue;
    if (trade.toSlot !== myIndex) continue;
    items.push({
      key: `trade-${trade.id}`,
      icon: "trade",
      text: `Trade waiting from ${trade.fromTeamName}`,
      to: "/trades",
    });
  }

  // Cap so the home screen stays calm.
  const shown = items.slice(0, 4);
  if (!shown.length) return null;

  return (
    <section
      aria-label="Needs attention"
      className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-amber-950"
    >
      <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-amber-900/80">
        Needs attention
      </p>
      <ul className="space-y-1.5">
        {shown.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              className="flex items-start gap-2 text-base font-semibold underline-offset-2 hover:underline"
            >
              {item.icon === "out" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-injury-out" />}
              {item.icon === "bye" && <CalendarOff className="mt-0.5 h-4 w-4 shrink-0" />}
              {item.icon === "empty" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              {item.icon === "trade" && <Handshake className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
              <span>{item.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
