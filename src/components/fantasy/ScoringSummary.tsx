import type { League } from "@/lib/fantasy/league";
import type { Scoring } from "@/lib/fantasy/scoring";
import { statLineFor } from "@/lib/fantasy/hooks";
import { cn } from "@/lib/utils";

const FIELDS: Array<{ key: keyof Scoring; label: (n: number) => string }> = [
  { key: "passYd", label: (n) => `${n} pass yds` },
  { key: "passTd", label: (n) => `${n} pass TD` },
  { key: "interception", label: (n) => `${n} INT thrown` },
  { key: "rushYd", label: (n) => `${n} rush yds` },
  { key: "rushTd", label: (n) => `${n} rush TD` },
  { key: "reception", label: (n) => `${n} catches` },
  { key: "recYd", label: (n) => `${n} rec yds` },
  { key: "recTd", label: (n) => `${n} rec TD` },
  { key: "fumble", label: (n) => `${n} fumble lost` },
  { key: "twoPt", label: (n) => `${n} two-point` },
  { key: "fg0_39", label: (n) => `${n} FG 0-39` },
  { key: "fg40_49", label: (n) => `${n} FG 40-49` },
  { key: "fg50", label: (n) => `${n} FG 50+` },
  { key: "fgMiss", label: (n) => `${n} FG missed` },
  { key: "xpMade", label: (n) => `${n} extra points` },
  { key: "xpMiss", label: (n) => `${n} XP missed` },
  { key: "defSack", label: (n) => `${n} sacks` },
  { key: "defInt", label: (n) => `${n} interceptions` },
  { key: "defFumRec", label: (n) => `${n} fumble rec` },
  { key: "defSafety", label: (n) => `${n} safety` },
  { key: "defTd", label: (n) => `${n} def/ST TD` },
  { key: "defBlockKick", label: (n) => `${n} blocked kick` },
  { key: "def2ptReturn", label: (n) => `${n} def 2-pt return` },
  { key: "ptsAllow0", label: () => "Shutout" },
  { key: "ptsAllow1_6", label: () => "1-6 pts allowed" },
  { key: "ptsAllow7_13", label: () => "7-13 pts allowed" },
  { key: "ptsAllow14_20", label: () => "14-20 pts allowed" },
  { key: "ptsAllow21_27", label: () => "21-27 pts allowed" },
  { key: "ptsAllow28_34", label: () => "28-34 pts allowed" },
  { key: "ptsAllow35", label: () => "35+ pts allowed" },
];

/** Display-only breakdown of how a player's weekly points add up. */
export function ScoringSummary({ playerId, week, league }: { playerId: string; week: number; league: League }) {
  const stats = statLineFor(playerId, week);
  const rows = stats
    ? FIELDS.flatMap(({ key, label }) => {
        const n = Number(stats[key] ?? 0);
        if (!n || !league.scoring[key]) return [];
        const pts = Math.round(n * (league.scoring[key] ?? 0) * 100) / 100;
        return [{ key, text: label(Math.round(n * 10) / 10), pts }];
      })
    : [];
  return (
    <div className="mt-3 border-t pt-2">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Scoring summary
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No scoring plays yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {rows.map((r) => (
            <li key={r.key} className="flex justify-between gap-3 text-sm">
              <span>{r.text}</span>
              <span className={cn("font-semibold tabular-nums", r.pts < 0 && "text-injury-out")}>
                {r.pts > 0 ? "+" : ""}
                {r.pts.toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
