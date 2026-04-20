import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PRODUCTS, CATEGORIES, type Category } from "@/lib/products";

type ShopSearch = { category?: Category; q?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    category: (search.category as Category) || undefined,
    q: (search.q as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Categories — Maison Luxe" },
      {
        name: "description",
        content: "Shop by category: timepieces, leather goods, fragrance, audio, home, and accessories.",
      },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { category, q } = Route.useSearch();
  const active: Category | "Featured" = category ?? "Featured";

  const filtered = useMemo(() => {
    let list = [...PRODUCTS];
    if (category) list = list.filter((p) => p.category === category);
    if (q) {
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter((p) => {
        const haystack = [
          p.name,
          p.brand,
          p.category,
          p.description,
          ...(p.details ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return terms.every((t) => haystack.includes(t));
      });
    }
    return list;
  }, [category, q]);

  return (
    <div className="bg-background">

      <div className="mx-auto flex max-w-5xl">
        {/* Vertical category sidebar */}
        <aside className="w-28 shrink-0 border-r border-border/40 md:w-36">
          <div className="py-2">
            <Link
              to="/shop"
              search={{}}
              className={`relative block px-3 py-4 text-xs leading-tight transition-smooth ${
                active === "Featured"
                  ? "bg-card font-medium text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active === "Featured" && <span className="absolute left-0 top-2 h-8 w-0.5 bg-primary" />}
              Featured
            </Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c}
                to="/shop"
                search={{ category: c }}
                className={`relative block px-3 py-4 text-xs leading-tight transition-smooth ${
                  active === c
                    ? "bg-card font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active === c && <span className="absolute left-0 top-2 h-8 w-0.5 bg-primary" />}
                {c}
              </Link>
            ))}
          </div>
        </aside>

        {/* Right pane */}
        <div className="flex-1 px-3 py-4">
          <h2 className="mb-4 font-serif text-xl text-foreground">
            Shop by category
          </h2>

          {/* Category tile grid (always show all to mimic browse) */}
          <div className="mb-8 grid grid-cols-3 gap-3">
            {CATEGORIES.map((c) => {
              const sample = PRODUCTS.find((p) => p.category === c);
              return (
                <Link
                  key={c}
                  to="/shop"
                  search={{ category: c }}
                  className="group block text-center"
                >
                  <div className="relative aspect-square overflow-hidden rounded-full border border-border bg-card transition-smooth group-hover:border-primary">
                    {sample && (
                      <img src={sample.image} alt={c} className="h-full w-full object-cover" />
                    )}
                    {(c === "Timepieces" || c === "Fragrance") && (
                      <span className="absolute -right-1 -top-1 bg-gold-gradient px-1.5 py-0.5 text-[8px] uppercase tracking-[0.15em] text-primary-foreground">
                        Hot
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] leading-tight text-foreground transition-smooth group-hover:text-primary">
                    {c}
                  </p>
                </Link>
              );
            })}
          </div>

          {/* Filtered results when a category is chosen */}
          {(category || q) && (
            <>
              <h3 className="mb-3 font-serif text-lg text-foreground">
                {category ?? "Search results"} <span className="text-xs text-muted-foreground">({filtered.length})</span>
              </h3>
              {filtered.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No pieces match.{" "}
                  <Link to="/shop" search={{}} className="text-primary underline">
                    Clear filters
                  </Link>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {filtered.map((p) => {
                    const original = Math.round(p.price * 1.4);
                    return (
                      <Link
                        key={p.id}
                        to="/product/$id"
                        params={{ id: p.id }}
                        className="group block border border-border bg-card transition-smooth hover:border-primary"
                      >
                        <div className="aspect-square overflow-hidden">
                          <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-smooth group-hover:scale-105" />
                        </div>
                        <div className="space-y-1 p-2">
                          <p className="line-clamp-2 text-[11px] leading-tight text-foreground">{p.name}</p>
                          <div className="flex items-baseline gap-1">
                            <span className="font-serif text-sm text-gold-gradient">${p.price.toLocaleString()}</span>
                            <span className="text-[9px] text-muted-foreground line-through">${original.toLocaleString()}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
