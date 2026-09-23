import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Standing = { place: number; team: string; owner: string; record?: string };

export function TrophyCase({ owner }: { owner: string }) {
  const { data = [] } = useQuery({
    queryKey: ["trophy-case", owner],
    enabled: Boolean(owner),
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("season_history").select("season, champion, champion_owner, runner_up, runner_up_owner, standings").order("season", { ascending: false });
      if (error) throw new Error(error.message);
      return (rows ?? []).flatMap((row) => {
        if (row.champion_owner === owner) return [{ season: row.season, place: 1, label: "Champion", team: row.champion }];
        if (row.runner_up_owner === owner) return [{ season: row.season, place: 2, label: "Runner-up", team: row.runner_up }];
        const standing = ((row.standings as Standing[]) ?? []).find((s) => s.owner === owner && s.place <= 3);
        return standing ? [{ season: row.season, place: standing.place, label: `${standing.place}${standing.place === 3 ? "rd" : "th"} place`, team: standing.team }] : [];
      });
    },
  });
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /><h2 className="font-display text-xl font-bold">Trophy case</h2></div>
      {data.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{data.map((item) => <li key={`${item.season}-${item.place}`} className="rounded-md bg-secondary px-3 py-2"><strong>{item.season} {item.label}</strong><span className="block text-sm text-muted-foreground">{item.team}</span></li>)}</ul> : <p className="mt-2 text-muted-foreground">No top-three finishes recorded yet.</p>}
    </section>
  );
}