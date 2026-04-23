import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { Recommend } from "@/components/Recommend";

type OrderRow = {
  id: string;
  total: number | string;
  status: string;
  delivery_stage: string;
  payment_status: string;
  created_at: string;
};

export const Route = createFileRoute("/account/your-orders")({
  head: () => ({ meta: [{ title: "Your Orders — Maison Luxe" }] }),
  component: YourOrders,
});

function statusTone(payment: string, delivery: string) {
  if (payment === "paid" && delivery === "delivered") return "text-primary";
  if (payment === "paid") return "text-emerald-500";
  if (payment === "failed") return "text-destructive";
  return "text-amber-500";
}

function statusLabel(payment: string, delivery: string, status: string) {
  if (payment === "paid" && delivery === "delivered") return "Delivered · Verified";
  if (payment === "paid") return `Verified · ${status}`;
  if (payment === "failed") return "Payment Failed";
  return "Pending Payment";
}

function YourOrders() {
  const { user } = useStore();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("orders")
      .select("id, total, status, delivery_stage, payment_status, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setOrders((data ?? []) as OrderRow[]);
        setLoading(false);
      });
  }, [user]);

  return (
    <>
      <div>
        <h2 className="font-serif text-3xl">Your Orders</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Every order you have placed — verified and pending — with their current status.
        </p>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-3 text-center text-muted-foreground">
            <Package className="h-10 w-10" strokeWidth={1.25} />
            <p>You have not placed any orders yet.</p>
          </div>
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
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString()}
                  </p>
                  <p className={`mt-1 text-[11px] uppercase tracking-[0.2em] ${statusTone(o.payment_status, o.delivery_stage)}`}>
                    {statusLabel(o.payment_status, o.delivery_stage, o.status)}
                  </p>
                </div>
                <p className="text-primary">${Number(o.total).toFixed(2)}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Recommend />
    </>
  );
}
