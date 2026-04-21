import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Send, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin/messages")({
  component: MessagesPage,
});

type Message = {
  id: string;
  user_id: string;
  sender: string;
  body: string;
  created_at: string;
  read_by_admin: boolean;
};

type Profile = { id: string; display_name: string | null; email: string | null };

type Conversation = {
  user: Profile;
  lastMessage: Message;
  unread: number;
};

function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadConversations = async () => {
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    const list = (msgs ?? []) as Message[];

    const byUser = new Map<string, { last: Message; unread: number }>();
    for (const m of list) {
      const cur = byUser.get(m.user_id);
      if (!cur) {
        byUser.set(m.user_id, {
          last: m,
          unread: m.sender === "user" && !m.read_by_admin ? 1 : 0,
        });
      } else {
        if (m.sender === "user" && !m.read_by_admin) cur.unread += 1;
      }
    }

    const userIds = Array.from(byUser.keys());
    const profRes = userIds.length
      ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds)
      : { data: [] as Profile[] };
    const profMap = new Map<string, Profile>();
    (profRes.data ?? []).forEach((p) => profMap.set(p.id, p as Profile));

    const convs: Conversation[] = userIds
      .map((uid) => ({
        user: profMap.get(uid) ?? { id: uid, display_name: null, email: null },
        lastMessage: byUser.get(uid)!.last,
        unread: byUser.get(uid)!.unread,
      }))
      .sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());

    setConversations(convs);
    setLoading(false);
  };

  const loadThread = async (uid: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    setThread((data ?? []) as Message[]);
    // Mark as read
    await supabase
      .from("messages")
      .update({ read_by_admin: true })
      .eq("user_id", uid)
      .eq("sender", "user")
      .eq("read_by_admin", false);
  };

  useEffect(() => {
    void loadConversations();
    const channel = supabase
      .channel("admin-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        void loadConversations();
        if (activeUserId) void loadThread(activeUserId);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId]);

  useEffect(() => {
    if (activeUserId) void loadThread(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread]);

  const send = async () => {
    if (!body.trim() || !activeUserId) return;
    setSending(true);
    await supabase.from("messages").insert({
      user_id: activeUserId,
      sender: "admin",
      body: body.trim(),
      read_by_admin: true,
    });
    setBody("");
    setSending(false);
  };

  const active = conversations.find((c) => c.user.id === activeUserId);

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col">
      <div className="mb-4">
        <h1 className="font-serif text-3xl">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">Chat with your customers in real time.</p>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden md:grid-cols-[320px_1fr]">
        {/* Conversations */}
        <div className="overflow-y-auto rounded-lg border border-border/40 bg-card">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No messages yet.</p>
            </div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.user.id}
                onClick={() => setActiveUserId(c.user.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left last:border-0 hover:bg-muted/50",
                  activeUserId === c.user.id && "bg-muted/50",
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  {(c.user.display_name ?? c.user.email ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{c.user.display_name ?? c.user.email ?? "Customer"}</p>
                    {c.unread > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">{c.unread}</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.lastMessage.sender === "admin" ? "You: " : ""}
                    {c.lastMessage.body}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Thread */}
        <div className="flex flex-col overflow-hidden rounded-lg border border-border/40 bg-card">
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a conversation
            </div>
          ) : (
            <>
              <div className="border-b border-border/40 px-5 py-3">
                <p className="font-medium">{active.user.display_name ?? active.user.email}</p>
                <p className="text-xs text-muted-foreground">{active.user.email}</p>
              </div>
              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
                {thread.map((m) => (
                  <div key={m.id} className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                        m.sender === "admin"
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
                ))}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); void send(); }}
                className="flex gap-2 border-t border-border/40 p-3"
              >
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your reply…"
                  className="flex-1 rounded-md border border-border/40 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !body.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" /> Send
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
