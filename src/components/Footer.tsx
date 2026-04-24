import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  LayoutGrid,
  Heart,
  ShoppingBag,
  User,
  LayoutDashboard,
  Package,
  Users as UsersIcon,
  MessageSquare,
  Truck,
  Search as SearchIcon,
  Gift,
  UserCog,
  Send,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useIsAdmin } from "@/hooks/use-admin";

const USER_NAV = [
  { to: "/" as const, label: "Home", icon: Home, exact: true },
  { to: "/shop" as const, label: "Shop", icon: LayoutGrid },
  { to: "/wishlist" as const, label: "Wishlist", icon: Heart },
  { to: "/cart" as const, label: "Cart", icon: ShoppingBag },
  { to: "/account" as const, label: "You", icon: User },
];

const ADMIN_NAV = [
  { to: "/admin" as const, label: "Home", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders" as const, label: "Orders", icon: ShoppingBag },
  { to: "/admin/products" as const, label: "Products", icon: Package },
  { to: "/admin/users" as const, label: "Users", icon: UsersIcon },
  { to: "/admin/messages" as const, label: "Chat", icon: MessageSquare },
  { to: "/admin/delivery-prices" as const, label: "Delivery", icon: Truck },
  { to: "/admin/deliverers" as const, label: "Riders", icon: Truck },
  { to: "/admin/rewards" as const, label: "Rewards", icon: Gift },
  { to: "/admin/post" as const, label: "Post", icon: Send },
  { to: "/admin/search" as const, label: "Search", icon: SearchIcon },
  { to: "/admin/profile" as const, label: "Profile", icon: UserCog },
];

export function Footer() {
  const { cart, wishlist, user } = useStore();
  const { location } = useRouterState();
  const { isAdmin } = useIsAdmin();
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  if (location.pathname === "/login") return null;
  if (location.pathname.startsWith("/deliverer")) return null;

  // Admin layout: replace bottom nav with admin nav (scrollable horizontally)
  const onAdmin = location.pathname.startsWith("/admin");
  if (onAdmin && isAdmin) {
    return (
      <nav className="sticky bottom-0 z-40 w-full border-t border-border/60 bg-background/95 backdrop-blur-xl md:hidden">
        <div className="flex w-full overflow-x-auto no-scrollbar">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-w-[68px] flex-1 shrink-0 flex-col items-center gap-1 px-2 py-2.5 text-[10px] uppercase tracking-[0.15em] transition-smooth ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={1.5} />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky bottom-0 z-40 w-full border-t border-border/60 bg-background/95 backdrop-blur-xl">
      <div className="grid w-full grid-cols-5">
        {USER_NAV.map((item) => {
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
