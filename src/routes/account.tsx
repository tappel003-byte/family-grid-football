import { teamLogo } from "@/lib/fantasy/logos";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyAccount, saveMyAccount } from "@/lib/fantasy/account.functions";
import { cn } from "@/lib/utils";
import { TrophyCase } from "@/components/fantasy/TrophyCase";

const TIME_ZONES = [
  ["America/Los_Angeles", "Pacific Time"],
  ["America/Denver", "Mountain Time"],
  ["America/Chicago", "Central Time"],
  ["America/New_York", "Eastern Time"],
] as const;

const COLORS = [
  "#1d4ed8",
  "#0ea5e9",
  "#059669",
  "#65a30d",
  "#d97706",
  "#dc2626",
  "#be123c",
  "#7c3aed",
  "#0f172a",
  "#475569",
];

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — La Familia Fantasy Football" },
      {
        name: "description",
        content: "Change your name, team, colour and preferred game-time zone in the family league.",
      },
      { property: "og:title", content: "My Account — La Familia Fantasy Football" },
      {
        property: "og:description",
        content: "Change your name, team, colour and preferred game-time zone in the family league.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <AccountPage />
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="text-lg">
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell>Page not found.</AppShell>,
});

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("") || "?"
  );
}

function AccountPage() {
  const fetchAccount = useServerFn(getMyAccount);
  const save = useServerFn(saveMyAccount);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["my-account"],
    queryFn: () => fetchAccount(),
  });

  const [name, setName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [timeZone, setTimeZone] = useState("America/Denver");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setName(data.displayName);
    setTeamName(data.team?.name ?? "");
    setColor(data.team?.color ?? COLORS[0]);
    setTimeZone(data.timeZone);
  }, [data]);

  if (isLoading || !data) return <LoadingScreen label="Loading your account…" />;

  async function onSave() {
    setSaving(true);
    try {
      await save({ data: { displayName: name, teamName, color: color ?? COLORS[0]!, timeZone } });
      await queryClient.invalidateQueries();
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save your changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageTitle title="My Account" />

      <div className="grid max-w-2xl gap-6">
        <section className="rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-4">
            {teamLogo(teamName) ? (
              <img
                src={teamLogo(teamName)}
                alt={`${teamName} logo`}
                className="h-20 w-20 shrink-0 object-contain"
              />
            ) : (
              <div
                className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl font-display text-2xl font-bold text-white"
                style={{ backgroundColor: color }}
              >
                {initialsOf(teamName || name)}
              </div>
            )}

            <div className="min-w-0">
              <p className="truncate font-display text-xl font-bold">{teamName || name}</p>
              <p className="truncate text-muted-foreground">{data.email}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="acct-name">Your name</Label>
              <Input id="acct-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="acct-time-zone">Preferred time zone</Label>
              <select
                id="acct-time-zone"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-base"
              >
                {TIME_ZONES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <p className="text-sm text-muted-foreground">NFL kickoff times will use this time zone.</p>
            </div>

            {data.team ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="acct-team">Team name</Label>
                  <Input
                    id="acct-team"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Team colour</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Use colour ${c}`}
                        onClick={() => setColor(c)}
                        className={cn(
                          "h-10 w-10 rounded-xl border-2 transition-transform",
                          color === c ? "scale-110 border-foreground" : "border-transparent",
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                You don't have a team linked yet. Sign out and claim your helmet, or ask the
                commissioner.
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={() => void onSave()} disabled={saving} className="font-semibold">
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {data.team && (
                <Link
                  to="/my-team"
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Go to my team
                </Link>
              )}
            </div>
          </div>
        </section>
        <TrophyCase owner={data.displayName} />
      </div>
    </>
  );
}
