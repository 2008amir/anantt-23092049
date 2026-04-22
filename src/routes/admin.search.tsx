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
        supabase.from("products").select("id, name, brand, price").or(`name.ilike.${like},brand.ilike.${like}`).limit(10),
        supabase.from("profiles").select("id, email, display_name").or(`email.ilike.${like},display_name.ilike.${like}`).limit(10),
        term.length >= 6
          ? supabase.from("orders").select("id, user_id, total, created_at").ilike("id", `${term}%`).limit(10)
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

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type to search…"
        className="w-full rounded-md border border-border/40 bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none"
      />

      {loading && <p className="text-xs text-muted-foreground">Searching…</p>}

      {term && !loading && (
        <div className="space-y-6">
          <Section title={`Products (${products.length})`}>
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-border/40 px-4 py-2 last:border-0 text-sm">
                <span>
                  <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">· {p.brand}</span>
                </span>
                <span className="text-muted-foreground">₦{Number(p.price).toLocaleString()}</span>
              </div>
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
              <div key={o.id} className="flex items-center justify-between border-b border-border/40 px-4 py-2 last:border-0 text-sm">
                <span>#{o.id.slice(0, 8)}</span>
                <span className="text-muted-foreground">₦{Number(o.total).toLocaleString()}</span>
              </div>
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
