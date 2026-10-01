import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPracticeReport, type PracticeStatus } from "@/lib/practice.functions";
import type { SlimPlayer } from "@/lib/sleeper.functions";
import { cn } from "@/lib/utils";

export function usePractice(player: SlimPlayer): PracticeStatus | null {
  const fetchReport = useServerFn(getPracticeReport);
  const { data } = useQuery({
    queryKey: ["practice-report"],
    queryFn: () => fetchReport(),
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
  if (!player.gsis || !data) return null;
  return data.byGsis[player.gsis] ?? null;
}

/** e.g. "RB2" — only for skill positions with a depth spot. */
export function depthLabel(player: SlimPlayer): string | null {
  if (player.pos === "K" || player.pos === "DEF") return null;
  if (!player.depth || !player.depthPos) return null;
  const pos = /WR$/.test(player.depthPos) ? "WR" : /RB$/.test(player.depthPos) ? "RB" : player.depthPos;
  if (pos !== player.pos) return null;
  return `${pos}${player.depth}`;
}

export function DepthTag({ player }: { player: SlimPlayer }) {
  const label = depthLabel(player);
  if (!label) return null;
  return (
    <span className="shrink-0 rounded border border-border px-1 text-[11px] font-bold leading-4 text-muted-foreground">
      {label}
    </span>
  );
}

export function PracticeTag({ player }: { player: SlimPlayer }) {
  const status = usePractice(player);
  if (!status) return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1 text-[11px] font-bold leading-4",
        status === "DNP"
          ? "bg-injury-out text-injury-out-foreground"
          : "bg-injury-questionable text-injury-questionable-foreground",
      )}
      title={`Practice: ${status} (latest report)`}
    >
      {status === "DNP" ? "DNP" : "LP"}
    </span>
  );
}
