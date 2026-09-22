import type { SlimPlayer } from "@/lib/sleeper.functions";
import { headshotUrl, teamLogoUrl } from "@/lib/fantasy/hooks";
import { cn } from "@/lib/utils";

const INJURY_STYLES: Record<string, string> = {
  Q: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  D: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  OUT: "bg-destructive/15 text-destructive",
  IR: "bg-destructive/15 text-destructive",
  PUP: "bg-destructive/15 text-destructive",
  SUS: "bg-destructive/15 text-destructive",
};

export function injuryTag(injury: string | null): string | null {
  if (!injury) return null;
  const i = injury.toUpperCase();
  if (i.startsWith("QUESTION")) return "Q";
  if (i.startsWith("DOUBT")) return "D";
  if (i.startsWith("OUT")) return "OUT";
  if (i.startsWith("IR")) return "IR";
  return i.slice(0, 3);
}

export function PlayerCell({
  player,
  align = "left",
  compact = false,
}: {
  player: SlimPlayer;
  align?: "left" | "right";
  compact?: boolean;
}) {
  const tag = injuryTag(player.injury);
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <div className="relative shrink-0">
        <img
          src={headshotUrl(player.id, player.pos, player.team)}
          alt=""
          loading="lazy"
          className={cn(
            "rounded-full bg-muted object-cover ring-1 ring-border",
            compact ? "h-10 w-10" : "h-12 w-12",
          )}
          onError={(e) => {
            e.currentTarget.src = teamLogoUrl(player.team);
          }}
        />
        {player.pos !== "DEF" && (
          <img
            src={teamLogoUrl(player.team)}
            alt=""
            loading="lazy"
            className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background p-[1px] ring-1 ring-border"
          />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-base font-semibold leading-tight sm:text-lg">
          {player.name}
        </div>
        <div
          className={cn(
            "mt-0.5 flex items-center gap-2 text-sm text-muted-foreground",
            align === "right" && "justify-end",
          )}
        >
          <span className="font-semibold uppercase tracking-wide">
            {player.team} · {player.pos}
          </span>
          {tag && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-bold",
                INJURY_STYLES[tag] ?? "bg-muted text-muted-foreground",
              )}
            >
              {tag}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
