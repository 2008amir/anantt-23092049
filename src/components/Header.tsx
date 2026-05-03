import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, Gift, Truck } from "lucide-react";
import { useState } from "react";

export function Header() {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [query, setQuery] = useState("");

  const onAdmin = location.pathname.startsWith("/admin");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onAdmin) {
      navigate({ to: "/admin/search", search: { q: query || undefined } });
    } else {
      navigate({ to: "/search", search: { q: query || undefined } });
    }
  };

  // Hide on login, account, and search pages for cleaner flow.
  // Keep visible on /admin so the global search bar is always available.
  if (
    location.pathname === "/login" ||
    location.pathname.startsWith("/account") ||
    location.pathname.startsWith("/deliverer") ||
    location.pathname === "/search" ||
    location.pathname === "/admin/search"
  ) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 px-3 py-2.5 backdrop-blur-xl">
      {onAdmin ? (
        <form
          onSubmit={submit}
          className="flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-luxury"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, users, orders…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label="Search"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-gradient text-primary-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => navigate({ to: "/search", search: {} })}
          className="flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-luxury text-left"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm text-muted-foreground">Search Luxe Sparkles</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-gradient text-primary-foreground">
            <Search className="h-4 w-4" />
          </span>
        </button>
      )}
      {onAdmin && (
        <div className="mt-2 flex gap-2">
          <Link
            to="/admin/rewards"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary hover:bg-primary/10"
          >
            <Gift className="h-3.5 w-3.5" /> Rewards
          </Link>
          <Link
            to="/admin/deliverers"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] uppercase tracking-wider text-primary hover:bg-primary/10"
          >
            <Truck className="h-3.5 w-3.5" /> Deliverers
          </Link>
        </div>
      )}
    </header>
  );
}
