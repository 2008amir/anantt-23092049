import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { VisualSearchModal } from "@/components/VisualSearchModal";

const KEY = "lux_search_v1";

export function Header() {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [query, setQuery] = useState("");
  const [visualOpen, setVisualOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setQuery(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, query);
    } catch {
      // ignore
    }
  }, [query]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/shop", search: { q: query || undefined } });
  };

  // Hide on login and account pages for cleaner flow
  if (location.pathname === "/login" || location.pathname.startsWith("/account")) return null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/95 px-3 py-2.5 backdrop-blur-xl">
      <form
        onSubmit={submit}
        className="flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-luxury"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Maison Luxe"
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          aria-label="Visual AI search"
          onClick={() => setVisualOpen(true)}
          className="text-muted-foreground transition-smooth hover:text-primary"
        >
          <Camera className="h-4 w-4" />
        </button>
        <button
          type="submit"
          aria-label="Search"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-gradient text-primary-foreground"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>
      <VisualSearchModal open={visualOpen} onClose={() => setVisualOpen(false)} />
    </header>
  );
}
