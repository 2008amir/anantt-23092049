import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, CreditCard, Loader2, MapPin, Package, Truck, BadgeCheck } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore, useProducts } from "@/lib/store";
import type { Product } from "@/lib/products";
import { effectivePrice, formatNaira } from "@/lib/price";
import { NIGERIA_STATE_NAMES, NIGERIA_STATES } from "@/lib/nigeria-states";
import {
  verifyFlutterwave,
  chargeSavedCard,
} from "@/lib/flutterwave.functions";
import { openFlutterwavePopup } from "@/lib/flutterwave-popup";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Luxe Sparkles" }] }),
  component: Checkout,
});

type Step = 1 | 2 | 3;
type PayMethod = "card" | "bank_transfer" | "opay" | "saved_card";

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  authorization_code: string;
  is_default: boolean;
};


const CARD_BRAND_LOGOS: Record<string, string> = {
  visa: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg",
  mastercard: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg",
  verve: "https://res.cloudinary.com/dkw8oolgs/image/upload/v1700000000/verve_logo.png",
  amex: "https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg",
};

function brandLogo(brand: string) {
  const k = brand.toLowerCase();
  if (k.includes("visa")) return CARD_BRAND_LOGOS.visa;
  if (k.includes("master")) return CARD_BRAND_LOGOS.mastercard;
  if (k.includes("verve")) return CARD_BRAND_LOGOS.verve;
  if (k.includes("amex") || k.includes("american")) return CARD_BRAND_LOGOS.amex;
  return null;
}

