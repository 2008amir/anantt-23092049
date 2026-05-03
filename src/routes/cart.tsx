import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Minus, Plus, X } from "lucide-react";
import { useStore, useCartTotal, useProducts } from "@/lib/store";
import { Recommend } from "@/components/Recommend";
import { effectivePrice, hasDiscount, formatNaira } from "@/lib/price";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — Luxe Sparkles" }] }),
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const { updateCartQty, removeFromCart, clearCart } = useStore();
  const { products } = useProducts();
  const { items, subtotal, shipping, tax, total } = useCartTotal(products);

  // Defensive cleanup: clear any lingering cart-related browser storage
  // when the user lands on /cart. Cart state lives in the database only.
  useEffect(() => {
    try {
      sessionStorage.removeItem("checkout_snapshot");
      localStorage.removeItem("cart");
      localStorage.removeItem("cart_items");
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleProceedCheckout = async (e: React.MouseEvent) => {
    e.preventDefault();
    // Snapshot cart for the checkout page, then clear so /cart shows empty.
    try {
      sessionStorage.setItem(
        "checkout_snapshot",
        JSON.stringify(
          items.map((i) => ({
            product_id: i.product.id,
            quantity: i.quantity,
            variant: i.variant ?? null,
          })),
        ),
      );
    } catch {
      // ignore storage errors
    }
    await clearCart();
    navigate({ to: "/checkout" });
  };

  if (items.length === 0) {
    return (
      <>
        <div className="container mx-auto flex min-h-[60vh] flex-col items-center justify-center px-6 py-24 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Your Cart</p>
          <h1 className="mt-4 font-serif text-5xl">Awaiting curation.</h1>
          <p className="mt-4 max-w-md text-muted-foreground">Begin assembling your collection from our curated atelier.</p>
          <Link to="/shop" className="mt-10 inline-flex bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground">Explore Collection</Link>
        </div>
        <Recommend />
      </>
    );
  }

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Your Selection</p>
        <h1 className="mt-3 font-serif text-5xl">Shopping Cart</h1>
      </header>

      <div className="grid gap-12 lg:grid-cols-[1fr_400px]">
        <div className="divide-y divide-border border-y border-border">
          {items.map(({ product, quantity, variant }) => (
            <div key={product.id} className="flex gap-6 py-6">
              <Link to="/product/$id" params={{ id: product.id }} className="block w-32 shrink-0 overflow-hidden bg-card">
                <img src={product.image} alt={product.name} loading="lazy" decoding="async" className="aspect-square h-full w-full object-cover" />
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{product.brand}</p>
                    <Link to="/product/$id" params={{ id: product.id }} className="mt-1 block font-serif text-xl text-foreground hover:text-primary">{product.name}</Link>
                    {variant && (variant.color || variant.size) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {variant.color && <span>Color: <span className="text-foreground">{variant.color}</span></span>}
                        {variant.color && variant.size && <span> · </span>}
                        {variant.size && <span>Size: <span className="text-foreground">{variant.size}</span></span>}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => void removeFromCart(product.id)} className="text-muted-foreground transition-smooth hover:text-destructive" aria-label="Remove">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-auto flex items-end justify-between pt-4">
                  <div className="flex items-center border border-border">
                    <button type="button" onClick={() => void updateCartQty(product.id, quantity - 1)} className="p-2 text-muted-foreground hover:text-primary" aria-label="Decrease"><Minus className="h-3 w-3" /></button>
                    <span className="w-10 text-center text-sm">{quantity}</span>
                    <button type="button" onClick={() => void updateCartQty(product.id, quantity + 1)} className="p-2 text-muted-foreground hover:text-primary" aria-label="Increase"><Plus className="h-3 w-3" /></button>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-xl text-primary">{formatNaira(effectivePrice(product) * quantity)}</p>
                    {hasDiscount(product) && (
                      <p className="text-xs text-muted-foreground line-through">{formatNaira(product.price * quantity)}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="h-fit border border-border bg-card/50 p-8">
          <h2 className="font-serif text-2xl">Order Summary</h2>
          <div className="mt-6 space-y-3 border-b border-border pb-6 text-sm">
            <Row label="Subtotal" value={`₦${subtotal.toLocaleString()}`} />
            <Row label="Shipping" value={shipping === 0 ? "Complimentary" : `₦${shipping}`} />
            <Row label="Estimated Tax" value={`₦${tax.toFixed(2)}`} />
          </div>
          <div className="mt-6 flex justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</span>
            <span className="font-serif text-2xl text-gold-gradient">₦{total.toFixed(2)}</span>
          </div>
          <Link to="/checkout" onClick={handleProceedCheckout} className="mt-8 block w-full bg-gold-gradient py-4 text-center text-xs uppercase tracking-[0.25em] text-primary-foreground transition-smooth hover:opacity-90">Proceed to Checkout</Link>
          <Link to="/shop" className="mt-3 block w-full border border-border py-4 text-center text-xs uppercase tracking-[0.25em] text-foreground transition-smooth hover:border-primary hover:text-primary">Continue Shopping</Link>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="text-foreground">{value}</span></div>;
}
