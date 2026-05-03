import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { Recommend } from "@/components/Recommend";
import { imageFor } from "@/lib/product-images";

type OrderItem = {
  product_id: string;
  product_name: string;
  product_image: string;
  quantity: number;
};

type OrderRow = {
  id: string;
  total: number | string;
  status: string;
  delivery_stage: string;
  payment_status: string;
  created_at: string;
  order_items: OrderItem[];
};

export const Route = createFileRoute("/account/your-orders")({
  head: () => ({ meta: [{ title: "Your Orders — Luxe Sparkles" }] }),
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
      .select(
        "id, total, status, delivery_stage, payment_status, created_at, order_items(product_id, product_name, product_image, quantity)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setOrders((data ?? []) as unknown as OrderRow[]);
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
            {orders.map((o) => {
              const items = o.order_items ?? [];
              const visible = items.slice(0, 4);
              const extra = items.length - visible.length;
              return (
                <Link
                  key={o.id}
                  to="/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-start gap-4 border border-border p-4 transition-smooth hover:border-primary"
                >
                  <div className="flex shrink-0 -space-x-2">
                    {visible.map((it) => (
                      <img
                        key={it.product_id}
                        src={imageFor(it.product_id, it.product_image)}
                        alt={it.product_name}
                        loading="lazy"
                        className="h-14 w-14 rounded-md border border-border bg-card object-cover"
                      />
                    ))}
                    {extra > 0 && (
                      <span className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-card text-xs text-muted-foreground">
                        +{extra}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg">#{o.id.slice(0, 8).toUpperCase()}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {items.length > 0
                        ? items.map((i) => `${i.product_name} ×${i.quantity}`).join(", ")
                        : "No items"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString()}
                    </p>
                    <p className={`mt-1 text-[11px] uppercase tracking-[0.2em] ${statusTone(o.payment_status, o.delivery_stage)}`}>
                      {statusLabel(o.payment_status, o.delivery_stage, o.status)}
                    </p>
                  </div>
                  <p className="shrink-0 text-primary">₦{Number(o.total).toFixed(2)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <Recommend />
    </>
  );
}
