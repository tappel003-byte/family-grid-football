import { createFileRoute } from "@tanstack/react-router";

/** Called every Tuesday morning: advances the week and archives final scores. Secured by a private token. */
export const Route = createFileRoute("/api/public/roll-week")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await (supabaseAdmin as any)
          .from("waiver_run_token")
          .select("token")
          .limit(1)
          .maybeSingle();
        const { createHash, timingSafeEqual } = await import("node:crypto");
        const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
        if (!data?.token || !timingSafeEqual(digest(token), digest(data.token))) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { rollWeek } = await import("@/lib/fantasy/results.server");
        try {
          return Response.json(await rollWeek(supabaseAdmin));
        } catch (err) {
          return Response.json({ error: err instanceof Error ? err.message : "failed" });
        }
      },
    },
  },
});
