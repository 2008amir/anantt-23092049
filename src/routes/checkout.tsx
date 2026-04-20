import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, CreditCard, MapPin, Package } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PRODUCTS } from "@/lib/products";
import { useStore, useCartTotal } from "@/lib/store";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Maison Luxe" }] }),
  component: Checkout,
});

type Step = 1 | 2 | 3;

function Checkout() {
  const navigate = useNavigate();
  const { placeOrder } = useStore();
  const { items, subtotal, shipping, tax, total } = useCartTotal(PRODUCTS);
  const [step, setStep] = useState<Step>(1);
  const [shipForm, setShipForm] = useState({ name: "", email: "", address: "", city: "", zip: "", country: "United States" });
  const [payForm, setPayForm] = useState({ method: "card", number: "", name: "", expiry: "", cvc: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-4xl">Your cart is empty</h1>
        <Link to="/shop" className="mt-6 inline-block text-primary underline">Return to shop</Link>
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

  const validatePayment = () => {
    const e: Record<string, string> = {};
    if (!payForm.method) e.method = "Select a payment method";
    if (payForm.method === "card") {
      if (!payForm.number || payForm.number.replace(/\s/g, "").length < 13) e.number = "Valid card number required";
      if (!payForm.name) e.cardName = "Required";
      if (!payForm.expiry) e.expiry = "MM/YY required";
      if (!payForm.cvc || payForm.cvc.length < 3) e.cvc = "CVC required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validatePayment()) return;
    const order = placeOrder({
      items: items.map((i) => ({
        productId: i.product.id,
        quantity: i.quantity,
        price: i.product.price,
        name: i.product.name,
        image: i.product.image,
      })),
      total,
      shipping: { name: shipForm.name, address: shipForm.address, city: shipForm.city, zip: shipForm.zip, country: shipForm.country },
    });
    navigate({ to: "/orders/$id", params: { id: order.id } });
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

      {/* Stepper */}
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
                <span className={`mt-2 text-xs uppercase tracking-[0.2em] ${current || done ? "text-primary" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-2 h-px flex-1 ${step > s.n ? "bg-primary" : "bg-border"}`} />
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
              <p className="mt-2 text-sm text-muted-foreground">Required to complete your order.</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { id: "card", label: "Credit Card" },
                  { id: "paypal", label: "PayPal" },
                  { id: "apple", label: "Apple Pay" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPayForm({ ...payForm, method: m.id })}
                    className={`border p-4 text-xs uppercase tracking-[0.2em] transition-smooth ${
                      payForm.method === m.id
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {payForm.method === "card" && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Card Number" placeholder="1234 5678 9012 3456" value={payForm.number} onChange={(v) => setPayForm({ ...payForm, number: v })} error={errors.number} />
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Cardholder Name" value={payForm.name} onChange={(v) => setPayForm({ ...payForm, name: v })} error={errors.cardName} />
                  </div>
                  <Field label="Expiry (MM/YY)" placeholder="12/27" value={payForm.expiry} onChange={(v) => setPayForm({ ...payForm, expiry: v })} error={errors.expiry} />
                  <Field label="CVC" placeholder="123" value={payForm.cvc} onChange={(v) => setPayForm({ ...payForm, cvc: v })} error={errors.cvc} />
                </div>
              )}
              {payForm.method !== "card" && (
                <p className="mt-6 rounded-sm border border-border bg-background p-6 text-sm text-muted-foreground">
                  You'll be redirected to {payForm.method === "paypal" ? "PayPal" : "Apple Pay"} after review.
                </p>
              )}

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="border border-border px-8 py-4 text-xs uppercase tracking-[0.25em] text-foreground hover:border-primary"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => validatePayment() && setStep(3)}
                  className="bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground hover:opacity-90"
                >
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
                  <p>{shipForm.city}, {shipForm.zip}</p>
                  <p>{shipForm.country}</p>
                </ReviewBlock>
                <ReviewBlock title="Payment">
                  <p className="capitalize">{payForm.method === "card" ? `Card ending ${payForm.number.replace(/\s/g, "").slice(-4)}` : payForm.method}</p>
                </ReviewBlock>
              </div>

              <div className="mt-8 divide-y divide-border border-y border-border">
                {items.map(({ product, quantity }) => (
                  <div key={product.id} className="flex gap-4 py-4">
                    <img src={product.image} alt={product.name} className="h-20 w-20 object-cover" />
                    <div className="flex-1">
                      <p className="font-serif text-lg">{product.name}</p>
                      <p className="text-xs text-muted-foreground">Qty {quantity}</p>
                    </div>
                    <p className="text-primary">${(product.price * quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="border border-border px-8 py-4 text-xs uppercase tracking-[0.25em] text-foreground hover:border-primary"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold hover:opacity-90"
                >
                  Place Order — ${total.toFixed(2)}
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
                <span>{product.name} × {quantity}</span>
                <span>${(product.price * quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2 border-t border-border pt-6 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>${subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Shipping</span><span>{shipping === 0 ? "Free" : `$${shipping}`}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
            <span className="font-serif text-2xl text-gold-gradient">${total.toFixed(2)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, error, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string; type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-2 w-full border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary ${
          error ? "border-destructive" : "border-border"
        }`}
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
