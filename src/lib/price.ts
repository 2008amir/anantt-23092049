import type { Product } from "@/lib/products";

/**
 * The price the customer actually pays.
 * If a discount is set, that's the discount price; otherwise the regular price.
 */
export function effectivePrice(p: Pick<Product, "price" | "discountPrice">): number {
  return p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price
    ? p.discountPrice
    : p.price;
}

/** True when a real discount is configured (lower than the regular price). */
export function hasDiscount(p: Pick<Product, "price" | "discountPrice">): boolean {
  return !!p.discountPrice && p.discountPrice > 0 && p.discountPrice < p.price;
}

/** Amount the customer saves vs. the regular price. */
export function savings(p: Pick<Product, "price" | "discountPrice">): number {
  return hasDiscount(p) ? p.price - (p.discountPrice as number) : 0;
}

export function formatNaira(n: number): string {
  return `₦${Math.round(n).toLocaleString()}`;
}
