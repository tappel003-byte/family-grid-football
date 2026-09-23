import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { AppShell, LoadingScreen } from "@/components/fantasy/AppShell";
import { StartSit } from "@/components/fantasy/StartSit";
import { playersQueryOptions } from "@/lib/fantasy/hooks";

export const Route = createFileRoute("/start-sit")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQueryOptions),
  head: () => ({
    meta: [
      { title: "Start 'Em, Sit 'Em — La Familia Fantasy Football" },
      {
        name: "description",
        content:
          "Compare two players head-to-head and get a plain-English start or sit recommendation.",
      },
      { property: "og:title", content: "Start 'Em, Sit 'Em — La Familia Fantasy Football" },
      {
        property: "og:description",
        content:
          "Compare two players head-to-head and get a plain-English start or sit recommendation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <AppShell>
      <Suspense fallback={<LoadingScreen />}>
        <StartSit />
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
  notFoundComponent: () => (
    <AppShell>
      <p className="text-lg">
        That page doesn't exist. Head back to{" "}
        <Link to="/" className="font-semibold text-primary underline-offset-4 hover:underline">
          matchups
        </Link>
        .
      </p>
    </AppShell>
  ),
});
