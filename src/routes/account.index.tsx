import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Headphones,
  Settings,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  Star,
  History,
  Gift,
  MapPin,
  Store,
} from "lucide-react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account/")({
  component: ProfilePanel,
});

function ProfilePanel() {
  const { user, orders, wishlist, logout } = useStore();
  const navigate = useNavigate();
  if (!user) return null;

  const initial = (user.name?.[0] || user.email[0] || "U").toUpperCase();
  const creditBalance = 0;
  const coupons = 2;
  const messages = 99;

  return (
    <div className="pb-4">
      {/* Header row: avatar + name + icons */}
      <div className="flex items-center gap-4 px-1 pt-1">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/90 text-2xl font-semibold text-primary-foreground">
          {initial}
        </div>
        <h2 className="flex-1 truncate font-serif text-2xl text-foreground">{user.name}</h2>
        <button
          type="button"
          aria-label="Support"
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-secondary"
        >
          <Headphones className="h-6 w-6" strokeWidth={1.75} />
        </button>
        <Link
          to="/account/settings"
          aria-label="Settings"
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-secondary"
        >
          <Settings className="h-6 w-6" strokeWidth={1.75} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[oklch(0.72_0.17_55)]" />
        </Link>
      </div>

      {/* Credit balance / Coupons stats */}
      <div className="mt-6 grid grid-cols-2 divide-x divide-border">
        <div className="py-4 text-center">
          <p className="font-serif text-3xl text-foreground">
            <span className="line-through opacity-60">₦</span>
            {creditBalance}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Credit balance</p>
        </div>
        <Link to="/account" className="py-4 text-center">
          <p className="font-serif text-3xl text-foreground">{coupons}</p>
          <p className="mt-1 text-sm text-muted-foreground">Coupons & offers</p>
        </Link>
      </div>

      {/* Menu list */}
      <div className="mt-4 divide-y divide-border border-y border-border">
        <MenuRow
          icon={<ClipboardList className="h-5 w-5" strokeWidth={1.75} />}
          label="Your orders"
          onClick={() => navigate({ to: "/account/orders" })}
          right={orders.length > 0 ? <Badge>{orders.length}</Badge> : null}
        />
        <MenuRow
          icon={<MessageCircle className="h-5 w-5" strokeWidth={1.75} />}
          label="Messages"
          right={<Badge tone="accent">{messages > 99 ? "99+" : messages}</Badge>}
        />
        <MenuRow
          icon={<Star className="h-5 w-5" strokeWidth={1.75} />}
          label="Reviews"
        />
      </div>

      {/* Tile grid */}
      <div className="mt-6 grid grid-cols-4 gap-2 px-1">
        <Tile icon={<History className="h-6 w-6" strokeWidth={1.75} />} label="History" />
        <Tile
          icon={<Gift className="h-6 w-6" strokeWidth={1.75} />}
          label="Earn & Free"
          dot
        />
        <Tile
          icon={<MapPin className="h-6 w-6" strokeWidth={1.75} />}
          label="Addresses"
          onClick={() => navigate({ to: "/account/addresses" })}
        />
        <Tile
          icon={<Store className="h-6 w-6" strokeWidth={1.75} />}
          label="Following"
          onClick={() => navigate({ to: "/account/wishlist" })}
          badge={wishlist.length > 0 ? wishlist.length : undefined}
        />
      </div>

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          onClick={() => { logout(); navigate({ to: "/" }); }}
          className="text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-destructive"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

function MenuRow({
  icon,
  label,
  right,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  right?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 py-4 text-left transition-smooth hover:bg-secondary/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground">
        {icon}
      </span>
      <span className="flex-1 text-base text-foreground">{label}</span>
      {right}
      <ChevronRight className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
    </button>
  );
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent";
}) {
  const cls =
    tone === "accent"
      ? "bg-[oklch(0.72_0.17_55)] text-white"
      : "bg-primary/15 text-primary";
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
  );
}

function Tile({
  icon,
  label,
  dot,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  dot?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 py-3 text-center transition-smooth hover:bg-secondary/40"
    >
      <span className="relative text-foreground">
        {icon}
        {dot && (
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[oklch(0.72_0.17_55)]" />
        )}
        {typeof badge === "number" && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-medium text-primary-foreground">
            {badge}
          </span>
        )}
      </span>
      <span className="text-xs text-foreground">{label}</span>
    </button>
  );
}
