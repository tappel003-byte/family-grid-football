import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppShell, LoadingScreen, PageTitle } from "@/components/fantasy/AppShell";
import { PlayoffPicture } from "@/components/fantasy/PlayoffPicture";
import { playersQueryOptions, useLeague, useWeeksData } from "@/lib/fantasy/hooks";

export const Route = createFileRoute("/playoffs")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Playoff Bracket — La Familia 2026" },
      {
        name: "description",
        content:
          "The four-team La Familia playoff bracket: semifinals in week 16 and the championship in week 17.",
      },
      { property: "og:title", content: "Playoff Bracket — La Familia 2026" },
      {
        property: "og:description",
        content:
          "The four-team La Familia playoff bracket: semifinals in week 16 and the championship in week 17.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <PlayoffsPage />
      </Suspense>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell>
      <p role="alert" className="text-lg">
        {error.message}
      </p>
    </AppShell>
  ),
  notFoundComponent: () => <AppShell>Nothing here.</AppShell>,
});

function PlayoffsPage() {
  const { league, byId } = useLeague();
  useWeeksData(Math.max(0, (league?.currentWeek ?? 1) - 1));
  if (!league) return <LoadingScreen label="Setting up your league…" />;

  return (
    <>
      <PageTitle title="Playoff Bracket" subtitle="This now lives at the bottom of Standings." />
      <PlayoffPicture league={league} byId={byId} showHeading={false} />
    </>
  );
}
