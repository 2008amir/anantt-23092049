import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, CreditCard, Loader2, MapPin, Package } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore, useCartTotal, useProducts } from "@/lib/store";
import { initPaystack, verifyPaystack } from "@/lib/paystack.functions";
import { openPaystackPopup } from "@/lib/paystack-popup";

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

function Checkout() {
  const navigate = useNavigate();
  const { user, clearCart } = useStore();
  const { products } = useProducts();
  const { items, subtotal, shipping, tax, total } = useCartTotal(products);
  const [step, setStep] = useState<Step>(1);
  const [shipForm, setShipForm] = useState({
    name: "",
    email: user?.email ?? "",
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

  const channelsFor = (m: PayMethod): string[] => {
    if (m === "bank_transfer") return ["bank_transfer"];
    if (m === "opay") return ["mobile_money", "ussd", "bank_transfer"];
    return ["card"];
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setErrors({});
    setPlacing(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Please sign in again to continue.");

      // 1. Create order in DB first (status pending)
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          subtotal,
          shipping,
          tax,
          total,
          status: "Processing",
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

      // 2. Trigger Paystack
      const callbackUrl = `${window.location.origin}/orders/${order.id}`;
      let reference: string | null = null;

      if (method === "saved_card" && selectedCardId) {
        const card = savedCards.find((c) => c.id === selectedCardId);
        if (!card) throw new Error("Saved card not found");
        const res = await initPaystack({
          data: {
            amount: total,
            email: shipForm.email,
            callbackUrl,
            authorization_code: card.authorization_code,
            metadata: { order_id: order.id },
            accessToken,
          },
        });
        reference = res.reference;
      } else {
        const res = await initPaystack({
          data: {
            amount: total,
            email: shipForm.email,
            callbackUrl,
            channels: channelsFor(method),
            metadata: { order_id: order.id },
            accessToken,
          },
        });
        if (res.mode !== "redirect") throw new Error("Unexpected init response");
        const popup = await openPaystackPopup({
          email: shipForm.email,
          amount: total,
          reference: res.reference,
          channels: channelsFor(method),
          metadata: { order_id: order.id },
        });
        if (!popup) {
          setErrors({ form: "Payment cancelled. You can retry from your order." });
          await supabase.from("orders").update({ payment_status: "cancelled" }).eq("id", order.id);
          setPlacing(false);
          navigate({ to: "/orders/$id", params: { id: order.id } });
          return;
        }
        reference = popup.reference;
      }

      // 3. Verify on server
      const verified = await verifyPaystack({
        data: { reference: reference!, saveCard: method === "card", accessToken },
      });
      await supabase
        .from("orders")
        .update({
          payment_reference: reference,
          payment_status: verified.success ? "paid" : "failed",
          status: verified.success ? "Paid" : "Payment Failed",
        })
        .eq("id", order.id);

      if (verified.success) await clearCart();
      navigate({ to: "/orders/$id", params: { id: order.id } });
    } catch (err) {
      console.error(err);
      setErrors({ form: err instanceof Error ? err.message : "Failed to place order" });
    } finally {
      setPlacing(false);
    }
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
                            <CreditCard className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
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
                {[
                  { id: "card" as const, label: "New Card" },
                  { id: "bank_transfer" as const, label: "Bank Transfer" },
                  { id: "opay" as const, label: "Opay / USSD" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMethod(m.id);
                      setSelectedCardId(null);
                    }}
                    className={`border p-4 text-xs uppercase tracking-[0.2em] transition-smooth ${
                      method === m.id ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <p className="mt-6 text-[11px] text-muted-foreground">
                Payments are securely processed by Paystack. You'll be prompted to enter card or bank details on the next step.
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
                      return c ? <p>Saved {c.brand} •••• {c.last4}</p> : <p>Saved card</p>;
                    })()
                  ) : method === "bank_transfer" ? (
                    <p>Bank Transfer</p>
                  ) : method === "opay" ? (
                    <p>Opay / USSD / Mobile</p>
                  ) : (
                    <p>New Card</p>
                  )}
                </ReviewBlock>
              </div>
              {errors.form && <p className="mt-4 text-xs text-destructive">{errors.form}</p>}
              <div className="mt-8 flex justify-between">
                <button type="button" onClick={() => setStep(2)} className="border border-border px-8 py-4 text-xs uppercase tracking-[0.25em] text-foreground hover:border-primary">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={placing}
                  className="flex items-center gap-2 bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold hover:opacity-90 disabled:opacity-60"
                >
                  {placing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {placing ? "Processing…" : `Pay ₦${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
