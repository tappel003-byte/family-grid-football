import { useQuery } from "@tanstack/react-query";
import { Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Standing = { place: number; team: string; owner: string; record?: string };

const ordinal = (place: number) => (place === 1 ? "Champion" : place === 2 ? "Runner-up" : place === 3 ? "3rd place" : `${place}th place`);

export function TrophyCase({ owner, teamName }: { owner: string; teamName?: string }) {
  const { data = [] } = useQuery({
    queryKey: ["trophy-case", owner, teamName],
    enabled: Boolean(owner || teamName),
    queryFn: async () => {
      const [{ data: teams }, { data: rows, error }] = await Promise.all([
        supabase.from("teams").select("name, owner"),
        supabase.from("season_history").select("season, champion, champion_owner, runner_up, runner_up_owner, standings").order("season", { ascending: false }),
      ]);
      if (error) throw new Error(error.message);
      const norm = (value?: string | null) => (value ?? "").trim().toLowerCase();
      const me = norm(owner);
      const myTeams = new Set((teams ?? []).filter((t) => norm(t.owner) === me).map((t) => norm(t.name)));
      if (teamName) myTeams.add(norm(teamName));
      const mine = (team?: string | null, teamOwner?: string | null) => (teamOwner ? norm(teamOwner) === me : false) || myTeams.has(norm(team));
      return (rows ?? []).flatMap((row) => {
        const standing = ((row.standings as Standing[]) ?? []).find((s) => mine(s.team, s.owner) && s.place <= 3);
        if (standing) return [{ season: row.season, place: standing.place, label: ordinal(standing.place), team: standing.team }];
        if (mine(row.champion, row.champion_owner)) return [{ season: row.season, place: 1, label: "Champion", team: row.champion }];
        if (mine(row.runner_up, row.runner_up_owner)) return [{ season: row.season, place: 2, label: "Runner-up", team: row.runner_up }];
        return [];
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