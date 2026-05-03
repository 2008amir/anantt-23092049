import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account/notifications")({
  component: Notifications,
});

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  image: string | null;
  read: boolean;
  created_at: string;
};

function Notifications() {
  const { user } = useStore();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        const rows = (data ?? []) as NotificationRow[];
        setItems(rows);
        // Mark everything we just viewed as read (one call).
        const unreadIds = rows.filter((r) => !r.read).map((r) => r.id);
        if (unreadIds.length > 0) {
          void supabase.from("notifications").update({ read: true }).in("id", unreadIds);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div>
      <h2 className="font-serif text-3xl">Notifications</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Posts and order updates from Luxe Sparkles.
      </p>

      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border border-dashed border-border bg-card/30 px-6 py-20 text-center">
            <Bell className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n) => (
              <article
                key={n.id}
                className="flex gap-4 border border-border bg-card/50 p-4"
              >
                {n.image && (
                  <img
                    src={n.image}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {n.kind === "order" && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                        Order
                      </span>
                    )}
                    <p className="truncate font-serif text-base text-foreground">
                      {n.title}
                    </p>
                  </div>
                  {n.body && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {n.body}
                    </p>
                  )}
                  <p className="mt-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
