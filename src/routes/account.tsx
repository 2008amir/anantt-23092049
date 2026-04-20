import { createFileRoute, Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import { User, Package, Heart, Settings, Bell, MapPin, CreditCard, LogOut } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — Maison Luxe" }] }),
  component: AccountLayout,
});

const NAV = [
  { to: "/account", label: "Profile", icon: User, exact: true },
  { to: "/account/orders", label: "Orders", icon: Package },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/payment", label: "Payment", icon: CreditCard },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
  { to: "/account/settings", label: "Settings", icon: Settings },
];

function AccountLayout() {
  const { user, logout } = useStore();
  const navigate = useNavigate();
  const { location } = useRouterState();

  useEffect(() => {
    if (!user) navigate({ to: "/login" });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">My Account</p>
        <h1 className="mt-3 font-serif text-5xl">Welcome, {user.name}</h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit border border-border bg-card/50 p-2">
          <nav className="flex flex-col">
            {NAV.map((item) => {
              const active = item.exact
                ? location.pathname === item.to
                : location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-4 py-3 text-xs uppercase tracking-[0.2em] transition-smooth ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => { logout(); navigate({ to: "/" }); }}
              className="mt-2 flex items-center gap-3 border-t border-border px-4 py-3 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-smooth hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </nav>
        </aside>

        <section className="border border-border bg-card/50 p-8">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
