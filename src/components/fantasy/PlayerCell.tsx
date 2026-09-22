import type { SlimPlayer } from "@/lib/sleeper.functions";
import { headshotUrl, teamLogoUrl } from "@/lib/fantasy/hooks";
import { cn } from "@/lib/utils";

export type InjurySeverity = "out" | "doubtful" | "questionable";

export type InjuryInfo = {
  tag: string;
  label: string;
  severity: InjurySeverity;
};

const SEVERITY_CLASS: Record<InjurySeverity, string> = {
  out: "bg-injury-out text-injury-out-foreground ring-injury-out/40",
  doubtful: "bg-injury-doubtful text-injury-doubtful-foreground ring-injury-doubtful/40",
  questionable:
    "bg-injury-questionable text-injury-questionable-foreground ring-injury-questionable/50",
};

/** Turns a raw Sleeper injury string into a tag, a plain-English label and a severity. */
export function injuryInfo(injury: string | null): InjuryInfo | null {
  if (!injury) return null;
  const i = injury.toUpperCase();
  if (i.startsWith("QUESTION")) return { tag: "Q", label: "Questionable", severity: "questionable" };
  if (i.startsWith("DOUBT")) return { tag: "D", label: "Doubtful", severity: "doubtful" };
  if (i.startsWith("OUT")) return { tag: "OUT", label: "Out", severity: "out" };
  if (i.startsWith("IR")) return { tag: "IR", label: "Injured reserve", severity: "out" };
  if (i.startsWith("PUP")) return { tag: "PUP", label: "Physically unable", severity: "out" };
  if (i.startsWith("SUS")) return { tag: "SUS", label: "Suspended", severity: "out" };
  if (i.startsWith("DNR") || i.startsWith("NA")) return { tag: i.slice(0, 3), label: "Not active", severity: "out" };
  return { tag: i.slice(0, 3), label: injury, severity: "questionable" };
}

export function injuryTag(injury: string | null): string | null {
  return injuryInfo(injury)?.tag ?? null;
}

/** True when the player will not play (OUT, IR, PUP, suspended). */
export function isInactive(injury: string | null): boolean {
  return injuryInfo(injury)?.severity === "out";
}

export function InjuryBadge({
  injury,
  size = "md",
  withLabel = false,
}: {
  injury: string | null;
  size?: "sm" | "md";
  withLabel?: boolean;
}) {
  const info = injuryInfo(injury);
  if (!info) return null;
  return (
    <span
      title={info.label}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md font-display font-bold uppercase tracking-wider ring-2",
        SEVERITY_CLASS[info.severity],
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-sm",
        info.severity === "out" && "animate-pulse",
      )}
    >
      {info.tag}
      {withLabel && <span className="hidden font-sans font-semibold normal-case sm:inline">{info.label}</span>}
    </span>
  );
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
  const info = injuryInfo(player.injury);
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
            info?.severity === "out" && "opacity-70 ring-2 ring-injury-out",
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
        <div
          className={cn(
            "flex min-w-0 items-center gap-2",
            align === "right" && "flex-row-reverse",
          )}
        >
          <span className="truncate text-base font-semibold leading-tight sm:text-lg">
            {player.name}
          </span>
          <InjuryBadge injury={player.injury} size={compact ? "sm" : "md"} />
        </div>
        <div
          className={cn(
            "mt-0.5 flex items-center gap-2 text-sm",
            align === "right" && "justify-end",
          )}
        >
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            {player.team} · {player.pos}
          </span>
          {info && (
            <span
              className={cn(
                "font-semibold",
                info.severity === "out" ? "text-injury-out" : "text-muted-foreground",
              )}
            >
              {info.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
