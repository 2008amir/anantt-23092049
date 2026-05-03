import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { type Product } from "@/lib/products";
import { textSearch } from "@/lib/ai.functions";
import { useCategories } from "@/hooks/use-categories";
import { useProducts } from "@/lib/store";
import { effectivePrice, hasDiscount, formatNaira } from "@/lib/price";


type ShopSearch = { category?: string; q?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    category: (search.category as string) || undefined,
    q: (search.q as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop — Luxe Sparkles" },
      { name: "description", content: "Browse a curated selection of luxury objects." },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { category, q } = Route.useSearch();
  const { categories: aiCategories, loading: catsLoading } = useCategories();
  const { products } = useProducts();

  const [aiIds, setAiIds] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const localFiltered = useMemo<Product[]>(() => {
    if (!q) return [];
    const terms = q.toLowerCase().split(/\s+/).filter((t: string) => Boolean(t));
    return products.filter((p) => {
      const haystack = [p.name, p.brand, p.category, p.description, ...(p.details ?? [])]
        .join(" ").toLowerCase();
      return terms.every((t: string) => haystack.includes(t));
    });
  }, [q, products]);

  useEffect(() => {
    if (!q) { setAiIds(null); setAiError(null); return; }
    let cancelled = false;
    setAiLoading(true); setAiError(null);
    textSearch({ data: { query: q } })
      .then((res: { ids: string[] }) => { if (!cancelled) setAiIds(res.ids); })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error(e);
        setAiError(e instanceof Error ? e.message : "Search failed");
        setAiIds(null);
      })
      .finally(() => { if (!cancelled) setAiLoading(false); });
    return () => { cancelled = true; };
  }, [q]);

  const searchResults = useMemo<Product[]>(() => {
    if (!q) return [];
    const idSet = new Set<string>();
    const ordered: Product[] = [];
    if (aiIds) {
      for (const id of aiIds) {
        const p = products.find((x) => x.id === id);
        if (p && !idSet.has(p.id)) { idSet.add(p.id); ordered.push(p); }
      }
    }
    for (const p of localFiltered) {
      if (!idSet.has(p.id)) { idSet.add(p.id); ordered.push(p); }
    }
    return ordered;
  }, [q, aiIds, localFiltered, products]);

  const isSearching = Boolean(q);
  const activeCategory = !isSearching && category
    ? aiCategories.find((c) => c.name.toLowerCase() === category.toLowerCase())
    : null;
  const categoryProducts = activeCategory
    ? products.filter((p) => activeCategory.productIds.includes(p.id))
    : [];

  return (
    <div className="bg-background">
      <div className="mx-auto flex max-w-5xl">
        <aside className="w-28 shrink-0 border-r border-border/40 md:w-36">
          <div className="py-2">
            <Link
              to="/shop"
              search={{}}
              className={`relative block px-3 py-4 text-xs leading-tight transition-smooth ${
                !category && !q ? "bg-card font-medium text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {!category && !q && <span className="absolute left-0 top-2 h-8 w-0.5 bg-primary" />}
              All
            </Link>
            {catsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            ) : (
              aiCategories.map((c) => {
                const isActive = category?.toLowerCase() === c.name.toLowerCase();
                return (
                  <Link
                    key={c.name}
                    to="/shop"
                    search={{ category: c.name }}
                    className={`relative block px-3 py-4 text-xs leading-tight transition-smooth ${
                      isActive ? "bg-card font-medium text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-2 h-8 w-0.5 bg-primary" />}
                    {c.name}
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex-1 px-3 py-4">
          {isSearching ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-serif text-lg text-foreground">
                  Results for <span className="text-primary">"{q}"</span>{" "}
                  <span className="text-xs text-muted-foreground">({searchResults.length})</span>
                </h2>
                <Link to="/shop" search={{}} className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:border-primary hover:text-primary">Clear</Link>
              </div>
              {aiLoading && searchResults.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Searching…</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm text-muted-foreground">{aiError ?? "No pieces match your search."}</p>
                  <Link to="/shop" search={{}} className="mt-3 inline-block text-xs text-primary underline">Browse all</Link>
                </div>
              ) : (
                <ProductGrid products={searchResults} />
              )}
            </>
          ) : activeCategory ? (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="font-serif text-lg text-foreground">{activeCategory.name}{" "}<span className="text-xs text-muted-foreground">({categoryProducts.length})</span></h2>
                <Link to="/shop" search={{}} className="rounded-full border border-border px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:border-primary hover:text-primary">All collections</Link>
              </div>
              <ProductGrid products={categoryProducts} />
            </>
          ) : (
            <>
              <h2 className="mb-4 font-serif text-xl text-foreground">Collections</h2>
              {catsLoading ? (
                <div className="flex flex-col items-center gap-3 py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="text-xs text-muted-foreground">Curating collections…</p></div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {aiCategories.map((c) => {
                    const sample = products.find((p) => c.productIds.includes(p.id));
                    return (
                      <Link key={c.name} to="/shop" search={{ category: c.name }} className="group block text-center">
                        <div className="relative aspect-square overflow-hidden rounded-full border border-border bg-card transition-smooth group-hover:border-primary">
                          {sample && <img src={sample.image} alt={c.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                        </div>
                        <p className="mt-2 text-[11px] leading-tight text-foreground transition-smooth group-hover:text-primary">{c.name}</p>
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

function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {products.map((p) => {
        const showDiscount = hasDiscount(p);
        return (
          <Link key={p.id} to="/product/$id" params={{ id: p.id }} className="group block border border-border bg-card transition-smooth hover:border-primary">
            <div className="aspect-square overflow-hidden">
              <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-smooth group-hover:scale-105" />
            </div>
            <div className="space-y-1 p-2">
              <p className="line-clamp-2 text-[11px] leading-tight text-foreground">{p.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-sm text-gold-gradient">{formatNaira(effectivePrice(p))}</span>
                {showDiscount && (
                  <span className="text-[9px] text-muted-foreground line-through">{formatNaira(p.price)}</span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
