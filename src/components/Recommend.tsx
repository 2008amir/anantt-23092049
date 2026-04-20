import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { recommendations } from "@/lib/ai.functions";
import { fetchProductsByIds, type Product } from "@/lib/products";

// Pages where Recommend SHOULD appear
const SHOW_PREFIXES = [
  "/account/orders",
  "/account/notifications",
  "/account/wishlist",
  "/account/earn",
  "/cart",
  "/wishlist",
  "/orders",
  "/search",
];

export function Recommend() {
  const { location } = useRouterState();
  const [products, setProducts] = useState<Product[]>([]);
  const [theme, setTheme] = useState("Recommended for You");
  const [loading, setLoading] = useState(true);

  const visible = SHOW_PREFIXES.some(
    (prefix) => location.pathname === prefix || location.pathname.startsWith(prefix + "/"),
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    recommendations()
      .then(async (res) => {
        if (cancelled) return;
        setTheme(res.theme || "Recommended for You");
        const items = await fetchProductsByIds(res.ids);
        if (!cancelled) setProducts(items);
      })
      .catch((e) => console.error("recommend", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <section className="mx-auto mt-10 max-w-5xl border-t border-border/40 px-3 pt-8 pb-4">
      <header className="mb-4">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Recommend</p>
        <h2 className="mt-1 font-serif text-xl text-foreground">{theme}</h2>
      </header>

      {loading && products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Curating…</p>
        </div>
      ) : products.length === 0 ? null : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {products.map((p) => {
            const original = Math.round(p.price * 1.4);
            return (
              <Link
                key={p.id}
                to="/product/$id"
                params={{ id: p.id }}
                className="group block border border-border bg-card transition-smooth hover:border-primary"
              >
                <div className="aspect-square overflow-hidden">
                  <img
                    src={p.image}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-smooth group-hover:scale-105"
                  />
                </div>
                <div className="space-y-1 p-2">
                  <p className="line-clamp-2 text-[11px] leading-tight text-foreground">{p.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif text-sm text-gold-gradient">
                      ${p.price.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-muted-foreground line-through">
                      ${original.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
