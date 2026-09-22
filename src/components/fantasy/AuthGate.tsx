import { useState, type ReactNode } from "react";
import { Trophy, Shield, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useSession } from "@/lib/auth";
import { claimTeam, listClaimTeams } from "@/lib/fantasy/claim.functions";
import { teamLogo } from "@/lib/fantasy/logos";


function ClaimScreen() {
  const [slot, setSlot] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["claim-teams"],
    queryFn: () => listClaimTeams(),
  });

  const teams = data?.teams ?? [];
  const picked = teams.find((t) => t.slot === slot) ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slot === null) return;
    setBusy(true);
    try {
      const res = await claimTeam({ data: { slot, password, displayName: name } });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: res.email,
        password,
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not get you in");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {data?.leagueName ?? "La Familia"}
            </h1>
            <p className="text-base text-muted-foreground">Claim your team</p>
          </div>
        </div>

        <p className="mt-6 text-lg leading-snug">
          Tap your team below, then type the family password.
        </p>

        {isLoading ? (
          <p className="mt-6 text-lg text-muted-foreground">Loading teams…</p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {teams.map((t) => {
              const active = t.slot === slot;
              return (
                <button
                  key={t.slot}
                  type="button"
                  onClick={() => setSlot(t.slot)}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                    active ? "border-primary ring-2 ring-primary" : "hover:bg-accent"
                  }`}
                >
                  {teamLogo(t.name, t.slot) ? (
                    <img
                      src={teamLogo(t.name, t.slot)}
                      alt={`${t.name} logo`}
                      className="h-14 w-14 shrink-0 object-contain"
                    />
                  ) : (
                    <span
                      className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-primary-foreground"
                      style={{ backgroundColor: t.color }}
                    >
                      <Shield className="h-6 w-6" />
                    </span>
                  )}

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold">{t.name}</span>
                    <span className="block truncate text-base text-muted-foreground">
                      {t.owner || "Unclaimed"}
                    </span>
                  </span>
                  {active && <Check className="h-6 w-6 text-primary" />}
                </button>
              );
            })}
          </div>
        )}

        {picked && (
          <form
            onSubmit={submit}
            className="mt-8 grid gap-4 rounded-2xl border bg-card p-6 shadow-sm"
          >
            <p className="text-lg font-semibold">
              You picked <span style={{ color: picked.color }}>{picked.name}</span>
            </p>
            <div>
              <Label htmlFor="name" className="text-base">
                Your name
              </Label>
              <Input
                id="name"
                className="mt-1 h-12 text-base"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={picked.owner || "Your name"}
              />
            </div>
            <div>
              <Label htmlFor="family-password" className="text-base">
                Family password
              </Label>
              <Input
                id="family-password"
                type="password"
                autoComplete="current-password"
                className="mt-1 h-12 text-base"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy} className="h-12 text-base font-semibold">
              {busy ? "Getting you in…" : "This is my team"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Keeps the league private: everything inside is family-only. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-lg text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!session) return <ClaimScreen />;
  return <>{children}</>;
}

/** Only commissioners see the contents; everyone else gets a friendly note. */
export function CommissionerOnly({ children }: { children: ReactNode }) {
  const { isCommissioner, loading } = useAuth();
  if (loading) return <div className="py-10 text-lg text-muted-foreground">Loading…</div>;
  if (!isCommissioner) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-lg">
        <p className="font-display text-2xl font-bold">Commissioner only</p>
        <p className="mt-2 text-muted-foreground">
          Ask the commissioner to make this change for you.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
