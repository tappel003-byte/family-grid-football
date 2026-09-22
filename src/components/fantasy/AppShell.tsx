import { Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Matchups" },
  { to: "/standings", label: "Standings" },
  { to: "/teams", label: "Teams" },
  { to: "/players", label: "Players" },
  { to: "/history", label: "History" },
  { to: "/import", label: "Import" },
  { to: "/settings", label: "Commissioner" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
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
            {NAV.map((item) => (
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
