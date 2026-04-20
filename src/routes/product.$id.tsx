import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Heart, Minus, Plus, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Stars } from "@/components/Stars";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS, getProduct, type Product } from "@/lib/products";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/product/$id")({
  loader: ({ params }): { product: Product } => {
    const product = getProduct(params.id);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.name} — Maison Luxe` },
          { name: "description", content: loaderData.product.description },
          { property: "og:title", content: `${loaderData.product.name} — Maison Luxe` },
          { property: "og:description", content: loaderData.product.description },
          { property: "og:image", content: loaderData.product.image },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="container mx-auto px-6 py-24 text-center">
      <h1 className="font-serif text-4xl">Piece not found</h1>
      <Link to="/shop" className="mt-6 inline-block text-primary underline">
        Return to shop
      </Link>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const [qty, setQty] = useState(1);
  const liked = wishlist.includes(product.id);
  const related = PRODUCTS.filter((p) => p.id !== product.id && p.category === product.category).slice(0, 3);

  return (
    <div className="container mx-auto px-6 py-12">
      <nav className="mb-8 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        <Link to="/" className="hover:text-primary">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/shop" className="hover:text-primary">Shop</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2">
        <div className="aspect-[4/5] overflow-hidden bg-card shadow-luxury">
          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{product.brand}</p>
          <h1 className="mt-3 font-serif text-5xl text-foreground">{product.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <Stars rating={product.rating} />
            <span className="text-sm text-muted-foreground">
              {product.rating} · {product.reviewCount} reviews
            </span>
          </div>
          <p className="mt-6 font-serif text-3xl text-gold-gradient">${product.price.toLocaleString()}</p>
          <p className="mt-6 leading-relaxed text-muted-foreground">{product.description}</p>

          <ul className="mt-6 space-y-2">
            {product.details.map((d) => (
              <li key={d} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {d}
              </li>
            ))}
          </ul>

          {/* Qty + Actions */}
          <div className="mt-10 flex items-center gap-4">
            <div className="flex items-center border border-border">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="p-3 text-muted-foreground transition-smooth hover:text-primary"
                aria-label="Decrease"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-10 text-center text-sm">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="p-3 text-muted-foreground transition-smooth hover:text-primary"
                aria-label="Increase"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => addToCart(product.id, qty)}
              className="flex-1 bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90"
            >
              Add to Cart
            </button>
            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              className={`flex h-14 w-14 items-center justify-center border transition-smooth ${
                liked ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-primary"
              }`}
              aria-label="Wishlist"
            >
              <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
            </button>
          </div>

          <div className="mt-10 grid gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 text-primary" />
              <span>Complimentary shipping over $1,000</span>
            </div>
            <div className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 h-4 w-4 text-primary" />
              <span>30-day considered returns</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <span>Authenticity guaranteed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <section className="mt-24">
        <div className="mb-8 flex items-end justify-between border-b border-border pb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Reviews</p>
            <h2 className="mt-2 font-serif text-3xl">From the Collectors</h2>
          </div>
          <div className="text-right">
            <div className="font-serif text-4xl text-gold-gradient">{product.rating}</div>
            <Stars rating={product.rating} />
            <p className="mt-1 text-xs text-muted-foreground">{product.reviewCount} reviews</p>
          </div>
        </div>

        {product.reviews.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Be the first to share your experience.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {product.reviews.map((r) => (
              <article key={r.id} className="border border-border bg-card/50 p-6">
                <div className="flex items-center justify-between">
                  <Stars rating={r.rating} />
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{r.date}</span>
                </div>
                <h3 className="mt-3 font-serif text-xl">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                <p className="mt-4 text-xs uppercase tracking-[0.2em] text-primary">— {r.author}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="mb-8 font-serif text-3xl">You May Also Consider</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
