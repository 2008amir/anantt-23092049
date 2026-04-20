import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, ShieldCheck, ShoppingBag, Flame, Star, Award, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore, useProducts } from "@/lib/store";
import { useAICategories } from "@/hooks/use-ai-categories";
import { Recommend } from "@/components/Recommend";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison Luxe — A Curated Atelier of Considered Objects" },
      { name: "description", content: "Browse curated luxury timepieces, leather goods, fragrance, and home objects." },
    ],
  }),
  component: Index,
});

const TABS: { id: "all" | "deals" | "rated" | "best"; label: string; icon?: typeof Flame }[] = [
  { id: "all", label: "All" },
  { id: "deals", label: "Deals", icon: Flame },
  { id: "rated", label: "5-Star Rated", icon: Star },
  { id: "best", label: "Best-Selling", icon: Award },
];

function Index() {
  const { addToCart, user } = useStore();
  const { products, loading } = useProducts();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [cat, setCat] = useState<string>("All");
  const { categories: aiCategories } = useAICategories();

  const list = useMemo(() => {
    let l = [...products];
    if (cat !== "All") {
      const match = aiCategories.find((c) => c.name === cat);
      if (match) l = l.filter((p) => match.productIds.includes(p.id));
    }
    if (tab === "rated") l = l.filter((p) => p.rating >= 4.7);
    if (tab === "best") l = l.sort((a, b) => b.reviewCount - a.reviewCount);
    if (tab === "deals") l = l.sort((a, b) => b.price - a.price);
    return l;
  }, [tab, cat, aiCategories, products]);

  return (
    <div className="bg-background pb-12">
      <div className="border-b border-border/40">
        <div className="mx-auto flex max-w-5xl gap-6 overflow-x-auto px-4 py-3 text-xs uppercase tracking-[0.2em] no-scrollbar">
          {["All", ...aiCategories.map((c) => c.name)].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`whitespace-nowrap pb-2 transition-smooth ${
                cat === c ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-3 flex max-w-5xl items-center gap-6 border border-border/60 bg-card/60 px-5 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2 text-primary"><Truck className="h-4 w-4" /> Complimentary shipping</span>
        <span className="flex items-center gap-2 text-primary"><ShieldCheck className="h-4 w-4" /> 30-day price assurance</span>
      </div>

      <div className="mx-auto mt-6 max-w-5xl border-b border-border/40 px-4">
        <div className="flex gap-6 overflow-x-auto text-xs uppercase tracking-[0.2em] no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap pb-3 transition-smooth ${
                  tab === t.id ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <section className="mx-auto mt-4 grid max-w-5xl grid-cols-2 gap-2 px-2 md:grid-cols-3 lg:grid-cols-4">
          {list.map((p) => {
            const original = Math.round(p.price * 1.4);
            const saved = original - p.price;
            return (
              <Link
                key={p.id}
                to="/product/$id"
                params={{ id: p.id }}
                className="group relative flex flex-col border border-border bg-card transition-smooth hover:border-primary"
              >
                <div className="relative aspect-square overflow-hidden bg-muted">
                  <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-smooth group-hover:scale-[1.03]" />
                  {p.rating >= 4.8 && (
                    <span className="absolute left-2 top-2 bg-gold-gradient px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] text-primary-foreground">Star Atelier</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); void addToCart(p.id, 1); }}
                    aria-label={user ? "Add to cart" : "Sign in to shop"}
                    className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-primary bg-background/90 text-primary transition-smooth hover:bg-gold-gradient hover:text-primary-foreground"
                  >
                    <ShoppingBag className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1.5 p-3">
                  <p className="line-clamp-2 text-xs leading-tight text-foreground">{p.name}</p>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Star className="h-3 w-3 fill-primary text-primary" />
                    <span>{p.rating}</span>
                    <span>·</span>
                    <span>{(p.reviewCount * 0.1).toFixed(1)}K+ owners</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="border border-primary/40 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-primary">Save ${saved.toLocaleString()}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5 pt-0.5">
                    <span className="font-serif text-base text-gold-gradient">${p.price.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground line-through">${original.toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <Recommend />
    </div>
  );
}
