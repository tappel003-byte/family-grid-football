import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/nfl-schedule")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const week = Math.min(18, Math.max(1, Math.round(Number(url.searchParams.get("week")) || 1)));
        const season = Math.min(2100, Math.max(2000, Math.round(Number(url.searchParams.get("season")) || new Date().getUTCFullYear())));
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${season}`,
          { headers: { Accept: "application/json" } },
        );

        if (!response.ok) {
          return Response.json({ events: [] }, { status: 502 });
        }

        return new Response(await response.text(), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60, stale-while-revalidate=120",
          },
        });
      },
    },
  },
});