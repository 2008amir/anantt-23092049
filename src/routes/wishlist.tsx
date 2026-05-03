import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { useStore, useProductsByIds } from "@/lib/store";
import { Recommend } from "@/components/Recommend";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Luxe Sparkles" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist } = useStore();
  const { products: items, loading } = useProductsByIds(wishlist);

  return (
    <>
      <div className="container mx-auto px-6 py-16">
        <header className="mb-12 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Saved Pieces</p>
          <h1 className="mt-3 font-serif text-5xl">Your Wishlist</h1>
        </header>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-muted-foreground">Your wishlist is currently empty.</p>
            <Link to="/shop" className="mt-6 inline-flex bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground">Discover Pieces</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
      <Recommend />
    </>
  );
}
