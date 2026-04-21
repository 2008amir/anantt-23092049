import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  user_id: string;
  sender: string;
  body: string;
  created_at: string;
  read_by_user: boolean;
};

export function ContactWidget() {
  const { user } = useStore();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      const list = (data ?? []) as Message[];
      setMessages(list);
      setUnread(list.filter((m) => m.sender === "admin" && !m.read_by_user).length);
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
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      // Mark admin messages as read
      if (user && unread > 0) {
        void supabase
          .from("messages")
          .update({ read_by_user: true })
          .eq("user_id", user.id)
          .eq("sender", "admin")
          .eq("read_by_user", false);
        setUnread(0);
      }
    }
  }, [open, messages, user, unread]);

  if (!user) return null;

  const send = async () => {
    if (!body.trim()) return;
    await supabase.from("messages").insert({
      user_id: user.id,
      sender: "user",
      body: body.trim(),
    });
    setBody("");
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gold-gradient text-primary-foreground shadow-lg transition-transform hover:scale-105",
          open && "hidden",
        )}
        aria-label="Contact us"
      >
        <MessageCircle className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[480px] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-lg border border-border/40 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/40 bg-gold-gradient px-4 py-3 text-primary-foreground">
            <div>
              <p className="font-serif text-base">Maison Luxe</p>
              <p className="text-[10px] opacity-90">Typically replies within an hour</p>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-80 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground">
                Send us a message — our team will get back to you here.
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      m.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {m.body}
                  </div>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="flex gap-2 border-t border-border/40 p-3"
          >
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 rounded-md border border-border/40 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={!body.trim()}
              className="rounded-md bg-primary px-3 text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
