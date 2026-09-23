import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listTradeBlock, setTradeBlockPlayer } from "@/lib/fantasy/community";
import { rosterIds, type FantasyTeam } from "@/lib/fantasy/league";
import type { SlimPlayer } from "@/lib/sleeper.functions";

export function TradeBlockManager({ team, teamSlot, byId }: {
  team: FantasyTeam;
  teamSlot: number;
  byId: Map<string, SlimPlayer>;
}) {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["trade-block"], queryFn: listTradeBlock });
  const listed = new Set(data.filter((row) => row.team_slot === teamSlot).map((row) => row.player_id));
  const toggle = async (playerId: string) => {
    try {
      await setTradeBlockPlayer({ teamSlot, playerId, listed: !listed.has(playerId) });
      await queryClient.invalidateQueries({ queryKey: ["trade-block"] });
      toast.success(listed.has(playerId) ? "Removed from trade block" : "Added to trade block");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the trade block.");
    }
  };
  return (
    <section className="mb-5 border-y bg-card py-4 sm:rounded-lg sm:border sm:px-4">
      <div className="mb-3 flex items-center gap-2">
        <Handshake className="h-5 w-5 text-primary" />
        <h2 className="font-display text-xl font-bold">My trade block</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {rosterIds(team).map((id) => {
          const player = byId.get(id);
          if (!player) return null;
          const on = listed.has(id);
          return <Button key={id} size="sm" variant={on ? "default" : "outline"} onClick={() => void toggle(id)}>{player.name}{on ? " · Available" : ""}</Button>;
        })}
      </div>
    </section>
  );
}