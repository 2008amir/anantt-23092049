import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Check, Truck, Package } from "lucide-react";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/orders/$id")({
  head: ({ params }) => ({ meta: [{ title: `Order ${params.id} — Maison Luxe` }] }),
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const { orders } = useStore();
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <div className="container mx-auto px-6 py-24 text-center">
        <h1 className="font-serif text-4xl">Order not found</h1>
        <Link to="/orders" className="mt-6 inline-block text-primary underline">View all orders</Link>
      </div>
    );
  }

  const statusSteps = [
    { label: "Confirmed", icon: Check, done: true },
    { label: "Processing", icon: Package, done: order.status !== "Processing" || true },
    { label: "Shipped", icon: Truck, done: order.status === "Shipped" || order.status === "Delivered" },
    { label: "Delivered", icon: Check, done: order.status === "Delivered" },
  ];

  return (
    <div className="container mx-auto px-6 py-16">
      <Link to="/orders" className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-primary">
        ← All Orders
      </Link>

      <div className="mt-6 border-b border-border pb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Confirmation</p>
        <h1 className="mt-3 font-serif text-5xl">Thank you for your order</h1>
        <p className="mt-3 text-muted-foreground">
          Order <span className="text-foreground">{order.id}</span> · placed{" "}
          {new Date(order.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      {/* Tracking */}
      <section className="mt-12 border border-border bg-card/50 p-8">
        <h2 className="font-serif text-2xl">Shipping Status</h2>
        <div className="mt-8 flex items-center justify-between">
          {statusSteps.map((s, i) => (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full border ${
                    s.done ? "border-primary bg-gold-gradient text-primary-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  <s.icon className="h-5 w-5" />
                </div>
                <span className={`mt-2 text-xs uppercase tracking-[0.2em] ${s.done ? "text-primary" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {i < statusSteps.length - 1 && (
                <div className={`mx-2 h-px flex-1 ${statusSteps[i + 1].done ? "bg-primary" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section>
          <h2 className="font-serif text-2xl">Items</h2>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {order.items.map((it, i) => (
              <div key={i} className="flex gap-4 py-4">
                <img src={it.image} alt={it.name} className="h-24 w-24 border border-border object-cover" />
                <div className="flex-1">
                  <p className="font-serif text-xl">{it.name}</p>
                  <p className="text-xs text-muted-foreground">Quantity {it.quantity}</p>
                </div>
                <p className="text-primary">${(it.price * it.quantity).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="h-fit space-y-6">
          <div className="border border-border bg-card/50 p-6">
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary">Shipping To</p>
            <div className="mt-3 space-y-1 text-sm">
              <p>{order.shipping.name}</p>
              <p className="text-muted-foreground">{order.shipping.address}</p>
              <p className="text-muted-foreground">{order.shipping.city}, {order.shipping.zip}</p>
              <p className="text-muted-foreground">{order.shipping.country}</p>
            </div>
          </div>
          <div className="border border-border bg-card/50 p-6">
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary">Total Paid</p>
            <p className="mt-2 font-serif text-3xl text-gold-gradient">${order.total.toFixed(2)}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