function Checkout() {
  const navigate = useNavigate();
  const { user, loading: authLoading, clearCart } = useStore();
  const { products } = useProducts();

  useEffect(() => {
    if (!authLoading && !user) void navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  // Items for this checkout. Sourced from `checkout_snapshot` (placed by /cart
  // when the user proceeded). The DB cart stays empty and is NOT restored.
  const [snapshotRows, setSnapshotRows] = useState<
    { product_id: string; quantity: number; variant?: { color?: string; size?: string } | null }[]
  >([]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("checkout_snapshot");
      if (raw)
        setSnapshotRows(
          JSON.parse(raw) as {
            product_id: string;
            quantity: number;
            variant?: { color?: string; size?: string } | null;
          }[],
        );
    } catch {
      // ignore
    }
  }, []);

  const items = useMemo(() => {
    return snapshotRows
      .map((r) => {
        const p = products.find((p) => p.id === r.product_id);
        return p ? { product: p, quantity: r.quantity, variant: r.variant ?? null } : null;
      })
      .filter(Boolean) as {
      product: Product;
      quantity: number;
      variant: { color?: string; size?: string } | null;
    }[];
  }, [snapshotRows, products]);

  const subtotal = items.reduce((s, i) => s + effectivePrice(i.product) * i.quantity, 0);
  const tax = subtotal * 0.08;

  const [step, setStep] = useState<Step>(1);
  const [shipForm, setShipForm] = useState({
    name: "",
    email: user?.email ?? "",
    phone: "",
    address: "",
    state: "",
    lga: "",
    country: "Nigeria",
  });
  const [deliveryPrice, setDeliveryPrice] = useState(0);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
  const shipping = deliveryPrice;
  const total = subtotal + shipping + tax;
  const lgaOptions = useMemo(
    () => (shipForm.state ? NIGERIA_STATES[shipForm.state] ?? [] : []),
    [shipForm.state],
  );
  const [method, setMethod] = useState<PayMethod>("card");
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{ orderId: string } | null>(null);

  // Fetch LGA delivery price when state + lga selected
  useEffect(() => {
    if (!shipForm.state || !shipForm.lga) {
      setDeliveryPrice(0);
      setDeliveryNotice(null);
      return;
    }
    setDeliveryLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("lga_delivery_prices")
        .select("price")
        .eq("state", shipForm.state)
        .eq("lga", shipForm.lga)
        .maybeSingle();
      const price = Number(data?.price ?? 0);
      setDeliveryPrice(price);
      const msg =
        price > 0
          ? `Delivery price ₦${price.toLocaleString()} has been added for ${shipForm.lga}, ${shipForm.state}.`
          : `No delivery fee set for ${shipForm.lga}.`;
      setDeliveryNotice(msg);
      setDeliveryLoading(false);
      // Toast confirmation per user request
      const { toast } = await import("sonner");
      if (price > 0) toast.success("Delivery price has been added", { description: msg });
    })();
  }, [shipForm.state, shipForm.lga]);


  useEffect(() => {
    if (!user) return;
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("payment_methods")
        .select("id, brand, last4, exp_month, exp_year, authorization_code, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      const list = (data ?? []) as SavedCard[];
      setSavedCards(list);
      const def = list.find((c) => c.is_default) ?? list[0];
      if (def) {
        setSelectedCardId(def.id);
        setMethod("saved_card");
      }
    })();
  }, [user]);

  useEffect(() => {
    if (user?.email && !shipForm.email) setShipForm((s) => ({ ...s, email: user.email ?? "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (items.length === 0 && snapshotRows.length === 0) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-4xl">Your cart is empty</h1>
        <Link to="/shop" className="mt-6 inline-block text-primary underline">
          Return to shop
        </Link>
      </div>
    );
  }

  const validateShipping = () => {
    const e: Record<string, string> = {};
    if (!shipForm.name) e.name = "Required";
    if (!shipForm.email || !/^\S+@\S+\.\S+$/.test(shipForm.email)) e.email = "Valid email required";
    if (!shipForm.address) e.address = "Required";
    if (!shipForm.state) e.state = "Select a state";
    if (!shipForm.lga) e.lga = "Select an LGA";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const goToOrder = (orderId: string, paid: boolean) => {
    if (paid) {
      navigate({ to: "/orders/$id", params: { id: orderId } });
    } else {
      // Payment not complete: do NOT take user to shipping/order success.
      // Send them back to the cart with an error visible on the form.
      navigate({ to: "/cart" });
    }
  };

  const handleSubmit = async (e: FormEvent, overrideMethod?: PayMethod) => {
    e.preventDefault();
    if (!user) return;
    const activeMethod: PayMethod = overrideMethod ?? method;
    setErrors({});
    setPlacing(true);
    let createdOrderId: string | null = null;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Please sign in again to continue.");

      // 1. Create order in DB first (status pending — NOT processing until paid)
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          subtotal,
          shipping,
          tax,
          total,
          status: "Pending Payment",
          payment_method: method,
          payment_status: "pending",
          shipping_address: {
            name: shipForm.name,
            first_name: shipForm.name.split(" ")[0] ?? shipForm.name,
            last_name: shipForm.name.split(" ").slice(1).join(" "),
            phone: shipForm.phone,
            address: shipForm.address,
            state: shipForm.state,
            lga: shipForm.lga,
            city: shipForm.lga,
            country: shipForm.country,
          },
        })
        .select()
        .single();
      if (error || !order) throw error ?? new Error("Failed to create order");
      createdOrderId = order.id;

      const { error: itemsError } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.product.id,
          product_name: i.product.name,
          product_image: i.product.image,
          price: effectivePrice(i.product),
          quantity: i.quantity,
          variant: i.variant ?? null,
        })),
      );
      if (itemsError) throw itemsError;

      const tx_ref = `ml-${order.id}-${Date.now()}`;

      // 2. Branch by method
      if (activeMethod === "saved_card" && selectedCardId) {
        const card = savedCards.find((c) => c.id === selectedCardId);
        if (!card) throw new Error("Saved card not found");
        const res = await chargeSavedCard({
          data: {
            amount: total,
            email: shipForm.email,
            tx_ref,
            token: card.authorization_code,
            meta: { order_id: order.id },
            accessToken,
          },
        });
        const verified = await verifyFlutterwave({
          data: { tx_ref: res.tx_ref, saveCard: false, accessToken },
        });
        await finalize(order.id, tx_ref, verified.success);
        goToOrder(order.id, verified.success);
        if (!verified.success) setErrors({ form: "Card was declined. Please try another method." });
        return;
      }

      // Card / Bank transfer / Opay → open Flutterwave INLINE popup.
      // No redirect. Modal opens over the checkout page.
      // Show all payment options inside the Flutterwave modal so the user
      // picks card / bank transfer / USSD / Opay there.
      const paymentOptions = "card,banktransfer,ussd,opay";

      // Customer name override: "luxesparkles-{username}" so it shows on the
      // Flutterwave dashboard / statement narration as the sender reference.
      const usernameSlug = (user?.email ?? shipForm.email)
        .split("@")[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const flwCustomerName = `luxesparkles-${usernameSlug}`;

      await supabase
        .from("orders")
        .update({ payment_reference: tx_ref })
        .eq("id", order.id);

      const popupResult = await openFlutterwavePopup({
        amount: total,
        email: shipForm.email,
        name: flwCustomerName,
        phone: shipForm.phone,
        tx_ref,
        paymentOptions,
        meta: { order_id: order.id, customer_name: flwCustomerName, shipping_name: shipForm.name },
        title: "Luxe Sparkles",
        description: `Order ${order.id.slice(0, 8)}`,
      });

      if (!popupResult) {
        // User closed the modal without completing payment
        await supabase
          .from("orders")
          .update({ payment_status: "failed", status: "Payment Failed" })
          .eq("id", order.id);
        setErrors({ form: "Payment was cancelled. Please try again to complete your order." });
        setPlacing(false);
        return;
      }

      // Verify on the backend before marking paid
      const verified = await verifyFlutterwave({
        data: { tx_ref, accessToken },
      });
      await finalize(order.id, tx_ref, verified.success);

      if (verified.success) {
        setPaymentSuccess({ orderId: order.id });
        setPlacing(false);
      } else {
        setErrors({ form: "Payment could not be verified. If you were charged, contact support." });
        setPlacing(false);
      }
      return;
    } catch (err) {
      console.error(err);
      setErrors({ form: err instanceof Error ? err.message : "Failed to place order" });
      if (createdOrderId) {
        await supabase
          .from("orders")
          .update({ payment_status: "failed", status: "Payment Failed" })
          .eq("id", createdOrderId);
      }
    } finally {
      setPlacing(false);
    }
  };

  const finalize = async (orderId: string, tx_ref: string, success: boolean) => {
    await supabase
      .from("orders")
      .update({
        payment_reference: tx_ref,
        payment_status: success ? "paid" : "failed",
        status: success ? "Processing" : "Payment Failed",
      })
      .eq("id", orderId);
    if (success) {
      await clearCart();
      try {
        sessionStorage.removeItem("checkout_snapshot");
      } catch {
        // ignore
      }
      try {
        const { sendOrderConfirmationEmail } = await import("@/lib/order-email.functions");
        await sendOrderConfirmationEmail({ data: { orderId } });
      } catch (e) {
        console.error("order confirmation email failed", e);
      }
    }
  };


  const steps = [
    { n: 1, label: "Shipping", icon: MapPin },
    { n: 2, label: "Review", icon: Package },
    { n: 3, label: "Payment", icon: BadgeCheck },
  ] as const;

  const paymentVerified = !!paymentSuccess;

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Secure Checkout</p>
        <h1 className="mt-3 font-serif text-5xl">Complete Your Order</h1>
      </header>

      <div className="mx-auto mb-12 flex max-w-2xl items-center justify-between">
        {steps.map((s, i) => {
          // Shipping/Review use the wizard step. Payment is "done" only when verified.
          const done = s.n === 3 ? paymentVerified : step > s.n;
          const current = s.n === 3 ? (step === 2 && !paymentVerified) : step === s.n;
          return (
            <div key={s.n} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full border transition-smooth ${
                    done
                      ? "border-primary bg-gold-gradient text-primary-foreground"
                      : current
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
                </div>
                <span
                  className={`mt-2 text-xs uppercase tracking-[0.2em] ${current || done ? "text-primary" : "text-muted-foreground"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`mx-2 h-px flex-1 ${
                    (s.n === 2 ? paymentVerified : step > s.n) ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-12 lg:grid-cols-[1fr_380px]">
        <form onSubmit={handleSubmit} className="border border-border bg-card/50 p-8">
          {step === 1 && (
            <div>
              <h2 className="font-serif text-2xl">Shipping Address</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Full Name" value={shipForm.name} onChange={(v) => setShipForm({ ...shipForm, name: v })} error={errors.name} />
                <Field label="Email" type="email" value={shipForm.email} onChange={(v) => setShipForm({ ...shipForm, email: v })} error={errors.email} />
                <Field label="Phone" value={shipForm.phone} onChange={(v) => setShipForm({ ...shipForm, phone: v })} />
                <div className="sm:col-span-2">
                  <Field label="Address" value={shipForm.address} onChange={(v) => setShipForm({ ...shipForm, address: v })} error={errors.address} />
                </div>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">State</span>
                  <select
                    value={shipForm.state}
                    onChange={(e) => setShipForm({ ...shipForm, state: e.target.value, lga: "" })}
                    className={`mt-2 w-full border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary ${errors.state ? "border-destructive" : "border-border"}`}
                  >
                    <option value="">Select state…</option>
                    {NIGERIA_STATE_NAMES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {errors.state && <span className="mt-1 block text-xs text-destructive">{errors.state}</span>}
                </label>
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">LGA</span>
                  <select
                    value={shipForm.lga}
                    onChange={(e) => setShipForm({ ...shipForm, lga: e.target.value })}
                    disabled={!shipForm.state}
                    className={`mt-2 w-full border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary disabled:opacity-50 ${errors.lga ? "border-destructive" : "border-border"}`}
                  >
                    <option value="">{shipForm.state ? "Select LGA…" : "Select state first"}</option>
                    {lgaOptions.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                  {errors.lga && <span className="mt-1 block text-xs text-destructive">{errors.lga}</span>}
                </label>
                <div className="sm:col-span-2">
                  <Field label="Country" value={shipForm.country} onChange={(v) => setShipForm({ ...shipForm, country: v })} />
                </div>
                {deliveryNotice && (
                  <div className="sm:col-span-2 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary">
                    {deliveryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Truck className="h-3 w-3" />}
                    {deliveryNotice}
                  </div>
                )}
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={() => validateShipping() && setStep(2)}
                  className="bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground transition-smooth hover:opacity-90"
                >
                  Continue to Review
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-serif text-2xl">Review & Place Order</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <ReviewBlock title="Shipping To">
                  <p>{shipForm.name}</p>
                  <p>{shipForm.address}</p>
                  <p>
                    {shipForm.lga}, {shipForm.state}
                  </p>
                  <p>{shipForm.country}</p>
                </ReviewBlock>
                <ReviewBlock title="Amount to Pay">
                  <p className="font-serif text-2xl text-gold-gradient">
                    ₦{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </ReviewBlock>
              </div>

              {savedCards.length > 0 && (
                <div className="mt-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Pay with a saved card (optional)</p>
                  <div className="mt-2 space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMethod("card");
                        setSelectedCardId(null);
                      }}
                      className={`flex w-full items-center justify-between border px-4 py-3 text-left transition-smooth ${
                        method !== "saved_card" ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <CreditCard className="h-4 w-4" />
                        Choose payment method on Flutterwave
                      </span>
                    </button>
                    {savedCards.map((c) => {
                      const active = method === "saved_card" && selectedCardId === c.id;
                      const logo = brandLogo(c.brand);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setMethod("saved_card");
                            setSelectedCardId(c.id);
                          }}
                          className={`flex w-full items-center justify-between border px-4 py-3 text-left transition-smooth ${
                            active ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            {logo ? (
                              <img src={logo} alt={c.brand} className="h-6 w-10 object-contain" />
                            ) : (
                              <CreditCard className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
                            )}
                            <span className="text-sm text-foreground">
                              {c.brand} •••• {c.last4}
                            </span>
                          </span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            Exp {c.exp_month}/{c.exp_year}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <p className="mt-6 text-[11px] text-muted-foreground">
                Tap “Make Payment” to open Flutterwave and choose card, bank transfer, USSD or Opay. Your order will not ship until payment is confirmed.
              </p>

              {paymentSuccess && (
                <div className="mt-6 border border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-6 w-6" />
                  </div>
                  <p className="mt-3 font-serif text-xl text-foreground">Payment Successful</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your order has been confirmed. Thank you for shopping with Luxe Sparkles.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/orders/$id", params: { id: paymentSuccess.orderId } })}
                    className="mt-5 inline-block bg-gold-gradient px-8 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold hover:opacity-90"
                  >
                    View Order
                  </button>
                </div>
              )}

              {errors.form && <p className="mt-4 text-xs text-destructive">{errors.form}</p>}
              {!paymentSuccess && (
                <div className="mt-8 flex justify-between">
                  <button type="button" onClick={() => setStep(1)} className="border border-border px-8 py-4 text-xs uppercase tracking-[0.25em] text-foreground hover:border-primary">
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={placing}
                    className="flex items-center gap-2 bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold hover:opacity-90 disabled:opacity-60"
                  >
                    {placing && <Loader2 className="h-4 w-4 animate-spin" />}
                    {placing
                      ? "Processing…"
                      : `Make Payment — ₦${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </button>
                </div>
              )}
            </div>
          )}
        </form>

        <aside className="h-fit border border-border bg-card/50 p-8">
          <h2 className="font-serif text-2xl">Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="flex justify-between text-muted-foreground">
                <span>
                  {product.name} × {quantity}
                </span>
                <span>{formatNaira(effectivePrice(product) * quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2 border-t border-border pt-6 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span>{shipping === 0 ? "Free" : `₦${shipping}`}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>₦{tax.toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
            <span className="font-serif text-2xl text-gold-gradient">₦{total.toFixed(2)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}


function Field({
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-2 w-full border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary ${error ? "border-destructive" : "border-border"}`}
      />
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-primary">{title}</p>
      <div className="mt-2 space-y-1 text-sm text-foreground">{children}</div>
    </div>
  );
}
