/**
 * Offline cache for products and pending mutations.
 *
 * Keeps the last list of products and any individually viewed products in
 * localStorage so the user can keep browsing pages they've already opened
 * after losing internet. Cart/wishlist actions performed while offline are
 * queued and replayed when the connection returns.
 */

import type { Product } from "./products";
import { supabase } from "@/integrations/supabase/client";

const PRODUCTS_KEY = "ml_offline_products_v1";
const VIEWED_KEY = "ml_offline_viewed_v1";
const QUEUE_KEY = "ml_offline_queue_v1";

type Stored<T> = { at: number; data: T };

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return (JSON.parse(raw) as Stored<T>).data;
  } catch {
    return null;
  }
}

function safeWrite<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // quota exceeded — ignore
  }
}

export function cacheProductList(products: Product[]) {
  safeWrite(PRODUCTS_KEY, products);
}

export function readCachedProductList(): Product[] {
  return safeRead<Product[]>(PRODUCTS_KEY) ?? [];
}

export function cacheViewedProduct(product: Product) {
  const list = safeRead<Product[]>(VIEWED_KEY) ?? [];
  const next = [product, ...list.filter((p) => p.id !== product.id)].slice(0, 60);
  safeWrite(VIEWED_KEY, next);
}

export function readViewedProducts(): Product[] {
  return safeRead<Product[]>(VIEWED_KEY) ?? [];
}

export function findCachedProduct(id: string): Product | null {
  const all = [...readCachedProductList(), ...readViewedProducts()];
  return all.find((p) => p.id === id) ?? null;
}

// ---------------- Mutation queue ----------------

export type PendingMutation =
  | { kind: "cart_upsert"; user_id: string; product_id: string; quantity: number; variant: unknown }
  | { kind: "cart_delete"; user_id: string; product_id: string }
  | { kind: "wishlist_add"; user_id: string; product_id: string }
  | { kind: "wishlist_delete"; user_id: string; product_id: string };

export function readQueue(): PendingMutation[] {
  return safeRead<PendingMutation[]>(QUEUE_KEY) ?? [];
}

export function enqueueMutation(m: PendingMutation) {
  const q = readQueue();
  q.push(m);
  safeWrite(QUEUE_KEY, q);
}

let flushing = false;
export async function flushQueue() {
  if (flushing) return;
  if (typeof window === "undefined" || !navigator.onLine) return;
  flushing = true;
  try {
    const q = readQueue();
    if (q.length === 0) return;
    const remaining: PendingMutation[] = [];
    for (const m of q) {
      try {
        if (m.kind === "cart_upsert") {
          await supabase.from("cart_items").upsert(
            {
              user_id: m.user_id,
              product_id: m.product_id,
              quantity: m.quantity,
              variant: m.variant as never,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,product_id" },
          );
        } else if (m.kind === "cart_delete") {
          await supabase.from("cart_items").delete().eq("user_id", m.user_id).eq("product_id", m.product_id);
        } else if (m.kind === "wishlist_add") {
          await supabase.from("wishlist").insert({ user_id: m.user_id, product_id: m.product_id });
        } else if (m.kind === "wishlist_delete") {
          await supabase.from("wishlist").delete().eq("user_id", m.user_id).eq("product_id", m.product_id);
        }
      } catch {
        remaining.push(m);
      }
    }
    safeWrite(QUEUE_KEY, remaining);
  } finally {
    flushing = false;
  }
}

export function setupQueueAutoFlush() {
  if (typeof window === "undefined") return;
  window.addEventListener("online", () => {
    void flushQueue();
  });
  // Also try periodically in case the listener didn't fire.
  setInterval(() => {
    if (navigator.onLine) void flushQueue();
  }, 30_000);
}
