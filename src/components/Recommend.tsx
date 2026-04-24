import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { recommendations, personalizedFeed } from "@/lib/ai.functions";
import { fetchProducts, fetchProductsByIds, type Product } from "@/lib/products";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

// Pages where Recommend SHOULD appear
const SHOW_PREFIXES = [
  "/account/history",
  "/account/your-orders",
  "/account/notifications",
  "/account/wishlist",
  "/account/earn",
  "/cart",
  "/wishlist",
  "/orders",
  "/search",
  "/product",
];

export function Recommend() {
  const { location } = useRouterState();
  const { user, wishlist } = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [theme, setTheme] = useState("Recommended for You");
  const [loading, setLoading] = useState(true);

  const visible = SHOW_PREFIXES.some(
    (prefix) => location.pathname === prefix || location.pathname.startsWith(prefix + "/"),
  );

  // Stable key so we re-run when wishlist contents change, not just length.
  const wishlistKey = wishlist.slice().sort().join(",");

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);

    const TARGET = 6;

    // Fisher-Yates shuffle
    const shuffle = <T,>(arr: T[]): T[] => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };

    const run = async () => {
      // Always start from the live product catalog so removed / disabled
      // products never appear in recommendations.
      const catalog = await fetchProducts();
      if (cancelled) return;
      const allIds = catalog.map((p) => p.id);
      if (allIds.length === 0) {
        setProducts([]);
        return;
      }

      // 1) AI picks driven by what the user "wishes" (wishlist) + recent
      //    views/searches. These come first.
      let aiIds: string[] = [];
      let usedTheme = "Recommended for You";

      if (user) {
        const { data: interests } = await supabase
          .from("user_interests")
          .select("product_id, query, kind, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50);

        const viewedIds = (interests ?? [])
          .filter((r) => r.kind === "view" && r.product_id)
          .map((r) => r.product_id as string);
        const queries = (interests ?? [])
          .filter((r) => r.kind === "search" && r.query)
          .map((r) => r.query as string);

        // Treat wishlist items as the strongest "viewed" signal.
        const seedIds = Array.from(new Set([...wishlist, ...viewedIds]));

        if (seedIds.length > 0 || queries.length > 0) {
          try {
            const res = await personalizedFeed({
              data: { allIds, viewedIds: seedIds, queries },
            });
            if (cancelled) return;
            const validSet = new Set(allIds);
            // Never show the wishlist items themselves as "recommendations".
            const wishSet = new Set(wishlist);
            aiIds = (res.biasedIds && res.biasedIds.length > 0
              ? res.biasedIds
              : res.orderedIds
            )
              .filter((id) => validSet.has(id) && !wishSet.has(id));
            usedTheme = "Picked for You";
          } catch (e) {
            console.error("personalizedFeed", e);
          }
        }
      }

      // If still empty (no signals or AI failed), seed with the AI daily set.
      if (aiIds.length === 0) {
        try {
          const res = await recommendations();
          if (cancelled) return;
          const validSet = new Set(allIds);
          aiIds = (res.ids ?? []).filter((id) => validSet.has(id));
          usedTheme = res.theme || usedTheme;
        } catch (e) {
          console.error("recommendations", e);
        }
      }

      // 2) Fill the rest with random in-stock products from any category.
      const taken = new Set(aiIds);
      const remainingPool = shuffle(catalog.filter((p) => !taken.has(p.id)));
      const finalIds = [
        ...aiIds.slice(0, TARGET),
        ...remainingPool.slice(0, Math.max(0, TARGET - aiIds.length)).map((p) => p.id),
      ].slice(0, TARGET);

      const items = await fetchProductsByIds(finalIds);
      if (!cancelled) {
        setTheme(usedTheme);
        setProducts(items);
      }
    };

    run()
      .catch((e) => console.error("recommend", e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, user, wishlistKey]);

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
                      ₦{p.price.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-muted-foreground line-through">
                      ₦{original.toLocaleString()}
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
