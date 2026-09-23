import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageTitle } from "@/components/fantasy/AppShell";
import { ActivityFeed } from "@/components/fantasy/ActivityFeed";

export const Route = createFileRoute("/activity")({
  head: () => ({ meta: [
    { title: "League Activity — La Familia" },
    { name: "description", content: "Adds, drops, waivers, trades and lineup changes across La Familia." },
    { property: "og:title", content: "League Activity — La Familia" },
    { property: "og:description", content: "Recent league moves across La Familia." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <AppShell><PageTitle title="League Activity" subtitle="The latest moves from every team" /><div className="overflow-hidden rounded-lg border bg-card"><ActivityFeed /></div></AppShell>,
  errorComponent: ({ error }) => <AppShell><p role="alert">{error.message}</p></AppShell>,
  notFoundComponent: () => <AppShell>Nothing here.</AppShell>,
});