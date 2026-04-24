import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Truck, CheckCircle2, ChevronRight, PackageCheck } from "lucide-react";

export const Route = createFileRoute("/admin/orders")({
  component: OrdersPage,
});

type OrderItem = { product_id: string; product_name: string; product_image: string; quantity: number };

type Order = {
  id: string;
  user_id: string;
  total: number;
  status: string;
  payment_status: string;
  delivery_stage: string;
  deliverer_id: string | null;
  shipping_address: { first_name?: string; last_name?: string; state?: string; city?: string } | null;
  created_at: string;
  order_items: OrderItem[];
};

type Deliverer = { id: string; name: string; phone: string; state: string; city: string | null };

type Profile = { id: string; display_name: string | null; email: string | null };

function OrdersPage() {
  const [tab, setTab] = useState<"current" | "ongoing" | "delivered">("current");
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [deliverers, setDeliverers] = useState<Deliverer[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const [ordersRes, delRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, order_items(product_id, product_name, product_image, quantity)")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false }),
      supabase.from("deliverers").select("*").eq("active", true),
    ]);
    const ordersList = (ordersRes.data ?? []) as unknown as Order[];
    const userIds = Array.from(new Set(ordersList.map((o) => o.user_id)));
    const profRes = userIds.length
      ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds)
      : { data: [] as Profile[] };
    const profMap: Record<string, Profile> = {};
    (profRes.data ?? []).forEach((p) => {
      profMap[p.id] = p as Profile;
    });
    setOrders(ordersList);
    setProfiles(profMap);
    setDeliverers((delRes.data ?? []) as Deliverer[]);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
    // realtime: refresh on any order change
    const ch = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        void reload();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, []);

  const current = orders.filter((o) => o.delivery_stage === "pending" || o.delivery_stage === "");
  const ongoing = orders.filter((o) => o.delivery_stage === "assigned" || o.delivery_stage === "in_transit");
  const delivered = orders.filter((o) => o.delivery_stage === "delivered");

  const assign = async (orderId: string, delivererId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ deliverer_id: delivererId, delivery_stage: "assigned", status: "Assigned" })
      .eq("id", orderId);
    if (error) {
      toast.error("Could not assign deliverer", { description: error.message });
      return;
    }
    const d = deliverers.find((x) => x.id === delivererId);
    toast.success(`Assigned to ${d?.name ?? "deliverer"}`, {
      description: "Order moved to Ongoing Delivery.",
    });
    setAssigning(null);
    setTab("ongoing");
    void reload();
  };

  const markDelivered = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ delivery_stage: "delivered", status: "Delivered" })
      .eq("id", orderId);
    if (error) {
      toast.error("Could not update order", { description: error.message });
      return;
    }
    toast.success("Order marked as delivered");
    setTab("delivered");
    void reload();
  };

  const list = tab === "current" ? current : tab === "ongoing" ? ongoing : delivered;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage current and ongoing deliveries.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border/40">
        {(["current", "ongoing", "delivered"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm capitalize transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "current" && `Current (${current.length})`}
            {t === "ongoing" && `Ongoing delivery (${ongoing.length})`}
            {t === "delivered" && `Delivered (${delivered.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/40 bg-card p-8 text-center text-sm text-muted-foreground">
          No orders in this tab.
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((order) => {
            const customer = profiles[order.user_id];
            const customerName =
              `${order.shipping_address?.first_name ?? ""} ${order.shipping_address?.last_name ?? ""}`.trim() ||
              customer?.display_name ||
              customer?.email ||
              "Customer";
            const orderState = order.shipping_address?.state ?? "";
            const matchingDeliverers = deliverers.filter(
              (d) => !orderState || d.state.toLowerCase() === orderState.toLowerCase(),
            );

            return (
              <div key={order.id} className="rounded-lg border border-border/40 bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to="/admin/users/$userId"
                      params={{ userId: order.user_id }}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {customerName}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Order #{order.id.slice(0, 8)} · {new Date(order.created_at).toLocaleString()}
                    </p>
                    {order.shipping_address && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {order.shipping_address.city}, {order.shipping_address.state}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-lg">₦{Number(order.total).toLocaleString()}</p>
                    <StatusPill stage={order.delivery_stage} />
                  </div>
                </div>

                {order.order_items && order.order_items.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.order_items.slice(0, 6).map((it) => (
                      <div key={it.product_id + it.product_name} className="flex items-center gap-2 rounded-md border border-border/40 bg-background/50 px-2 py-1">
                        <img src={it.product_image} alt="" className="h-10 w-10 rounded object-cover" />
                        <div className="text-xs">
                          <p className="line-clamp-1 max-w-[140px] text-foreground">{it.product_name}</p>
                          <p className="text-muted-foreground">×{it.quantity}</p>
                        </div>
                      </div>
                    ))}
                    {order.order_items.length > 6 && (
                      <span className="self-center text-xs text-muted-foreground">+{order.order_items.length - 6} more</span>
                    )}
                  </div>
                )}

                {tab === "current" && (
                  <div className="mt-4 border-t border-border/40 pt-4">
                    {assigning === order.id ? (
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
                          Deliverers in {orderState || "any state"}
                        </p>
                        {matchingDeliverers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No active deliverers in this state.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {matchingDeliverers.map((d) => (
                              <button
                                key={d.id}
                                onClick={() => void assign(order.id, d.id)}
                                className="flex w-full items-center justify-between rounded-md border border-border/40 px-3 py-2 text-left text-sm hover:border-primary hover:bg-primary/5"
                              >
                                <div>
                                  <p className="font-medium">{d.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {d.phone} · {d.city ?? d.state}
                                  </p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => setAssigning(null)}
                          className="mt-3 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAssigning(order.id)}
                        className="inline-flex items-center gap-2 rounded-md bg-gold-gradient px-4 py-2 text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90"
                      >
                        <Truck className="h-4 w-4" />
                        Assign deliverer
                      </button>
                    )}
                  </div>
                )}

                {tab === "ongoing" && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
                    <div className="text-xs">
                      {order.deliverer_id && (
                        <span className="text-muted-foreground">
                          Assigned to:{" "}
                          <span className="text-foreground">
                            {deliverers.find((d) => d.id === order.deliverer_id)?.name ?? "Deliverer"}
                          </span>
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => void markDelivered(order.id)}
                      className="inline-flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-xs uppercase tracking-wider text-primary hover:bg-primary/10"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark delivered
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({ stage }: { stage: string }) {
  const map: Record<string, { label: string; cls: string; Icon: typeof Truck }> = {
    pending: { label: "Awaiting assignment", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30", Icon: Truck },
    assigned: { label: "Assigned", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30", Icon: Truck },
    in_transit: { label: "In transit", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30", Icon: Truck },
    delivered: { label: "Delivered", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", Icon: PackageCheck },
  };
  const v = map[stage] ?? map.pending;
  const Icon = v.Icon;
  return (
    <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider", v.cls)}>
      <Icon className="h-3 w-3" />
      {v.label}
    </span>
  );
}
