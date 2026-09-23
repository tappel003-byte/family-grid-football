import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Handshake } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listTradeBlock } from "@/lib/fantasy/community";
import { updateTradeBlock } from "@/lib/fantasy/community.functions";
import { cn } from "@/lib/utils";

export function useTradeBlock() {
  return useQuery({ queryKey: ["trade-block"], queryFn: listTradeBlock });
}

/** Player ids this team has marked as available to trade. */
export function useTeamTradeBlock(teamSlot: number) {
  const { data = [] } = useTradeBlock();
  return new Set(data.filter((row) => row.team_slot === teamSlot).map((row) => row.player_id));
}

/** Read-only badge shown next to a player another family already offered up. */
export function TradeAvailableBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-primary",
        className,
      )}
    >
      <Handshake className="h-3.5 w-3.5" /> Available
    </span>
  );
}

/** Owner-only checkbox: tick it and this player shows as available under Teams. */
export function TradeFlagToggle({
  teamSlot,
  playerId,
  playerName,
  listed,
}: {
  teamSlot: number;
  playerId: string;
  playerName: string;
  listed: boolean;
}) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateTradeBlock);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      await update({ data: { teamSlot, playerId, playerName, listed: !listed } });
      await queryClient.invalidateQueries({ queryKey: ["trade-block"] });
      await queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success(
        listed ? `${playerName} is no longer up for trade` : `${playerName} is up for trade`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={listed}
      aria-label={`Willing to trade ${playerName}`}
      disabled={busy}
      onClick={() => void toggle()}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-semibold transition-colors disabled:opacity-60",
        listed
          ? "border-primary bg-primary/10 text-primary"
          : "border-input bg-background text-muted-foreground hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-[3px] border",
          listed ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60",
        )}
        aria-hidden
      >
        {listed && (
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M3 8.5 6.5 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      Trade
    </button>
  );
}
