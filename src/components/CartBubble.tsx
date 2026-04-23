import { Link, useRouterState } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useIsAdmin } from "@/hooks/use-admin";

/**
 * Floating cart bubble — sits at the bottom-right, ~3vh above the
 * bottom navigation bar. Bounces whenever an item is added to the cart
 * (listens to a `cart:add` window event dispatched by `addToCart`).
 */
export function CartBubble() {
  const { cart, user } = useStore();
  const { location } = useRouterState();
  const { isAdmin } = useIsAdmin();
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [bouncing, setBouncing] = useState(false);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    const onAdd = () => {
      setBouncing(false);
      // re-trigger animation
      requestAnimationFrame(() => setBouncing(true));
      window.setTimeout(() => setBouncing(false), 600);
    };
    window.addEventListener("cart:add", onAdd);
    return () => window.removeEventListener("cart:add", onAdd);
  }, []);

  // Hide on routes where it doesn't belong
  if (
    location.pathname === "/login" ||
    location.pathname === "/cart" ||
    location.pathname === "/checkout" ||
    location.pathname.startsWith("/deliverer") ||
    location.pathname.startsWith("/admin") ||
    isAdmin
  ) {
    return null;
  }

  return (
    <Link
      ref={ref}
      to={user ? "/cart" : "/login"}
      data-cart-bubble
      aria-label={`Cart (${cartCount} items)`}
      className={`fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gold-gradient text-primary-foreground shadow-luxury ${bouncing ? "cart-bounce" : ""}`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 64px + 3vh)" }}
    >
      <ShoppingBag className="h-6 w-6" strokeWidth={1.75} />
      {cartCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {cartCount}
        </span>
      )}
    </Link>
  );
}

/**
 * Helper to fire an "add to cart" fly animation from a source element
 * (the product image or button) toward the floating cart bubble.
 * Also dispatches `cart:add` so the bubble bounces.
 */
export function flyToCart(sourceEl: HTMLElement | null, imageUrl?: string) {
  if (typeof window === "undefined") return;
  // Always bounce, even if we can't compute trajectory
  window.dispatchEvent(new CustomEvent("cart:add"));
  if (!sourceEl) return;
  const target = document.querySelector("[data-cart-bubble]") as HTMLElement | null;
  if (!target) return;

  const sRect = sourceEl.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.className = "cart-fly-ghost";
  if (imageUrl) ghost.style.backgroundImage = `url(${imageUrl})`;
  else ghost.style.background = "var(--gold, gold)";

  const x0 = sRect.left + sRect.width / 2 - 32;
  const y0 = sRect.top + sRect.height / 2 - 32;
  const x1 = tRect.left + tRect.width / 2 - 32;
  const y1 = tRect.top + tRect.height / 2 - 32;

  ghost.style.setProperty("--fly-x0", `${x0}px`);
  ghost.style.setProperty("--fly-y0", `${y0}px`);
  ghost.style.setProperty("--fly-x1", `${x1}px`);
  ghost.style.setProperty("--fly-y1", `${y1}px`);

  document.body.appendChild(ghost);
  ghost.addEventListener("animationend", () => ghost.remove(), { once: true });
}
