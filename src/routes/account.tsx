import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Headphones,
  Bell,
  ChevronRight,
  Package,
  MessageSquare,
  Star,
  History,
  Gift,
  MapPin,
  Heart,
  Settings,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account — Maison Luxe" }] }),
  component: AccountLayout,
});

function AccountLayout() {
  const { user, loading } = useStore();
  const navigate = useNavigate();
  const { location } = useRouterState();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) return null;

  if (location.pathname !== "/account") {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4">
          <Link
            to="/account"
            className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-primary"
          >
            ← Back to Profile
          </Link>
        </div>
        <section className="border border-border bg-card/50 p-6">
          <Outlet />
        </section>
      </div>
    );
  }

  return <ProfileHome />;
}

function ProfileHome() {
  const { user, profile, wishlist, signOut } = useStore();
  const navigate = useNavigate();
  const [orderCount, setOrderCount] = useState(0);
  const [lifetime, setLifetime] = useState(0);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("orders")
      .select("total")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        setOrderCount(data.length);
        setLifetime(data.reduce((s: number, o: { total: number | string }) => s + Number(o.total), 0));
      });
  }, [user]);

  if (!user) return null;
  const displayName = profile?.display_name ?? user.email?.split("@")[0] ?? "Guest";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl pb-8">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-gradient">
          <span className="font-serif text-base text-primary-foreground">{initial}</span>
        </div>
        <h1 className="flex-1 truncate font-serif text-base text-foreground">{displayName}</h1>
        <button
          type="button"
          aria-label="Concierge"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-smooth hover:border-primary hover:text-primary"
        >
          <Headphones className="h-5 w-5" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => navigate({ to: "/account/notifications" })}
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border text-foreground transition-smooth hover:border-primary hover:text-primary"
        >
          <Bell className="h-5 w-5" strokeWidth={1.5} />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
        </button>
      </div>

      <div className="mx-5 grid grid-cols-2 divide-x divide-border border border-border bg-card/40">
        <button type="button" className="px-4 py-5 text-center transition-smooth hover:bg-secondary/50">
          <p className="font-serif text-3xl text-gold-gradient">${lifetime.toFixed(0)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Credit Balance</p>
        </button>
        <button type="button" className="px-4 py-5 text-center transition-smooth hover:bg-secondary/50">
          <p className="font-serif text-3xl text-gold-gradient">{wishlist.length}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">Privileges & Offers</p>
        </button>
      </div>

      <div className="mx-5 mt-4 grid grid-cols-4 border border-border bg-card/40 py-5">
        <Tile to="/account/orders" icon={<History className="h-6 w-6" strokeWidth={1.5} />} label="History" />
        <Tile to="/account/earn" icon={<Gift className="h-6 w-6" strokeWidth={1.5} />} label="Earn & Free" dot />
        <Tile to="/account/addresses" icon={<MapPin className="h-6 w-6" strokeWidth={1.5} />} label="Addresses" />
        <Tile to="/account/wishlist" icon={<Heart className="h-6 w-6" strokeWidth={1.5} />} label="Following" />
      </div>

      <div className="mx-5 mt-4 divide-y divide-border border border-border bg-card/40">
        <Row to="/account/orders" icon={<Package className="h-5 w-5" strokeWidth={1.5} />} label="Your Orders" badge={orderCount > 0 ? String(orderCount) : undefined} />
        <Row to="/account/notifications" icon={<MessageSquare className="h-5 w-5" strokeWidth={1.5} />} label="Messages" badgeStrong="99+" />
        <Row to="/account/wishlist" icon={<Star className="h-5 w-5" strokeWidth={1.5} />} label="Reviews" />
      </div>

      <div className="mx-5 mt-4 divide-y divide-border border border-border bg-card/40">
        <Row to="/account/settings" icon={<Settings className="h-5 w-5" strokeWidth={1.5} />} label="Settings & Payment" />
      </div>

      <div className="mx-5 mt-4">
        <button
          type="button"
          onClick={async () => { await signOut(); navigate({ to: "/" }); }}
          className="flex w-full items-center justify-center gap-2 border border-destructive/40 px-4 py-3 text-xs uppercase tracking-[0.25em] text-destructive transition-smooth hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

function Row({ to, icon, label, badge, badgeStrong }: { to: string; icon: React.ReactNode; label: string; badge?: string; badgeStrong?: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 px-4 py-4 transition-smooth hover:bg-secondary/50">
      <span className="flex h-9 w-9 items-center justify-center text-foreground">{icon}</span>
      <span className="flex-1 text-sm text-foreground">{label}</span>
      {badgeStrong && (
        <span className="flex min-w-9 items-center justify-center rounded-full bg-gold-gradient px-2 py-0.5 text-[11px] font-medium text-primary-foreground">{badgeStrong}</span>
      )}
      {badge && !badgeStrong && <span className="text-xs text-muted-foreground">{badge}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
    </Link>
  );
}

function Tile({ to, icon, label, dot }: { to: string; icon: React.ReactNode; label: string; dot?: boolean }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 px-2 text-foreground transition-smooth hover:text-primary">
      <span className="relative">
        {icon}
        {dot && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
    </Link>
  );
}
