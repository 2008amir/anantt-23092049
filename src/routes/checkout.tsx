import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Building2, Check, CreditCard, Loader2, MapPin, Package, Smartphone, Copy, Lock } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore, useCartTotal, useProducts } from "@/lib/store";
import {
  verifyFlutterwave,
  chargeSavedCard,
  createVirtualAccount,
  chargeCardDirect,
} from "@/lib/flutterwave.functions";
import { initOpayV4 } from "@/lib/flutterwave-v4.functions";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Maison Luxe" }] }),
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

type VirtualAccount = {
  account_number: string;
  bank_name: string;
  account_name: string;
  expiry_date: string;
  amount: number;
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
  const { user, clearCart } = useStore();
  const { products } = useProducts();
  const { items, subtotal, shipping, tax, total } = useCartTotal(products);
  const [step, setStep] = useState<Step>(1);
  const [shipForm, setShipForm] = useState({
    name: "",
    email: user?.email ?? "",
    phone: "",
    address: "",
    city: "",
    zip: "",
    country: "Nigeria",
  });
  const [method, setMethod] = useState<PayMethod>("card");
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placing, setPlacing] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [waitingForBankPayment, setWaitingForBankPayment] = useState(false);
  const [cardForm, setCardForm] = useState({
    number: "",
    expiry: "",
    cvv: "",
  });

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

  if (items.length === 0) {
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
    if (!shipForm.city) e.city = "Required";
    if (!shipForm.zip) e.zip = "Required";
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
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
            address: shipForm.address,
            city: shipForm.city,
            zip: shipForm.zip,
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
          price: i.product.price,
          quantity: i.quantity,
        })),
      );
      if (itemsError) throw itemsError;

      const tx_ref = `ml-${order.id}-${Date.now()}`;

      // 2. Branch by method
      if (method === "saved_card" && selectedCardId) {
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

      if (method === "bank_transfer") {
        // Generate a dedicated virtual bank account for this exact order
        const va = await createVirtualAccount({
          data: {
            amount: total,
            email: shipForm.email,
            tx_ref,
            name: shipForm.name,
            accessToken,
          },
        });
        await supabase
          .from("orders")
          .update({ payment_reference: tx_ref })
          .eq("id", order.id);
        setVirtualAccount({
          account_number: va.account_number,
          bank_name: va.bank_name,
          account_name: va.account_name,
          expiry_date: va.expiry_date,
          amount: va.amount,
        });
        setWaitingForBankPayment(true);
        // Poll for payment completion
        void pollVirtualAccountPayment(order.id, tx_ref, accessToken);
        setPlacing(false);
        return;
      }

      if (method === "opay") {
        // Flutterwave v4 Opay flow: create customer + payment method + charge,
        // then redirect the browser to Opay's hosted authorization page.
        const opay = await initOpayV4({
          data: {
            amount: total,
            email: shipForm.email,
            name: shipForm.name,
            phone: shipForm.phone,
            reference: tx_ref,
            meta: { order_id: order.id },
            accessToken,
          },
        });
        // Persist the v4 charge id on the order so we can verify on return.
        await supabase
          .from("orders")
          .update({
            payment_reference: tx_ref,
            payment_status: "pending",
            // store charge id in payment_method field suffix so we don't need a migration
            payment_method: `opay:${opay.chargeId}`,
          })
          .eq("id", order.id);
        // Redirect — Flutterwave will bring the user back to our return URL
        // (set by the merchant in the Flutterwave dashboard) or directly to
        // the Opay-completed page; we'll also handle ?opay_charge=... on
        // /orders/$id to verify and finalize.
        window.location.href = `${opay.redirectUrl}${opay.redirectUrl.includes("?") ? "&" : "?"}return_url=${encodeURIComponent(window.location.origin + "/orders/" + order.id + "?opay_charge=" + opay.chargeId + "&order_id=" + order.id)}`;
        return;
      }

      // Card (new) → Flutterwave v3 inline popup with payment_options filter
      const paymentOptions = method === "card" ? "card" : "card,banktransfer,ussd";

      const callbackUrl = `${window.location.origin}/orders/${order.id}`;
      // Pre-create on Flutterwave (also gives us a hosted fallback link)
      await initFlutterwave({
        data: {
          amount: total,
          email: shipForm.email,
          name: shipForm.name,
          tx_ref,
          callbackUrl,
          paymentOptions,
          meta: { order_id: order.id },
          accessToken,
        },
      });

      const popup = await openFlutterwavePopup({
        email: shipForm.email,
        name: shipForm.name,
        amount: total,
        tx_ref,
        paymentOptions,
        meta: { order_id: order.id },
        title: "Maison Luxe",
        description: `Order #${order.id.slice(0, 8).toUpperCase()}`,
      });

      if (!popup || popup.status !== "successful" && popup.status !== "completed") {
        if (!popup) {
          setErrors({ form: "Payment was cancelled. Your order will not ship until payment completes." });
        } else {
          setErrors({ form: "Payment did not complete. Your order will not ship until payment completes." });
        }
        await supabase
          .from("orders")
          .update({ payment_status: "cancelled", status: "Pending Payment", payment_reference: tx_ref })
          .eq("id", order.id);
        setPlacing(false);
        return;
      }

      const verified = await verifyFlutterwave({
        data: {
          tx_ref: popup.tx_ref,
          transaction_id: popup.transaction_id,
          saveCard: method === "card",
          accessToken,
        },
      });
      await finalize(order.id, tx_ref, verified.success);
      if (!verified.success) {
        setErrors({ form: "Payment could not be verified. Your order will not ship." });
        setPlacing(false);
        return;
      }
      goToOrder(order.id, true);
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
    if (success) await clearCart();
  };

  const pollVirtualAccountPayment = async (orderId: string, tx_ref: string, accessToken: string) => {
    const start = Date.now();
    const TIMEOUT = 1000 * 60 * 30; // 30 min
    while (Date.now() - start < TIMEOUT) {
      await new Promise((r) => setTimeout(r, 8000));
      try {
        const verified = await verifyFlutterwave({ data: { tx_ref, accessToken } });
        if (verified.success) {
          await finalize(orderId, tx_ref, true);
          setWaitingForBankPayment(false);
          navigate({ to: "/orders/$id", params: { id: orderId } });
          return;
        }
      } catch {
        // ignore intermittent
      }
    }
    setWaitingForBankPayment(false);
    setErrors({ form: "Bank transfer not received in time. Order will not ship until payment is confirmed." });
  };

  const steps = [
    { n: 1, label: "Shipping", icon: MapPin },
    { n: 2, label: "Payment", icon: CreditCard },
    { n: 3, label: "Review", icon: Package },
  ];

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Secure Checkout</p>
        <h1 className="mt-3 font-serif text-5xl">Complete Your Order</h1>
      </header>

      <div className="mx-auto mb-12 flex max-w-2xl items-center justify-between">
        {steps.map((s, i) => {
          const done = step > s.n;
          const current = step === s.n;
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
              {i < steps.length - 1 && <div className={`mx-2 h-px flex-1 ${step > s.n ? "bg-primary" : "bg-border"}`} />}
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
                <Field label="City" value={shipForm.city} onChange={(v) => setShipForm({ ...shipForm, city: v })} error={errors.city} />
                <Field label="Postal Code" value={shipForm.zip} onChange={(v) => setShipForm({ ...shipForm, zip: v })} error={errors.zip} />
                <div className="sm:col-span-2">
                  <Field label="Country" value={shipForm.country} onChange={(v) => setShipForm({ ...shipForm, country: v })} />
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={() => validateShipping() && setStep(2)}
                  className="bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground transition-smooth hover:opacity-90"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-serif text-2xl">Payment Method</h2>

              {savedCards.length > 0 && (
                <div className="mt-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Saved Cards</p>
                  <div className="mt-2 space-y-2">
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

              <p className="mt-6 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Other methods</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <MethodCard
                  active={method === "card"}
                  onClick={() => {
                    setMethod("card");
                    setSelectedCardId(null);
                  }}
                  icon={<CreditCard className="h-5 w-5" />}
                  title="New Card"
                  subtitle="Visa · Mastercard · Verve"
                  logos={[CARD_BRAND_LOGOS.visa, CARD_BRAND_LOGOS.mastercard, CARD_BRAND_LOGOS.verve]}
                />
                <MethodCard
                  active={method === "bank_transfer"}
                  onClick={() => {
                    setMethod("bank_transfer");
                    setSelectedCardId(null);
                  }}
                  icon={<Building2 className="h-5 w-5" />}
                  title="Bank Transfer"
                  subtitle="Dedicated account"
                />
                <MethodCard
                  active={method === "opay"}
                  onClick={() => {
                    setMethod("opay");
                    setSelectedCardId(null);
                  }}
                  icon={<Smartphone className="h-5 w-5" />}
                  title="Opay"
                  subtitle="Pay via Opay link"
                />
              </div>

              <p className="mt-6 text-[11px] text-muted-foreground">
                Payments are securely processed by Flutterwave. Your order will not ship until payment is confirmed.
              </p>

              <div className="mt-8 flex justify-between">
                <button type="button" onClick={() => setStep(1)} className="border border-border px-8 py-4 text-xs uppercase tracking-[0.25em] text-foreground hover:border-primary">
                  Back
                </button>
                <button type="button" onClick={() => setStep(3)} className="bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground hover:opacity-90">
                  Review Order
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-serif text-2xl">Review & Place Order</h2>
              <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <ReviewBlock title="Shipping To">
                  <p>{shipForm.name}</p>
                  <p>{shipForm.address}</p>
                  <p>
                    {shipForm.city}, {shipForm.zip}
                  </p>
                  <p>{shipForm.country}</p>
                </ReviewBlock>
                <ReviewBlock title="Payment">
                  {method === "saved_card" && selectedCardId ? (
                    (() => {
                      const c = savedCards.find((s) => s.id === selectedCardId);
                      return c ? (
                        <p className="flex items-center gap-2">
                          {brandLogo(c.brand) && <img src={brandLogo(c.brand)!} alt={c.brand} className="h-5 w-8 object-contain" />}
                          Saved {c.brand} •••• {c.last4}
                        </p>
                      ) : (
                        <p>Saved card</p>
                      );
                    })()
                  ) : method === "bank_transfer" ? (
                    <p>Bank Transfer (dedicated account)</p>
                  ) : method === "opay" ? (
                    <p>Opay paylink</p>
                  ) : (
                    <p>New Card</p>
                  )}
                </ReviewBlock>
              </div>

              {waitingForBankPayment && virtualAccount && (
                <div className="mt-6 border border-primary/40 bg-primary/5 p-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-primary">Transfer To This Dedicated Account</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Detail label="Bank" value={virtualAccount.bank_name} />
                    <Detail label="Account Number" value={virtualAccount.account_number} copyable />
                    <Detail label="Amount" value={`₦${virtualAccount.amount.toLocaleString()}`} />
                    <Detail label="Account Name" value={virtualAccount.account_name} />
                    <Detail label="Expires" value={virtualAccount.expiry_date} />
                  </div>
                  <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Waiting for payment… Your order will not ship until we confirm the transfer.
                  </p>
                </div>
              )}

              {errors.form && <p className="mt-4 text-xs text-destructive">{errors.form}</p>}
              <div className="mt-8 flex justify-between">
                <button type="button" onClick={() => setStep(2)} className="border border-border px-8 py-4 text-xs uppercase tracking-[0.25em] text-foreground hover:border-primary">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={placing || waitingForBankPayment}
                  className="flex items-center gap-2 bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold hover:opacity-90 disabled:opacity-60"
                >
                  {(placing || waitingForBankPayment) && <Loader2 className="h-4 w-4 animate-spin" />}
                  {placing
                    ? "Processing…"
                    : waitingForBankPayment
                      ? "Awaiting Transfer…"
                      : `Pay ₦${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </button>
              </div>
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
                <span>₦{(product.price * quantity).toLocaleString()}</span>
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

function MethodCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
  logos,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  logos?: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-2 border p-4 text-left transition-smooth ${
        active ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary/60"
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span className="text-xs uppercase tracking-[0.2em]">{title}</span>
      </span>
      <span className="text-[10px] text-muted-foreground">{subtitle}</span>
      {logos && (
        <span className="mt-1 flex items-center gap-1.5">
          {logos.map((l) => (
            <img key={l} src={l} alt="" className="h-4 w-7 object-contain" />
          ))}
        </span>
      )}
    </button>
  );
}

function Detail({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
  const copy = () => navigator.clipboard.writeText(value);
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p className="text-sm font-medium text-foreground">{value}</p>
        {copyable && (
          <button type="button" onClick={copy} aria-label="Copy" className="text-muted-foreground hover:text-primary">
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
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
