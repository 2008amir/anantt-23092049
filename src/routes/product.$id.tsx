import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Heart, Minus, Plus, ShieldCheck, Truck, RotateCcw, Sparkles, Loader2, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Stars } from "@/components/Stars";
import { ProductCard } from "@/components/ProductCard";
import { ProductGallery } from "@/components/ProductGallery";
import { fetchProduct, fetchProductsByIds, type Product } from "@/lib/products";
import { similarProducts } from "@/lib/ai.functions";
import { useStore } from "@/lib/store";
import { Recommend } from "@/components/Recommend";
import { flyToCart } from "@/components/CartBubble";
import { effectivePrice, hasDiscount, savings, formatNaira } from "@/lib/price";

export const Route = createFileRoute("/product/$id")({
  loader: async ({ params }): Promise<{ product: Product }> => {
    const product = await fetchProduct(params.id);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.name} — Luxe Sparkles` },
          { name: "description", content: loaderData.product.description },
          { property: "og:title", content: `${loaderData.product.name} — Luxe Sparkles` },
          { property: "og:description", content: loaderData.product.description },
          { property: "og:image", content: loaderData.product.image },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="container mx-auto px-6 py-24 text-center">
      <h1 className="font-serif text-4xl">Piece not found</h1>
      <Link to="/shop" className="mt-6 inline-block text-primary underline">Return to shop</Link>
    </div>
  ),
  errorComponent: ({ error }: { error: Error }) => (
    <div className="container mx-auto px-6 py-24 text-center">
      <h1 className="font-serif text-4xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Link to="/shop" className="mt-6 inline-block text-primary underline">Return to shop</Link>
    </div>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData() as { product: Product };
  const { addToCart, toggleWishlist, wishlist } = useStore();
  const [qty, setQty] = useState(1);
  const liked = wishlist.includes(product.id);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const hasColors = product.colors.length > 0;
  const hasSizes = product.sizes.length > 0;
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [variantError, setVariantError] = useState<string | null>(null);

  const [similar, setSimilar] = useState<Product[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarLoaded, setSimilarLoaded] = useState(false);

  // Reset when product changes
  useEffect(() => {
    setSimilar([]);
    setSimilarLoaded(false);
    setSelectedColor("");
    setSelectedSize("");
    setVariantError(null);
  }, [product.id]);

  const findSimilar = async () => {
    setLoadingSimilar(true);
    try {
      const { ids } = await similarProducts({ data: { productId: product.id } });
      const items = await fetchProductsByIds(ids);
      setSimilar(items);
      setSimilarLoaded(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSimilar(false);
    }
  };

  const handleAddToCart = () => {
    if (product.stock <= 0) {
      setVariantError("This piece is currently out of stock.");
      return;
    }
    if (qty > product.stock) {
      setVariantError(`Only ${product.stock} available in stock.`);
      return;
    }
    if (hasColors && !selectedColor) {
      setVariantError("Please select a color before adding to cart.");
      return;
    }
    if (hasSizes && !selectedSize) {
      setVariantError("Please select a size before adding to cart.");
      return;
    }
    setVariantError(null);
    flyToCart(imgRef.current, product.image);
    const variant =
      hasColors || hasSizes
        ? {
            ...(hasColors ? { color: selectedColor } : {}),
            ...(hasSizes ? { size: selectedSize } : {}),
          }
        : null;
    void addToCart(product.id, qty, variant);
  };

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
        <ProductGallery ref={imgRef} images={product.images} alt={product.name} />

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">{product.brand}</p>
          <h1 className="mt-3 font-serif text-5xl text-foreground">{product.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <Stars rating={product.rating} />
            <span className="text-sm text-muted-foreground">{product.rating} · {product.reviewCount} reviews</span>
          </div>
          <div className="mt-6">
            {product.stock > 0 ? (
              <p className={`text-[10px] uppercase tracking-[0.25em] ${product.stock <= 5 ? "text-destructive" : "text-muted-foreground"}`}>
                {product.stock <= 5 ? `Only ${product.stock} left in stock` : `${product.stock} in stock`}
              </p>
            ) : (
              <p className="text-[10px] uppercase tracking-[0.25em] text-destructive">Out of stock</p>
            )}
            <div className="mt-2 flex items-baseline gap-4">
              <p className="font-serif text-3xl text-gold-gradient">{formatNaira(effectivePrice(product))}</p>
              {hasDiscount(product) && (
                <>
                  <p className="font-serif text-xl text-muted-foreground line-through">{formatNaira(product.price)}</p>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-primary">
                    Save {formatNaira(savings(product))}
                  </span>
                </>
              )}
            </div>
          </div>
          <p className="mt-6 leading-relaxed text-muted-foreground">{product.description}</p>

          <ul className="mt-6 space-y-2">
            {product.details.map((d) => (
              <li key={d} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {d}
              </li>
            ))}
          </ul>

          {/* AI Find Similar */}
          <button
            type="button"
            onClick={() => void findSimilar()}
            disabled={loadingSimilar}
            className="mt-6 inline-flex items-center gap-2 border border-primary/50 bg-primary/5 px-5 py-3 text-xs uppercase tracking-[0.25em] text-primary transition-smooth hover:bg-primary/10 disabled:opacity-60"
          >
            {loadingSimilar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {loadingSimilar ? "Finding similar…" : "Find similar pieces"}
          </button>

          {/* Variant selectors (only when admin enabled them) */}
          {(hasColors || hasSizes) && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {hasColors && (
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Color</span>
                  <select
                    value={selectedColor}
                    onChange={(e) => { setSelectedColor(e.target.value); setVariantError(null); }}
                    className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary"
                  >
                    <option value="">Select preferred color…</option>
                    {product.colors.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
              {hasSizes && (
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Size</span>
                  <select
                    value={selectedSize}
                    onChange={(e) => { setSelectedSize(e.target.value); setVariantError(null); }}
                    className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary"
                  >
                    <option value="">Select preferred size…</option>
                    {product.sizes.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {variantError && (
            <p className="mt-3 text-xs text-destructive">{variantError}</p>
          )}

          <div className="mt-6 flex items-center gap-4">
            <div className="flex items-center border border-border">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="p-3 text-muted-foreground transition-smooth hover:text-primary disabled:opacity-40 disabled:hover:text-muted-foreground" aria-label="Decrease">
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-10 text-center text-sm">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(product.stock || q, q + 1))}
                disabled={product.stock > 0 && qty >= product.stock}
                className="p-3 text-muted-foreground transition-smooth hover:text-primary disabled:opacity-40 disabled:hover:text-muted-foreground"
                aria-label="Increase"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
              className="flex-1 bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
            </button>
            <button
              type="button"
              onClick={() => void toggleWishlist(product.id)}
              className={`flex h-14 w-14 items-center justify-center border transition-smooth ${
                liked ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-primary"
              }`}
              aria-label="Wishlist"
            >
              <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
            </button>
          </div>

          <div className="mt-10 grid gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="flex items-start gap-2"><Truck className="mt-0.5 h-4 w-4 text-primary" /><span>Complimentary shipping over ₦1,000</span></div>
            <div className="flex items-start gap-2"><RotateCcw className="mt-0.5 h-4 w-4 text-primary" /><span>30-day considered returns</span></div>
            <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 text-primary" /><span>Authenticity guaranteed</span></div>
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
          <>
            <div className="grid gap-6 md:grid-cols-2">
              {product.reviews.slice(0, 6).map((r) => (
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
            {product.reviews.length > 6 && (
              <Link
                to="/product/$id/reviews"
                params={{ id: product.id }}
                className="mt-8 flex items-center justify-center gap-2 border border-border bg-card/50 px-6 py-4 text-xs uppercase tracking-[0.25em] text-foreground transition-smooth hover:border-primary hover:text-primary"
              >
                <span>+{product.reviews.length - 6} more reviews</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </>
        )}
      </section>

      {/* AI Similar (replaces 'You May Also Consider') */}
      {similarLoaded && similar.length > 0 && (
        <section className="mt-24">
          <div className="mb-8 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs uppercase tracking-[0.3em] text-primary">AI Curated</p>
          </div>
          <h2 className="mb-8 font-serif text-3xl">Similar Pieces</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      <Recommend />
    </div>
  );
}
