import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Package,
  LogOut,
  MapPin,
  Phone,
  User as UserIcon,
  Search as SearchIcon,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/deliverer")({
  head: () => ({
    meta: [
      { title: "Deliverer Dashboard — Luxe Sparkles" },
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
  subtotal: number;
  shipping: number;
  tax: number;
  delivery_stage: string;
  status: string;
  created_at: string;
  shipping_address: ShippingAddress;
  user_id: string;
};

type OrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  price: number;
  quantity: number;
  variant?: { color?: string; size?: string } | null;
};

function DelivererDashboard() {
  const { user, loading, signOut } = useStore();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [delivererId, setDelivererId] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [tab, setTab] = useState<"active" | "delivered">("active");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        .select(
          "id, total, subtotal, shipping, tax, delivery_stage, status, created_at, shipping_address, user_id",
        )
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

  const active = useMemo(
    () => orders.filter((o) => o.delivery_stage !== "delivered"),
    [orders],
  );
  const done = useMemo(
    () => orders.filter((o) => o.delivery_stage === "delivered"),
    [orders],
  );

  // Search restricted to current tab.
  const filtered = useMemo(() => {
    const list = tab === "active" ? active : done;
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const a = o.shipping_address ?? {};
      return (
        o.id.toLowerCase().includes(q) ||
        `${a.first_name ?? ""} ${a.last_name ?? ""}`.toLowerCase().includes(q) ||
        (a.phone ?? "").toLowerCase().includes(q) ||
        (a.city ?? "").toLowerCase().includes(q) ||
        (a.state ?? "").toLowerCase().includes(q) ||
        (a.address_line ?? "").toLowerCase().includes(q)
      );
    });
  }, [tab, active, done, query]);

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

  if (selectedId) {
    return (
      <OrderDetail
        orderId={selectedId}
        onBack={() => setSelectedId(null)}
        onDelivered={() => {
          setSelectedId(null);
          setTab("delivered");
        }}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Deliverer</p>
          <h1 className="mt-1 font-serif text-2xl md:text-3xl">Welcome, {name}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {active.length} active · {done.length} delivered
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle variant="compact" />
          <button
            onClick={() => void signOut().then(() => navigate({ to: "/" }))}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-wider hover:bg-muted"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-border/40">
        {(["active", "delivered"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setQuery("");
            }}
            className={
              tab === t
                ? "border-b-2 border-primary px-4 py-2 text-sm capitalize text-foreground"
                : "border-b-2 border-transparent px-4 py-2 text-sm capitalize text-muted-foreground hover:text-foreground"
            }
          >
            {t === "active" ? `Active (${active.length})` : `Delivered (${done.length})`}
          </button>
        ))}
      </div>

      {/* In-tab search */}
      <div className="mb-5 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
        <SearchIcon className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${tab} orders…`}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {loadingOrders ? (
        <p className="text-sm text-muted-foreground">Loading deliveries…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card p-12 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {query
              ? "No orders match your search."
              : tab === "active"
                ? "No active deliveries."
                : "No delivered orders yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <button
              key={o.id}
              onClick={() => setSelectedId(o.id)}
              className="block w-full rounded-lg border border-border/40 bg-card p-5 text-left transition-colors hover:border-primary/50 hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">Order #{o.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()} · ₦
                    {Number(o.total).toLocaleString()}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-wider text-primary">
                  {o.delivery_stage.replace("_", " ")}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <UserIcon className="h-3.5 w-3.5" />
                  {o.shipping_address?.first_name} {o.shipping_address?.last_name}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {o.shipping_address?.city}, {o.shipping_address?.state}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OrderDetail({
  orderId,
  onBack,
  onDelivered,
}: {
  orderId: string;
  onBack: () => void;
  onDelivered: () => void;
}) {
  const [order, setOrder] = useState<AssignedOrder | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [askPlace, setAskPlace] = useState(false);
  const [place, setPlace] = useState("");
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [oRes, iRes] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, total, subtotal, shipping, tax, delivery_stage, status, created_at, shipping_address, user_id",
          )
          .eq("id", orderId)
          .maybeSingle(),
        supabase.from("order_items").select("*").eq("order_id", orderId),
      ]);
      setOrder((oRes.data as AssignedOrder | null) ?? null);
      setItems((iRes.data ?? []) as OrderItem[]);
      setLoading(false);
    })();
  }, [orderId]);

  const confirmDelivered = async () => {
    setPlaceError(null);
    const trimmed = place.trim();
    if (trimmed.length < 3) {
      setPlaceError("Please enter the delivery place address.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("orders")
      .update({
        delivery_stage: "delivered",
        status: "Delivered",
        delivery_place: trimmed,
      })
      .eq("id", orderId);
    if (error) {
      setBusy(false);
      setPlaceError(error.message);
      return;
    }
    // Fire-and-await the delivered email (doesn't block UI on failure)
    try {
      const { sendOrderDeliveredEmail } = await import(
        "@/lib/order-delivered-email.functions"
      );
      await sendOrderDeliveredEmail({ data: { orderId } });
    } catch (e) {
      console.error("delivered email trigger failed", e);
    }
    setBusy(false);
    setAskPlace(false);
    onDelivered();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading order…
      </div>
    );
  }
  if (!order) {
    return (
      <div className="container mx-auto px-4 py-8">
        <button onClick={onBack} className="text-sm text-primary">
          ← Back
        </button>
        <p className="mt-4 text-sm">Order not found.</p>
      </div>
    );
  }

  const a = order.shipping_address ?? {};
  const isDelivered = order.delivery_stage === "delivered";

  return (
    <div className="container mx-auto px-4 py-6 pb-32 md:py-10">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to orders
      </button>

      <div className="rounded-lg border border-border/40 bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl">Order #{order.id.slice(0, 8)}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-wider text-primary">
            {order.delivery_stage.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Customer / address */}
      <div className="mt-4 rounded-lg border border-border/40 bg-card p-5">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Delivery details
        </h2>
        <div className="space-y-2 text-sm">
          <p className="flex items-center gap-2">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
            {a.first_name} {a.last_name}
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            <a href={`tel:${a.phone}`} className="text-primary hover:underline">
              {a.phone}
            </a>
          </p>
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {a.address_line}, {a.city}, {a.state}
            </span>
          </p>
        </div>
      </div>

      {/* Products */}
      <div className="mt-4 rounded-lg border border-border/40 bg-card p-5">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Products ({items.reduce((s, i) => s + i.quantity, 0)})
        </h2>
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.id} className="flex gap-3 border-b border-border/30 pb-3 last:border-0 last:pb-0">
              <img
                src={it.product_image}
                alt={it.product_name}
                className="h-16 w-16 rounded-md border border-border/40 object-cover"
                loading="lazy"
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{it.product_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Qty {it.quantity} · ₦{Number(it.price).toLocaleString()}
                </p>
                {it.variant && (it.variant.color || it.variant.size) && (
                  <p className="mt-0.5 text-xs text-primary">
                    {it.variant.color && <>Color: {it.variant.color}</>}
                    {it.variant.color && it.variant.size && " · "}
                    {it.variant.size && <>Size: {it.variant.size}</>}
                  </p>
                )}
              </div>
              <p className="text-sm font-medium">
                ₦{(Number(it.price) * it.quantity).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1 border-t border-border/40 pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>₦{Number(order.subtotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>₦{Number(order.shipping).toLocaleString()}</span>
          </div>
          {Number(order.tax) > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>₦{Number(order.tax).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border/40 pt-2 font-medium">
            <span>Total</span>
            <span>₦{Number(order.total).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Bottom delivered button */}
      {!isDelivered && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 p-4 backdrop-blur-xl">
          <div className="container mx-auto">
            <button
              onClick={() => {
                setPlace(
                  [a.address_line, a.city, a.state].filter(Boolean).join(", "),
                );
                setPlaceError(null);
                setAskPlace(true);
              }}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gold-gradient px-6 py-3 text-sm uppercase tracking-wider text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              Delivered
            </button>
          </div>
        </div>
      )}
      {isDelivered && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> This order has been delivered.
        </div>
      )}

      {/* Delivery place modal */}
      {askPlace && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-lg border border-border/60 bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-serif text-lg">Delivery place</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Where exactly did you hand the order to the customer? This
                  address will be shown to them in the delivery confirmation
                  email.
                </p>
              </div>
            </div>
            <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Delivery place address
            </label>
            <textarea
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              rows={3}
              placeholder="e.g. 12 Marina Road, opposite First Bank, Victoria Island, Lagos"
              className="w-full resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              autoFocus
            />
            {placeError && (
              <p className="mt-2 text-xs text-destructive">{placeError}</p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  if (busy) return;
                  setAskPlace(false);
                }}
                className="rounded-md border border-border px-4 py-2 text-xs uppercase tracking-wider hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDelivered()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-gold-gradient px-5 py-2 text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {busy ? "Saving…" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
