import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Package, LogOut, MapPin, Phone, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/deliverer")({
  head: () => ({
    meta: [
      { title: "Deliverer Dashboard — Maison Luxe" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DelivererDashboard,
});

type ShippingAddress = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address_line?: string;
  city?: string;
  state?: string;
};

type AssignedOrder = {
  id: string;
  total: number;
  delivery_stage: string;
  status: string;
  created_at: string;
  shipping_address: ShippingAddress;
  user_id: string;
};

const STAGES = ["pending", "picked_up", "in_transit", "delivered"] as const;

function DelivererDashboard() {
  const { user, loading, signOut } = useStore();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [delivererId, setDelivererId] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    (async () => {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "deliverer")
        .maybeSingle();

      if (!roleRow) {
        setAuthorized(false);
        void navigate({ to: "/" });
        return;
      }

      const { data: del } = await supabase
        .from("deliverers")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!del) {
        setAuthorized(false);
        return;
      }
      setDelivererId(del.id);
      setName(del.name);
      setAuthorized(true);
    })();
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!delivererId) return;
    const load = async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, delivery_stage, status, created_at, shipping_address, user_id")
        .eq("deliverer_id", delivererId)
        .order("created_at", { ascending: false });
      setOrders((data ?? []) as AssignedOrder[]);
      setLoadingOrders(false);
    };
    void load();
    const channel = supabase
      .channel(`deliverer-${delivererId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `deliverer_id=eq.${delivererId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [delivererId]);

  const updateStage = async (orderId: string, stage: string) => {
    await supabase.from("orders").update({ delivery_stage: stage }).eq("id", orderId);
  };

  if (loading || authorized === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (authorized === false) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        You are not registered as a deliverer.
      </div>
    );
  }

  const active = orders.filter((o) => o.delivery_stage !== "delivered");
  const done = orders.filter((o) => o.delivery_stage === "delivered");

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Deliverer</p>
          <h1 className="mt-1 font-serif text-3xl">Welcome, {name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length} active · {done.length} delivered
          </p>
        </div>
        <button
          onClick={() => void signOut().then(() => navigate({ to: "/" }))}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-wider hover:bg-muted"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>

      {loadingOrders ? (
        <p className="text-sm text-muted-foreground">Loading deliveries…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No deliveries assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-lg border border-border/40 bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Order #{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()} · ₦{Number(o.total).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-wider text-primary">
                  {o.delivery_stage.replace("_", " ")}
                </span>
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <p className="flex items-center gap-2">
                  <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {o.shipping_address?.first_name} {o.shipping_address?.last_name}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {o.shipping_address?.phone}
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    {o.shipping_address?.address_line}, {o.shipping_address?.city},{" "}
                    {o.shipping_address?.state}
                  </span>
                </p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => void updateStage(o.id, s)}
                    disabled={o.delivery_stage === s}
                    className={
                      o.delivery_stage === s
                        ? "rounded-md bg-primary px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary-foreground"
                        : "rounded-md border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider hover:bg-muted"
                    }
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
