import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Truck, Package, Loader2, X, RefreshCw } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { Recommend } from "@/components/Recommend";
import { verifyFlutterwave } from "@/lib/flutterwave.functions";

type OrderItem = { product_image: string; product_name: string; price: number | string; quantity: number; variant?: { color?: string; size?: string } | null };
type Shipping = { name: string; address: string; city: string; zip: string; country: string };
type Order = {
  id: string;
  total: number | string;
  status: string;
  payment_status: string;
  payment_reference: string | null;
  created_at: string;
  shipping_address: Shipping;
  order_items: OrderItem[];
};

export const Route = createFileRoute("/orders/$id")({
  head: ({ params }) => ({ meta: [{ title: `Order ${params.id} — Luxe Sparkles` }] }),
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const loadOrder = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", id)
      .maybeSingle();
    setOrder((data as unknown as Order) ?? null);
  }, [id]);

  const verifyPayment = useCallback(async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const params = new URLSearchParams(window.location.search);
      const tx_ref =
        params.get("tx_ref") ||
        (() => {
          try {
            return sessionStorage.getItem(`pending_order_${id}`);
          } catch {
            return null;
          }
        })();
      if (!tx_ref) {
        setVerifyError("No payment reference found.");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        setVerifyError("Please sign in again to verify.");
        return;
      }
      const result = await verifyFlutterwave({ data: { tx_ref, accessToken } });
      if (result.success) {
        await supabase
          .from("orders")
          .update({ payment_status: "paid", status: "Processing" })
          .eq("id", id);
        try { sessionStorage.removeItem(`pending_order_${id}`); } catch { /* noop */ }
        window.history.replaceState({}, "", window.location.pathname);
        try {
          const { sendOrderConfirmationEmail } = await import("@/lib/order-email.functions");
          await sendOrderConfirmationEmail({ data: { orderId: id } });
        } catch (e) {
          console.error("order confirmation email failed", e);
        }
      } else if (result.status === "failed" || result.status === "cancelled") {
        await supabase
          .from("orders")
          .update({ payment_status: "failed", status: "Payment Failed" })
          .eq("id", id);
        try { sessionStorage.removeItem(`pending_order_${id}`); } catch { /* noop */ }
        setVerifyError("Payment failed. You can retry or cancel the order.");
      } else {
        setVerifyError("Payment is still pending. Try again in a moment.");
      }
      await loadOrder();
    } catch (e) {
      console.error("Verification failed", e);
      setVerifyError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }, [id, loadOrder]);

  const cancelOrder = useCallback(async () => {
    await supabase
      .from("orders")
      .update({ payment_status: "cancelled", status: "Cancelled" })
      .eq("id", id);
    try { sessionStorage.removeItem(`pending_order_${id}`); } catch { /* noop */ }
    void navigate({ to: "/cart" });
  }, [id, navigate]);

  useEffect(() => {
    void (async () => {
      await loadOrder();
      setLoading(false);
      const params = new URLSearchParams(window.location.search);
      const hasRef = params.has("tx_ref") || params.has("transaction_id");
      let stashed = false;
      try { stashed = !!sessionStorage.getItem(`pending_order_${id}`); } catch { /* noop */ }
      if (hasRef || stashed) {
        void verifyPayment();
      }
    })();
  }, [id, loadOrder, verifyPayment]);

  if (loading)
    return (
      <div className="container mx-auto flex flex-col items-center gap-3 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  if (!order) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-4xl">Order not found</h1>
        <Link to="/orders" className="mt-6 inline-block text-primary underline">View all orders</Link>
      </div>
    );
  }

  const isPending = order.payment_status === "pending";
  const isFailed = order.payment_status === "failed" || order.status === "Payment Failed";
  const isCancelled = order.payment_status === "cancelled" || order.status === "Cancelled";
  const isPaid = order.payment_status === "paid";

  const statusSteps = [
    { label: "Confirmed", icon: Check, done: isPaid },
    { label: "Processing", icon: Package, done: isPaid },
    { label: "Shipped", icon: Truck, done: order.status === "Shipped" || order.status === "Delivered" },
    { label: "Delivered", icon: Check, done: order.status === "Delivered" },
  ];

  return (
    <div className="container mx-auto px-6 py-16">
      <Link to="/orders" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-primary">← All Orders</Link>

      {(isPending || isFailed) && !isCancelled && (
        <section className="mt-6 border border-primary/40 bg-primary/5 p-8">
          <div className="flex items-start gap-4">
            {verifying ? (
              <Loader2 className="mt-1 h-6 w-6 animate-spin text-primary" />
            ) : isFailed ? (
              <X className="mt-1 h-6 w-6 text-destructive" />
            ) : (
              <Loader2 className="mt-1 h-6 w-6 animate-spin text-primary" />
            )}
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.3em] text-primary">Payment Verification</p>
              <h2 className="mt-2 font-serif text-3xl">
                {verifying
                  ? "Verifying your payment…"
                  : isFailed
                    ? "Payment failed"
                    : "Awaiting payment confirmation"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {verifying
                  ? "Please wait while we confirm your payment with the bank."
                  : verifyError ?? "Your payment is still being processed. You can retry verification or cancel this order."}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void verifyPayment()}
                  disabled={verifying}
                  className="inline-flex items-center gap-2 bg-gold-gradient px-6 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground transition-smooth hover:opacity-90 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`} />
                  {verifying ? "Verifying…" : "Retry Verification"}
                </button>
                <button
                  type="button"
                  onClick={() => void cancelOrder()}
                  disabled={verifying}
                  className="inline-flex items-center gap-2 border border-border px-6 py-3 text-xs uppercase tracking-[0.25em] text-foreground transition-smooth hover:border-destructive hover:text-destructive disabled:opacity-60"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel Payment
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {isCancelled && (
        <section className="mt-6 border border-destructive/40 bg-destructive/5 p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-destructive">Cancelled</p>
          <h2 className="mt-2 font-serif text-3xl">This order was cancelled</h2>
          <p className="mt-2 text-sm text-muted-foreground">No payment was taken.</p>
        </section>
      )}

      <div className="mt-6 border-b border-border pb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">{isPaid ? "Confirmation" : "Order"}</p>
        <h1 className="mt-3 font-serif text-5xl">{isPaid ? "Thank you for your order" : "Order details"}</h1>
        <p className="mt-3 text-muted-foreground">
          Order <span className="text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span> · placed{" "}
          {new Date(order.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {isPaid && (
        <section className="mt-12 border border-border bg-card/50 p-4 sm:p-8">
          <h2 className="font-serif text-2xl text-center">Shipping Status</h2>
          <div className="mx-auto mt-8 flex w-full max-w-md items-start justify-center">
            {statusSteps.map((s, i) => (
              <div key={i} className="flex flex-1 items-start">
                <div className="flex flex-1 flex-col items-center">
                  <div className={`flex h-9 w-9 sm:h-12 sm:w-12 items-center justify-center rounded-full border ${s.done ? "border-primary bg-gold-gradient text-primary-foreground" : "border-border text-muted-foreground"}`}>
                    <s.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <span className={`mt-2 text-[9px] sm:text-xs uppercase tracking-[0.15em] sm:tracking-[0.2em] text-center ${s.done ? "text-primary" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
                {i < statusSteps.length - 1 && (<div className={`mt-4 sm:mt-6 h-px flex-1 min-w-[8px] ${statusSteps[i + 1].done ? "bg-primary" : "bg-border"}`} />)}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="font-serif text-2xl">Items</h2>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {order.order_items.map((it, i) => (
              <div key={i} className="flex gap-4 py-4">
                <img src={it.product_image} alt={it.product_name} className="h-24 w-24 border border-border object-cover" />
                <div className="flex-1">
                  <p className="font-serif text-xl">{it.product_name}</p>
                  <p className="text-xs text-muted-foreground">Quantity {it.quantity}</p>
                  {it.variant && (it.variant.color || it.variant.size) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {it.variant.color && <>Color: <span className="text-foreground">{it.variant.color}</span></>}
                      {it.variant.color && it.variant.size && " · "}
                      {it.variant.size && <>Size: <span className="text-foreground">{it.variant.size}</span></>}
                    </p>
                  )}
                </div>
                <p className="text-primary">₦{(Number(it.price) * it.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit space-y-6">
          <div className="border border-border bg-card/50 p-6">
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary">Shipping To</p>
            <div className="mt-3 space-y-1 text-sm">
              <p>{order.shipping_address.name}</p>
              <p className="text-muted-foreground">{order.shipping_address.address}</p>
              <p className="text-muted-foreground">{order.shipping_address.city}, {order.shipping_address.zip}</p>
              <p className="text-muted-foreground">{order.shipping_address.country}</p>
            </div>
          </div>
          <div className="border border-border bg-card/50 p-6">
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary">{isPaid ? "Total Paid" : "Amount Due"}</p>
            <p className="mt-2 font-serif text-3xl text-gold-gradient">₦{Number(order.total).toFixed(2)}</p>
          </div>
        </aside>
      </div>
      <Recommend />
    </div>
  );
}
