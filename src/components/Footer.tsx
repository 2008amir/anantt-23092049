import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, Heart, ShoppingBag, User } from "lucide-react";
import { useStore } from "@/lib/store";

const NAV = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/shop", label: "Shop", icon: LayoutGrid },
  { to: "/wishlist", label: "Wishlist", icon: Heart },
  { to: "/cart", label: "Cart", icon: ShoppingBag },
  { to: "/account", label: "You", icon: User },
];

export function Footer() {
  const { cart, wishlist, user } = useStore();
  const { location } = useRouterState();
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  if (location.pathname === "/login") return null;

  return (
    <nav className="sticky bottom-0 z-40 w-full border-t border-border/60 bg-background/95 backdrop-blur-xl">
      <div className="grid w-full grid-cols-5">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);
          const to = item.to === "/account" && !user ? "/login" : item.to;
          const badge =
            item.to === "/cart" ? cartCount : item.to === "/wishlist" ? wishlist.length : 0;
          return (
            <Link
              key={item.to}
              to={to}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[10px] uppercase tracking-[0.2em] transition-smooth ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={1.5} />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium text-primary-foreground">
                    {badge}
                  </span>
                )}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
