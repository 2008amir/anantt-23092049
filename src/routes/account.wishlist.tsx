import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useStore, useProductsByIds } from "@/lib/store";
import { Recommend } from "@/components/Recommend";
import { effectivePrice, hasDiscount, formatNaira } from "@/lib/price";

export const Route = createFileRoute("/account/wishlist")({
  component: AccountWishlist,
});

function AccountWishlist() {
  const { wishlist, toggleWishlist } = useStore();
  const { products: items, loading } = useProductsByIds(wishlist);

  return (
    <><div>
      <h2 className="font-serif text-3xl">Saved Pieces</h2>
      {loading ? (
        <div className="mt-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">Nothing saved yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-4 border border-border p-4">
              <Link to="/product/$id" params={{ id: p.id }} className="block">
                <img src={p.image} alt={p.name} loading="lazy" decoding="async" className="h-16 w-16 object-cover" />
              </Link>
              <div className="flex-1">
                <Link to="/product/$id" params={{ id: p.id }} className="font-serif text-lg hover:text-primary">{p.name}</Link>
                <p className="text-xs text-muted-foreground">{p.brand}</p>
              </div>
              <div className="text-right">
                <p className="text-primary">{formatNaira(effectivePrice(p))}</p>
                {hasDiscount(p) && (
                  <p className="text-xs text-muted-foreground line-through">{formatNaira(p.price)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void toggleWishlist(p.id)}
                className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div><Recommend /></>
  );
}
