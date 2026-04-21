import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, Phone, MapPin, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/admin/users/$userId")({
  component: UserDetailPage,
});

type Profile = { id: string; email: string | null; display_name: string | null; created_at: string };
type Address = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  address_line: string;
  city: string;
  state: string;
  country: string;
  is_default: boolean;
};
type Order = { id: string; total: number; status: string; created_at: string };

function UserDetailPage() {
  const { userId } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [pRes, aRes, oRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("addresses").select("*").eq("user_id", userId),
        supabase.from("orders").select("id, total, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      setProfile((pRes.data as Profile | null) ?? null);
      setAddresses((aRes.data ?? []) as Address[]);
      setOrders((oRes.data ?? []) as Order[]);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!profile)
    return (
      <div>
        <Link to="/admin/users" className="text-sm text-primary">
          ← Back to users
        </Link>
        <p className="mt-4">User not found.</p>
      </div>
    );

  return (
    <div className="space-y-6">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      <div className="rounded-lg border border-border/40 bg-card p-6">
        <h1 className="font-serif text-2xl">{profile.display_name ?? "—"}</h1>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {profile.email}
          </p>
          <p className="text-xs">Joined {new Date(profile.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Addresses ({addresses.length})
        </h2>
        {addresses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/40 bg-card p-6 text-center text-sm text-muted-foreground">
            No saved addresses.
          </p>
        ) : (
          <div className="space-y-3">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-lg border border-border/40 bg-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      {a.first_name} {a.last_name}
                    </p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {a.phone}
                    </p>
                    <p className="mt-1 flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {a.address_line}
                        <br />
                        {a.city}, {a.state}, {a.country}
                      </span>
                    </p>
                  </div>
                  {a.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
                      Default
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Order history ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/40 bg-card p-6 text-center text-sm text-muted-foreground">
            No orders yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/40 bg-card">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between border-b border-border/40 px-5 py-3 last:border-0">
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">#{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">₦{Number(o.total).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{o.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
