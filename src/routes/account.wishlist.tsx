import { createFileRoute, Link } from "@tanstack/react-router";
import { PRODUCTS } from "@/lib/products";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account/wishlist")({
  component: AccountWishlist,
});

function AccountWishlist() {
  const { wishlist, toggleWishlist } = useStore();
  const items = PRODUCTS.filter((p) => wishlist.includes(p.id));

  return (
    <div>
      <h2 className="font-serif text-3xl">Saved Pieces</h2>
      {items.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">Nothing saved yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-4 border border-border p-4">
              <Link to="/product/$id" params={{ id: p.id }} className="block">
                <img src={p.image} alt={p.name} className="h-16 w-16 object-cover" />
              </Link>
              <div className="flex-1">
                <Link to="/product/$id" params={{ id: p.id }} className="font-serif text-lg hover:text-primary">{p.name}</Link>
                <p className="text-xs text-muted-foreground">{p.brand}</p>
              </div>
              <p className="text-primary">${p.price.toLocaleString()}</p>
              <button
                type="button"
                onClick={() => toggleWishlist(p.id)}
                className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
