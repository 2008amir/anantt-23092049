import { Link, Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  MessageSquare,
  Truck,
  Search,
  LogOut,
  Gift,
  UserCog,
  Send,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/use-admin";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Luxe Sparkles" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, exact: false },
  { to: "/admin/products", label: "Products", icon: Package, exact: false },
  { to: "/admin/rewards", label: "Rewards", icon: Gift, exact: false },
  { to: "/admin/post", label: "Post", icon: Send, exact: false },
  { to: "/admin/deliverers", label: "Deliverers", icon: Truck, exact: false },
  { to: "/admin/users", label: "Users", icon: Users, exact: false },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare, exact: false },
  { to: "/admin/delivery-prices", label: "Delivery Prices", icon: Truck, exact: false },
  { to: "/admin/search", label: "Search", icon: Search, exact: false },
  { to: "/admin/profile", label: "Profile", icon: UserCog, exact: false },
] as const;

function AdminLayout() {
  const { isAdmin, checking } = useIsAdmin();
  const { user, signOut } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (checking) return;
    if (!user) {
      void navigate({ to: "/login" });
      return;
    }
    if (!isAdmin) {
      void navigate({ to: "/" });
    }
  }, [checking, user, isAdmin, navigate]);

  if (checking) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Verifying admin access…
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] bg-background">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border/40 bg-card md:block">
        <div className="px-6 py-6">
          <p className="font-serif text-xl text-gold-gradient">Admin</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Luxe Sparkles
          </p>
        </div>
        <nav className="space-y-1 px-3">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 border-t border-border/40 p-3">
          <button
            onClick={() => {
              void signOut().then(() => navigate({ to: "/" }));
            }}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden p-4 pb-24 md:p-8 md:pb-8">
        <Outlet />
      </main>
    </div>
  );
}
