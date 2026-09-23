import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { AppShell, PageTitle } from "@/components/fantasy/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type Msg = { id: string; user_id: string; author_name: string; body: string; created_at: string };

export const Route = createFileRoute("/chat")({
  head: () => ({ meta: [
    { title: "League Chat — La Familia" },
    { name: "description", content: "Trash talk and banter for La Familia fantasy football." },
    { property: "og:title", content: "League Chat — La Familia" },
    { property: "og:description", content: "The La Familia trash-talk board." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <AppShell><PageTitle title="League Chat" subtitle="Talk trash. Keep it in the family." /><Chat /></AppShell>,
  errorComponent: ({ error }) => <AppShell><p role="alert">{error.message}</p></AppShell>,
  notFoundComponent: () => <AppShell>Nothing here.</AppShell>,
});

function Chat() {
  const auth = useAuth() as { user?: { id: string } | null };
  const me = auth.user?.id;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isCommish, setIsCommish] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("chat_messages").select("*").order("created_at", { ascending: false }).limit(200);
      if (alive) setMsgs((data ?? []).reverse());
    };
    void load();
    const ch = supabase.channel("league-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => void load())
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(ch); };
  }, []);

  useEffect(() => {
    if (!me) return;
    void supabase.from("user_roles").select("role").eq("user_id", me).eq("role", "commissioner").then(({ data }) => setIsCommish(!!data?.length));
  }, [me]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || !me) return;
    setBusy(true); setError("");
    const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", me).single();
    const { error: err } = await supabase.from("chat_messages").insert({ user_id: me, author_name: prof?.display_name || "Family", body });
    setBusy(false);
    if (err) setError("Couldn't send — try again.");
    else setText("");
  };

  const remove = async (id: string) => {
    setMsgs((m) => m.filter((x) => x.id !== id));
    await supabase.from("chat_messages").delete().eq("id", id);
  };

  return (
    <div className="flex h-[calc(100dvh-14rem)] min-h-96 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {msgs.length === 0 && <p className="py-10 text-center text-muted-foreground">No messages yet. Start the trash talk.</p>}
        {msgs.map((m) => {
          const mine = m.user_id === me;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                <div className="flex items-center gap-2 text-xs opacity-80">
                  <span className="font-semibold">{mine ? "You" : m.author_name}</span>
                  <span>{new Date(m.created_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
                  {(mine || isCommish) && (
                    <button aria-label="Delete message" onClick={() => void remove(m.id)} className="opacity-70 hover:opacity-100">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="px-3 text-sm text-destructive">{error}</p>}
      <form className="flex gap-2 border-t p-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder="Say something…"
          aria-label="Message"
          className="h-11 flex-1 rounded-md border bg-background px-3 text-base"
        />
        <Button type="submit" disabled={busy || !text.trim()} className="h-11" aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
