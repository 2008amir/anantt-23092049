import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  ShoppingBag,
  Heart,
  Wallet,
  Package,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/admin/users/$userId")({
  component: UserDetailPage,
});

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: string;
};
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
type Order = {
  id: string;
  total: number;
  status: string;
  payment_status: string;
  delivery_stage: string;
  created_at: string;
};
type WishlistRow = {
  product_id: string;
  products: { id: string; name: string; image: string; price: number } | null;
};
type RoleRow = { role: string };

function UserDetailPage() {
  const { userId } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistRow[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [pRes, aRes, oRes, wRes, rRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("addresses").select("*").eq("user_id", userId),
        supabase
          .from("orders")
          .select("id, total, status, payment_status, delivery_stage, created_at")
          .eq("user_id", userId)
          .eq("payment_status", "paid")
          .order("created_at", { ascending: false }),
        supabase
          .from("wishlist")
          .select("product_id, products(id, name, image, price)")
          .eq("user_id", userId),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      setProfile((pRes.data as Profile | null) ?? null);
      setAddresses((aRes.data ?? []) as Address[]);
      setOrders((oRes.data ?? []) as Order[]);
      setWishlist((wRes.data ?? []) as unknown as WishlistRow[]);
      setRoles(((rRes.data ?? []) as RoleRow[]).map((r) => r.role));
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

  const totalSpent = orders.reduce((s, o) => s + Number(o.total), 0);
  const deliveredCount = orders.filter((o) => o.delivery_stage === "delivered").length;

  return (
    <div className="space-y-6 pb-8">
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to users
      </Link>

      {/* Profile header */}
      <div className="rounded-lg border border-border/40 bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl">{profile.display_name ?? "—"}</h1>
            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                {profile.email}
              </p>
              <p className="text-xs">
                Joined {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          {roles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-primary"
                >
                  <Shield className="h-3 w-3" /> {r}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={ShoppingBag} label="Orders" value={orders.length.toString()} />
        <Stat icon={Package} label="Delivered" value={deliveredCount.toString()} />
        <Stat
          icon={Wallet}
          label="Total spent"
          value={`₦${Math.round(totalSpent).toLocaleString()}`}
        />
        <Stat icon={Heart} label="Wishlist" value={wishlist.length.toString()} />
      </div>

      {/* Addresses */}
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

      {/* Wishlist */}
      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Wishlist ({wishlist.length})
        </h2>
        {wishlist.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/40 bg-card p-6 text-center text-sm text-muted-foreground">
            Empty wishlist.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {wishlist.map((w) =>
              w.products ? (
                <div
                  key={w.product_id}
                  className="overflow-hidden rounded-lg border border-border/40 bg-card"
                >
                  <img
                    src={w.products.image}
                    alt={w.products.name}
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                  <div className="p-2">
                    <p className="line-clamp-2 text-xs">{w.products.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      ₦{Number(w.products.price).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      {/* Orders */}
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
              <div
                key={o.id}
                className="flex items-center justify-between border-b border-border/40 px-5 py-3 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">#{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    ₦{Number(o.total).toLocaleString()}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {o.status} · {o.delivery_stage.replace("_", " ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1.5 font-serif text-xl">{value}</p>
    </div>
  );
}
