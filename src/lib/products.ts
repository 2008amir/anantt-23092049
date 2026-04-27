import { supabase } from "@/integrations/supabase/client";
import { imageFor } from "@/lib/product-images";
import {
  cacheProductList,
  cacheViewedProduct,
  findCachedProduct,
  readCachedProductList,
} from "@/lib/offline-cache";

export type Review = {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  discountPrice: number | null;
  image: string;
  images: string[];
  category: string;
  description: string;
  details: string[];
  rating: number;
  reviewCount: number;
  reviews: Review[];
  inStock: boolean;
  stock: number;
  colors: string[];
  sizes: string[];
};

type Row = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number | string;
  discount_price?: number | string | null;
  image: string;
  images?: unknown;
  description: string;
  details: unknown;
  rating: number | string;
  review_count: number;
  reviews: unknown;
  stock?: number;
  is_active?: boolean;
  colors?: unknown;
  sizes?: unknown;
};

function rowToProduct(r: Row): Product {
  const mainImage = imageFor(r.id, r.image);
  const extra = Array.isArray(r.images) ? (r.images as string[]).filter(Boolean) : [];
  // Always lead with the main image, then any extras (deduped).
  const allImages = [mainImage, ...extra.filter((u) => u !== mainImage && u !== r.image)];
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    price: Number(r.price),
    discountPrice:
      r.discount_price === null || r.discount_price === undefined || r.discount_price === ""
        ? null
        : Number(r.discount_price),
    image: mainImage,
    images: allImages,
    description: r.description,
    details: Array.isArray(r.details) ? (r.details as string[]) : [],
    rating: Number(r.rating),
    reviewCount: r.review_count,
    reviews: Array.isArray(r.reviews) ? (r.reviews as Review[]) : [],
    inStock: (r.stock ?? 0) > 0,
    stock: r.stock ?? 0,
    colors: Array.isArray(r.colors) ? (r.colors as string[]).filter(Boolean) : [],
    sizes: Array.isArray(r.sizes) ? (r.sizes as string[]).filter(Boolean) : [],
  };
}

export async function fetchProducts(): Promise<Product[]> {
  // Public shop only sees active products that still have stock.
  // Finished products (stock = 0) only show in admin "Finished" tab.
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .gt("stock", 0)
      .order("created_at", { ascending: true });
    if (error) throw error;
    const list = (data ?? []).map((r) => rowToProduct(r as unknown as Row));
    cacheProductList(list);
    return list;
  } catch (err) {
    const cached = readCachedProductList();
    if (cached.length > 0) return cached;
    throw err;
  }
}

export async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    const product = data ? rowToProduct(data as unknown as Row) : null;
    if (product) cacheViewedProduct(product);
    return product;
  } catch (err) {
    const cached = findCachedProduct(id);
    if (cached) return cached;
    throw err;
  }
}

export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  try {
    // Only return products that are still active and in-stock so removed/disabled
    // admin products never appear in recommendations or related sections.
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .in("id", ids)
      .eq("is_active", true)
      .gt("stock", 0);
    if (error) throw error;
    const map = new Map<string, Product>();
    for (const r of data ?? []) {
      const p = rowToProduct(r as unknown as Row);
      map.set(p.id, p);
    }
    // preserve requested order, dropping any missing ids
    return ids.map((id) => map.get(id)).filter(Boolean) as Product[];
  } catch (err) {
    const out = ids.map((id) => findCachedProduct(id)).filter(Boolean) as Product[];
    if (out.length > 0) return out;
    throw err;
  }
}

