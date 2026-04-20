import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

type OrderRow = {
  id: string;
  total: number | string;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/account/orders")({
  component: AccountOrders,
});

function AccountOrders() {
  const { user } = useStore();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("orders")
      .select("id, total, status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setOrders((data ?? []) as OrderRow[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <div>
      <h2 className="font-serif text-3xl">Order History</h2>
      <p className="mt-2 text-sm text-muted-foreground">A record of every piece in your collection.</p>

      {loading ? (
        <div className="mt-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : orders.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to="/orders/$id"
              params={{ id: o.id }}
              className="flex items-center justify-between border border-border p-4 transition-smooth hover:border-primary"
            >
              <div>
                <p className="font-serif text-lg">#{o.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()} · {o.status}</p>
              </div>
              <p className="text-primary">${Number(o.total).toFixed(2)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
