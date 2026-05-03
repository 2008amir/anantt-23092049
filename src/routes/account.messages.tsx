import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/account/messages")({
  head: () => ({ meta: [{ title: "Messages — Luxe Sparkles" }] }),
  component: MessagesPage,
});

type Message = {
  id: string;
  user_id: string;
  sender: string;
  body: string;
  created_at: string;
  read_by_user: boolean;
};

function MessagesPage() {
  const { user } = useStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      setMessages((data ?? []) as Message[]);
      // Mark admin messages as read
      void supabase
        .from("messages")
        .update({ read_by_user: true })
        .eq("user_id", user.id)
        .eq("sender", "admin")
        .eq("read_by_user", false);
    };
    void load();
    const channel = supabase
      .channel(`user-messages-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  if (!user) return null;

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    await supabase.from("messages").insert({
      user_id: user.id,
      sender: "user",
      body: body.trim(),
    });
    setBody("");
    setSending(false);
  };

  return (
    <div className="flex h-[70dvh] flex-col">
      <div className="mb-4">
        <h2 className="font-serif text-3xl">Messages</h2>
        <p className="mt-2 text-sm text-muted-foreground">Chat directly with our concierge team.</p>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-border bg-card/40">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Send us a message — our team will reply here.
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    m.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  <p>{m.body}</p>
                  <p className="mt-1 text-[10px] opacity-70">
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void send(); }}
          className="flex gap-2 border-t border-border p-3"
        >
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-gold-gradient px-4 py-2 text-xs uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" /> Send
          </button>
        </form>
      </div>
    </div>
  );
}
