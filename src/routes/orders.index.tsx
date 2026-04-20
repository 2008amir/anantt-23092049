import { createFileRoute, Link } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "Orders — Maison Luxe" }] }),
  component: OrdersPage,
});

function OrdersPage() {
  const { orders } = useStore();

  return (
    <div className="container mx-auto px-6 py-16">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">History</p>
        <h1 className="mt-3 font-serif text-5xl">Your Orders</h1>
      </header>

      {orders.length === 0 ? (
        <div className="py-24 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">No orders yet.</p>
          <Link to="/shop" className="mt-6 inline-flex bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              to="/orders/$id"
              params={{ id: order.id }}
              className="block border border-border bg-card/50 p-6 transition-smooth hover:border-primary"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-primary">{order.status}</p>
                  <p className="mt-2 font-serif text-2xl">{order.id}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Placed {new Date(order.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</p>
                  <p className="mt-1 font-serif text-2xl text-gold-gradient">${order.total.toFixed(2)}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {order.items.slice(0, 4).map((it, i) => (
                  <img key={i} src={it.image} alt={it.name} className="h-14 w-14 border border-border object-cover" />
                ))}
                {order.items.length > 4 && (
                  <div className="flex h-14 w-14 items-center justify-center border border-border text-xs text-muted-foreground">
                    +{order.items.length - 4}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
