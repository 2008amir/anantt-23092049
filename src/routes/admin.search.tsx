import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type AdminSearch = { q?: string };

export const Route = createFileRoute("/admin/search")({
  validateSearch: (s: Record<string, unknown>): AdminSearch => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: SearchPage,
});

type ProductRow = { id: string; name: string; brand: string; price: number; stock: number };
type ProfileRow = { id: string; email: string | null; display_name: string | null };
type OrderRow = { id: string; user_id: string; total: number; created_at: string; status: string };

function SearchPage() {
  const { q: urlQ } = Route.useSearch();
  const navigate = useNavigate();
  const [q, setQ] = useState(urlQ ?? "");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQ(urlQ ?? "");
  }, [urlQ]);

  const term = useMemo(() => q.trim(), [q]);

  // Sync URL when typing
  useEffect(() => {
    const t = setTimeout(() => {
      void navigate({ to: "/admin/search", search: { q: q.trim() || undefined }, replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [q, navigate]);

  useEffect(() => {
    if (!term) {
      setProducts([]);
      setUsers([]);
      setOrders([]);
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      const like = `%${term}%`;
      const [pRes, uRes, oRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, brand, price, stock")
          .or(`name.ilike.${like},brand.ilike.${like},category.ilike.${like},description.ilike.${like}`)
          .limit(15),
        supabase
          .from("profiles")
          .select("id, email, display_name")
          .or(`email.ilike.${like},display_name.ilike.${like}`)
          .limit(15),
        term.length >= 6
          ? supabase
              .from("orders")
              .select("id, user_id, total, created_at, status")
              .ilike("id", `${term}%`)
              .limit(15)
          : Promise.resolve({ data: [] as OrderRow[] }),
      ]);
      setProducts((pRes.data ?? []) as ProductRow[]);
      setUsers((uRes.data ?? []) as ProfileRow[]);
      setOrders((oRes.data ?? []) as OrderRow[]);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [term]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find products, users, or orders.</p>
      </div>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Type to search products, users, or orders…"
          className="w-full rounded-md border border-border/40 bg-background pl-10 pr-4 py-3 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {loading && <p className="text-xs text-muted-foreground">Searching…</p>}

      {term && !loading && (
        <div className="space-y-6">
          <Section title={`Products (${products.length})`}>
            {products.map((p) => (
              <Link
                key={p.id}
                to="/product/$id"
                params={{ id: p.id }}
                className="flex items-center justify-between border-b border-border/40 px-4 py-2 last:border-0 text-sm hover:bg-muted/50"
              >
                <span>
                  <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">· {p.brand}</span>
                  {p.stock <= 0 && <span className="ml-2 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600">Out</span>}
                </span>
                <span className="text-muted-foreground">₦{Number(p.price).toLocaleString()}</span>
              </Link>
            ))}
            {products.length === 0 && <Empty />}
          </Section>

          <Section title={`Users (${users.length})`}>
            {users.map((u) => (
              <Link
                key={u.id}
                to="/admin/users/$userId"
                params={{ userId: u.id }}
                className="flex items-center justify-between border-b border-border/40 px-4 py-2 last:border-0 text-sm hover:bg-muted/50"
              >
                <span>{u.display_name ?? "—"}</span>
                <span className="text-muted-foreground">{u.email}</span>
              </Link>
            ))}
            {users.length === 0 && <Empty />}
          </Section>

          <Section title={`Orders (${orders.length})`}>
            {orders.map((o) => (
              <Link
                key={o.id}
                to="/admin/users/$userId"
                params={{ userId: o.user_id }}
                className="flex items-center justify-between border-b border-border/40 px-4 py-2 last:border-0 text-sm hover:bg-muted/50"
              >
                <span>#{o.id.slice(0, 8)} <span className="text-muted-foreground">· {o.status}</span></span>
                <span className="text-muted-foreground">₦{Number(o.total).toLocaleString()}</span>
              </Link>
            ))}
            {orders.length === 0 && <Empty hint="Orders match by ID prefix (6+ chars)." />}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="overflow-hidden rounded-lg border border-border/40 bg-card">{children}</div>
    </div>
  );
}

function Empty({ hint }: { hint?: string }) {
  return <p className="px-4 py-3 text-xs text-muted-foreground">No results.{hint ? ` ${hint}` : ""}</p>;
}
