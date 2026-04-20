import { createFileRoute, Link } from "@tanstack/react-router";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account/orders")({
  component: AccountOrders,
});

function AccountOrders() {
  const { orders } = useStore();
  return (
    <div>
      <h2 className="font-serif text-3xl">Order History</h2>
      <p className="mt-2 text-sm text-muted-foreground">A record of every piece in your collection.</p>

      {orders.length === 0 ? (
        <p className="mt-12 text-center text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to="/orders/$id"
              params={{ id: o.id }}
              className="flex items-center justify-between border border-border p-4 transition-smooth hover:border-primary"
            >
              <div>
                <p className="font-serif text-lg">{o.id}</p>
                <p className="text-xs text-muted-foreground">{new Date(o.date).toLocaleDateString()} · {o.status}</p>
              </div>
              <p className="text-primary">${o.total.toFixed(2)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
