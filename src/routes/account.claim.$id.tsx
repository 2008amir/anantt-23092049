import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore, useProducts } from "@/lib/store";
import { effectivePrice, formatNaira } from "@/lib/price";
import { fetchTaskProducts, type Enrollment, type RewardTask } from "@/lib/rewards";
import type { Product } from "@/lib/products";
import { toast } from "sonner";

export const Route = createFileRoute("/account/claim/$id")({
  head: () => ({ meta: [{ title: "Claim reward — Luxe Sparkles" }] }),
  component: ClaimPage,
});

function ClaimPage() {
  const { id } = Route.useParams();
  const { user } = useStore();
  const { products, loading: loadingProducts } = useProducts();
  const navigate = useNavigate();

  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [task, setTask] = useState<RewardTask | null>(null);
  const [pinned, setPinned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: enr } = await supabase
        .from("reward_enrollments")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const enrollment = (enr as Enrollment) ?? null;
      setEnrollment(enrollment);
      if (enrollment) {
        const { data: t } = await supabase
          .from("rewards")
          .select("*")
          .eq("id", enrollment.reward_id)
          .maybeSingle();
        if (cancelled) return;
        setTask((t as unknown as RewardTask) ?? null);
        const p = await fetchTaskProducts(enrollment.reward_id);
        if (cancelled) return;
        setPinned(p);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  const eligible: Product[] = useMemo(() => {
    if (!task) return [];
    const cap = Number(task.reward_price ?? 0);
    const pool = pinned.length > 0
      ? products.filter((p) => pinned.includes(p.id))
      : products.filter((p) => effectivePrice(p) <= cap);
    const q = search.trim().toLowerCase();
    const filtered = q
      ? pool.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q),
        )
      : pool;
    return filtered;
  }, [task, pinned, products, search]);

  const placeOrder = async () => {
    if (!user || !enrollment || !task || !selected) return;
    const product = products.find((p) => p.id === selected);
    if (!product) return;
    setPlacing(true);
    try {
      // Require a saved shipping address before we can move to "Processing"
      const { data: addrs } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });
      const list = (addrs ?? []) as Array<{
        first_name: string;
        last_name: string;
        phone: string;
        address_line: string;
        city: string;
        state: string;
        country: string;
      }>;
      if (list.length === 0) {
        toast.error("Please add a shipping address first.");
        navigate({ to: "/account/addresses" });
        return;
      }
      const a = list[0];

      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          subtotal: 0,
          shipping: 0,
          tax: 0,
          total: 0,
          status: "Processing",
          payment_method: "reward",
          payment_status: "paid",
          payment_reference: `reward-${enrollment.id}`,
          shipping_address: {
            reward_claim: true,
            enrollment_id: enrollment.id,
            task_title: task.title,
            name: `${a.first_name} ${a.last_name}`.trim(),
            first_name: a.first_name,
            last_name: a.last_name,
            phone: a.phone,
            address: a.address_line,
            state: a.state,
            city: a.city,
            country: a.country,
          },
        })
        .select()
        .single();
      if (error || !order) throw error ?? new Error("Failed to create order");

      const { error: itemsError } = await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        product_image: product.image,
        price: 0,
        quantity: 1,
        variant: null,
      });
      if (itemsError) throw itemsError;

      await supabase
        .from("reward_enrollments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          claimed_product_id: product.id,
          claimed_order_id: order.id,
        })
        .eq("id", enrollment.id);

      toast.success("Reward claimed — proceed to checkout for delivery");
      navigate({ to: "/orders/$id", params: { id: order.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to claim");
      navigate({ to: "/account/enrolled" });
    } finally {
      setPlacing(false);
    }
  };

  const cancel = () => navigate({ to: "/account/enrolled" });

  if (loading || loadingProducts) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!enrollment || !task) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">Enrollment not found.</p>
        <Link
          to="/account/enrolled"
          className="mt-4 inline-block text-xs uppercase tracking-[0.25em] text-primary hover:underline"
        >
          ← Back to enrolled
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-serif text-2xl">Claim your free product</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {pinned.length > 0
          ? "Choose one of the reward products below."
          : `Choose any product up to ${formatNaira(task.reward_price ?? 0)}. It will be added at ₦0.`}
      </p>

      {pinned.length === 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      )}

      {eligible.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
          No eligible products available.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {eligible.map((p) => {
            const isSelected = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border"
                }`}
              >
                <img src={p.image} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.brand}</p>
                  <p className="mt-1 text-xs">
                    <span className="text-muted-foreground line-through">
                      {formatNaira(effectivePrice(p))}
                    </span>{" "}
                    <span className="font-medium text-primary">₦0</span>
                  </p>
                </div>
                {isSelected && <Check className="h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={cancel}
          className="w-full border border-border py-3 text-xs uppercase tracking-[0.25em] text-muted-foreground transition-smooth hover:border-primary hover:text-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!selected || placing}
          onClick={() => void placeOrder()}
          className="w-full bg-gold-gradient py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
        >
          {placing ? "Processing…" : "Checkout (Free)"}
        </button>
      </div>
    </div>
  );
}
