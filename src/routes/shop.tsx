import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS, CATEGORIES, type Category } from "@/lib/products";

type ShopSearch = { category?: Category; q?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    category: (search.category as Category) || undefined,
    q: (search.q as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop — Maison Luxe" },
      {
        name: "description",
        content:
          "Browse the full collection of curated luxury objects: timepieces, leather goods, fragrance, audio, and home.",
      },
    ],
  }),
  component: Shop,
});

function Shop() {
  const { category, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [sort, setSort] = useState<"featured" | "price-low" | "price-high" | "rating">("featured");
  const [query, setQuery] = useState(q ?? "");

  const filtered = useMemo(() => {
    let list = [...PRODUCTS];
    if (category) list = list.filter((p) => p.category === category);
    if (q) {
      const lower = q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(lower) ||
          p.brand.toLowerCase().includes(lower) ||
          p.category.toLowerCase().includes(lower),
      );
    }
    if (sort === "price-low") list.sort((a, b) => a.price - b.price);
    if (sort === "price-high") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [category, q, sort]);

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">The Collection</p>
        <h1 className="mt-3 font-serif text-5xl md:text-6xl">
          {category ?? "All Pieces"}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "piece" : "pieces"}
        </p>
      </header>

      {/* Search */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: { category, q: query || undefined } });
        }}
        className="mx-auto mb-10 flex max-w-xl items-center border border-border bg-card"
      >
        <Search className="ml-4 h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the collection..."
          className="flex-1 bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button type="submit" className="bg-gold-gradient px-6 py-3 text-xs uppercase tracking-[0.2em] text-primary-foreground">
          Search
        </button>
      </form>

      <div className="mb-10 flex flex-col gap-4 border-y border-border py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <Link
            to="/shop"
            search={{}}
            className={`border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-smooth ${
              !category ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c}
              to="/shop"
              search={{ category: c }}
              className={`border px-4 py-2 text-xs uppercase tracking-[0.2em] transition-smooth ${
                category === c ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="border border-border bg-card px-4 py-2 text-xs uppercase tracking-[0.2em] text-foreground outline-none"
        >
          <option value="featured">Sort: Featured</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="rating">Top Rated</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground">
          No pieces match your search. <Link to="/shop" search={{}} className="text-primary underline">Clear filters</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
