import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import type { Product } from "@/lib/products";
import { useStore } from "@/lib/store";
import { effectivePrice, hasDiscount, savings, formatNaira } from "@/lib/price";

export function ProductCard({ product }: { product: Product }) {
  const { wishlist, toggleWishlist } = useStore();
  const liked = wishlist.includes(product.id);

  return (
    <div className="group relative">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="hover-lift block overflow-hidden bg-card"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-muted">
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-smooth group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 transition-smooth group-hover:opacity-100" />
        </div>
        <div className="p-5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {product.brand}
          </p>
          <h3 className="mt-2 font-serif text-xl text-foreground">{product.name}</h3>
          <div className="mt-3 flex items-baseline gap-2">
            <p className="text-sm text-primary">{formatNaira(effectivePrice(product))}</p>
            {hasDiscount(product) && (
              <p className="text-xs text-muted-foreground line-through">{formatNaira(product.price)}</p>
            )}
          </div>
          {hasDiscount(product) && (
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-primary/80">
              Save {formatNaira(savings(product))}
            </p>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          toggleWishlist(product.id);
        }}
        className={`absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 backdrop-blur transition-smooth hover:bg-background ${
          liked ? "text-primary" : "text-foreground"
        }`}
        aria-label="Toggle wishlist"
      >
        <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
      </button>
    </div>
  );
}
