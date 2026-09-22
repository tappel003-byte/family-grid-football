import { Link } from "@tanstack/react-router";
import { LogOut, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { AuthGate } from "./AuthGate";
import { signOut, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Matchups", commissionerOnly: false },
  { to: "/my-team", label: "My Team", commissionerOnly: false },
  { to: "/standings", label: "Standings", commissionerOnly: false },
  { to: "/teams", label: "Teams", commissionerOnly: false },
  { to: "/players", label: "Players", commissionerOnly: false },
  { to: "/history", label: "History", commissionerOnly: false },
  { to: "/import", label: "Import", commissionerOnly: true },
  { to: "/settings", label: "Commissioner", commissionerOnly: true },
] as const;

function Shell({ children }: { children: ReactNode }) {
  const { isCommissioner, displayName } = useAuth();
  const nav = NAV.filter((item) => !item.commissionerOnly || isCommissioner);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </span>
            <span className="truncate font-display text-xl font-bold tracking-tight sm:text-2xl">
              Family Football
            </span>
          </Link>
          <nav className="col-span-2 flex flex-wrap items-center gap-1 sm:gap-2">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-lg px-3 py-2 text-base font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
            <span className="ml-auto flex items-center gap-2 sm:ml-2">
              {displayName && (
                <span className="hidden max-w-[10rem] truncate text-base font-semibold text-muted-foreground sm:inline">
                  {displayName}
                  {isCommissioner ? " · Commissioner" : ""}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void signOut()}
                className="font-semibold"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:py-8">{children}</main>
      <footer className="mx-auto max-w-[1400px] px-4 pb-10 pt-4 text-sm text-muted-foreground">
        Private family league · Player data from the free Sleeper NFL API
      </footer>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <Shell>{children}</Shell>
    </AuthGate>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-1 text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
    </div>
  );
}

export function LoadingScreen({ label = "Loading NFL players…" }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center text-lg text-muted-foreground">
      {label}
    </div>
  );
}
