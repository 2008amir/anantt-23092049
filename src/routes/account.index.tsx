import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account/")({
  component: ProfilePanel,
});

function ProfilePanel() {
  const { user, orders, wishlist } = useStore();
  if (!user) return null;

  return (
    <div>
      <h2 className="font-serif text-3xl">Profile</h2>
      <p className="mt-2 text-sm text-muted-foreground">Your personal details and activity.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Field label="Name" value={user.name} />
        <Field label="Email" value={user.email} />
        <Field label="Member Since" value={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
        <Field label="Tier" value="Connoisseur" />
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        <Stat label="Orders" value={orders.length} />
        <Stat label="Saved Pieces" value={wishlist.length} />
        <Stat label="Lifetime" value={`$${orders.reduce((s, o) => s + o.total, 0).toFixed(0)}`} />
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
