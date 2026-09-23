import { useEffect, useState, type ReactNode } from "react";
import { Trophy, Shield, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDeviceTeam, setDeviceTeam, setKeepSignedIn, useAuth, useSession, type DeviceTeam } from "@/lib/auth";
import { claimTeam, listClaimTeams, resumeDevice } from "@/lib/fantasy/claim.functions";
import { teamLogo } from "@/lib/fantasy/logos";


function ClaimScreen() {
  const [slot, setSlot] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const remember = true;
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
      const { data: signedIn, error } = await supabase.auth.signInWithPassword({
        email: res.email,
        password,
      });
      if (error) throw error;
      setKeepSignedIn(remember, signedIn.session);
      if (signedIn.user && picked) {
        setDeviceTeam({
          slot: picked.slot,
          userId: signedIn.user.id,
          name: name.trim() || picked.owner || picked.name,
          teamName: picked.name,
        });
      }
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

function SignInScreen() {
  const [device, setDevice] = useState<DeviceTeam | null>(() => getDeviceTeam());
  if (device) return <WelcomeBack device={device} onForget={() => setDevice(null)} />;
  return <ClaimScreen />;
}

function WelcomeBack({ device, onForget }: { device: DeviceTeam; onForget: () => void }) {
  const [busy, setBusy] = useState(false);
  const logo = teamLogo(device.teamName);
  const go = async () => {
    setBusy(true);
    try {
      const res = await resumeDevice({ data: { slot: device.slot, userId: device.userId } });
      if (!res.ok) {
        toast.error("Please pick your team again.");
        setDeviceTeam(null);
        onForget();
        return;
      }
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: res.tokenHash, type: "magiclink" });
      if (error) throw error;
      setKeepSignedIn(true, data.session);
    } catch {
      toast.error("Could not get you in. Please pick your team again.");
      onForget();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        {logo && <img src={logo} alt="" className="mx-auto h-28 w-28 object-contain" />}
        <h1 className="mt-4 font-display text-3xl font-bold">Welcome back, {device.name}</h1>
        <p className="mt-1 text-lg text-muted-foreground">{device.teamName}</p>
        <Button onClick={go} disabled={busy} className="mt-8 h-16 w-full text-xl font-semibold">
          {busy ? "Getting you in…" : "Tap to continue"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setDeviceTeam(null);
            onForget();
          }}
          className="mt-6 text-base text-muted-foreground underline"
        >
          Not you? Pick a different team
        </button>
      </div>
    </div>
  );
}

/** Keeps the league private: everything inside is family-only. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();

  // Remember this device's team for people who signed in before this existed.
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid || getDeviceTeam()?.userId === uid) return;
    void supabase
      .from("teams")
      .select("slot, name, owner")
      .eq("user_id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setDeviceTeam({ slot: data.slot, userId: uid, name: data.owner || data.name, teamName: data.name });
      });
  }, [session?.user.id]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-lg text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!session) return <SignInScreen />;
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
