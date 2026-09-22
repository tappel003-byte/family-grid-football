import { useState, type ReactNode } from "react";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useSession } from "@/lib/auth";

function SignInScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Welcome to the league!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Trophy className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">La Familia</h1>
            <p className="text-base text-muted-foreground">Family fantasy football</p>
          </div>
        </div>

        <p className="mt-6 text-lg leading-snug">
          This league is private. Sign in to see your team.
        </p>

        <Button onClick={google} variant="outline" className="mt-5 h-12 w-full text-base font-semibold">
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="grid gap-4">
          {mode === "up" && (
            <div>
              <Label htmlFor="name" className="text-base">Your name</Label>
              <Input
                id="name"
                className="mt-1 h-12 text-base"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Papa Ray"
                required
              />
            </div>
          )}
          <div>
            <Label htmlFor="email" className="text-base">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className="mt-1 h-12 text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-base">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "up" ? "new-password" : "current-password"}
              className="mt-1 h-12 text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="h-12 text-base font-semibold">
            {mode === "up" ? "Create my account" : "Sign in"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-5 w-full text-base font-semibold text-primary underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
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
