import { useMemo } from "react";
import { useProducts } from "@/lib/store";

export type Category = { name: string; productIds: string[] };

/**
 * Categories are derived directly from the products that admins create.
 * - A category appears as soon as one in-stock product uses that `category` value.
 * - When all products in a category go out of stock (or are deleted/disabled),
 *   the category disappears automatically — because `useProducts()` only returns
 *   active + in-stock products.
 */
export function useCategories() {
  const { products, loading } = useProducts();

  const categories = useMemo<Category[]>(() => {
    const map = new Map<string, string[]>();
    for (const p of products) {
      const name = (p.category ?? "").trim();
      if (!name) continue;
      const arr = map.get(name) ?? [];
      arr.push(p.id);
      map.set(name, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, productIds]) => ({ name, productIds }));
  }, [products]);

  return { categories, loading };
}
