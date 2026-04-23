import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { useIsAdmin } from "@/hooks/use-admin";

export const Route = createFileRoute("/account/")({
  component: ProfilePanel,
});

function ProfilePanel() {
  const { user, profile, wishlist } = useStore();
  const { isAdmin } = useIsAdmin();
  const [orderCount, setOrderCount] = useState(0);
  const [lifetime, setLifetime] = useState(0);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("orders")
      .select("total, payment_status")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        setOrderCount(data.length);
        // Lifetime credit: only verified successful payments
        const paid = data.filter(
          (o: { payment_status?: string | null }) => o.payment_status === "paid",
        );
        setLifetime(paid.reduce((s: number, o: { total: number | string }) => s + Number(o.total), 0));
      });
  }, [user]);

  if (!user) return null;
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Guest";

  return (
    <div>
      <h2 className="font-serif text-3xl">Profile</h2>
      <p className="mt-2 text-sm text-muted-foreground">Your personal details and activity.</p>

      {isAdmin && (
        <Link
          to="/admin"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-gold-gradient px-4 py-2 text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90"
        >
          <ShieldCheck className="h-4 w-4" />
          Open Admin Panel
        </Link>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Field label="Name" value={name} />
        <Field label="Email" value={user.email ?? ""} />
        <Field label="Member Since" value={new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
        <Field label="Tier" value="Connoisseur" />
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={orderCount} />
        <Stat label="Saved Pieces" value={wishlist.length} />
        <Stat label="Lifetime" value={`$${lifetime.toFixed(0)}`} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-4">
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-foreground">{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border p-6 text-center">
      <p className="font-serif text-4xl text-gold-gradient">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
    </div>
  );
}
