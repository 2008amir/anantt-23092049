import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account/")({
  component: ProfilePanel,
});

function ProfilePanel() {
  const { user, profile, wishlist } = useStore();
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
  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Guest";

  return (
    <div>
      <h2 className="font-serif text-3xl">Profile</h2>
      <p className="mt-2 text-sm text-muted-foreground">Your personal details and activity.</p>

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
