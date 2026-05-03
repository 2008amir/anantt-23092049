import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { Recommend } from "@/components/Recommend";

type OrderRow = {
  id: string;
  total: number | string;
  status: string;
  created_at: string;
  order_items: { product_image: string; product_name: string }[];
};

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "Orders — Luxe Sparkles" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const { user, loading: authLoading } = useStore();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    void supabase
      .from("orders")
      .select("id, total, status, created_at, order_items(product_image, product_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setOrders((data ?? []) as unknown as OrderRow[]);
        setLoading(false);
      });
  }, [user]);

  if (authLoading || loading) {
    return <div className="container mx-auto flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!user) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-4xl">Please sign in</h1>
        <Link to="/login" className="mt-6 inline-block text-primary underline">Sign In</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">History</p>
        <h1 className="mt-3 font-serif text-5xl">Your Orders</h1>
      </header>

      {orders.length === 0 ? (
        <div className="py-24 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No orders yet.</p>
          <Link to="/shop" className="mt-6 inline-flex bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground">Start Shopping</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link key={order.id} to="/orders/$id" params={{ id: order.id }}
              className="block border border-border bg-card/50 p-6 transition-smooth hover:border-primary">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-primary">{order.status}</p>
                  <p className="mt-2 font-serif text-2xl">#{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Placed {new Date(order.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</p>
                  <p className="mt-1 font-serif text-2xl text-gold-gradient">₦{Number(order.total).toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {order.order_items.slice(0, 4).map((it, i) => (
                  <img key={i} src={it.product_image} alt={it.product_name} className="h-14 w-14 border border-border object-cover" />
                ))}
                {order.order_items.length > 4 && (
                  <div className="flex h-14 w-14 items-center justify-center border border-border text-xs text-muted-foreground">+{order.order_items.length - 4}</div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      <Recommend />
    </div>
  );
}
