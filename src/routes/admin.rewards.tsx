import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Gift, Plus, Trash2, Users, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/lib/store";
import { formatNaira } from "@/lib/price";

export const Route = createFileRoute("/admin/rewards")({
  component: RewardsPage,
});

type TaskType = "referral" | "purchase";

type RewardRow = {
  id: string;
  title: string;
  description: string;
  image: string | null;
  task_type: string;
  referral_goal: number | null;
  expires_hours: number | null;
  reward_price: number | null;
  product_amount: number | null;
  require_purchase: boolean;
  purchase_percent: number | null;
  is_active: boolean;
  created_at: string;
};

const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "14 days", hours: 336 },
  { label: "30 days", hours: 720 },
];

function RewardsPage() {
  const [rewards, setRewards] = useState<RewardRow[]>([]);
  const [productsByReward, setProductsByReward] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [taskType, setTaskType] = useState<TaskType>("referral");

  const [form, setForm] = useState({
    title: "",
    description: "",
    image: "",
    referral_goal: 5,
    expires_hours: 168,
    reward_price: 0,
    product_amount: 1,
    require_purchase: false,
    purchase_percent: 70,
    pinned_products: [] as string[],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { products } = useProducts();

  const load = async () => {
    const { data } = await supabase
      .from("rewards")
      .select("*")
      .in("task_type", ["referral", "purchase"])
      .order("created_at", { ascending: false });
    const list = (data ?? []) as unknown as RewardRow[];
    setRewards(list);
    if (list.length) {
      const { data: tp } = await supabase
        .from("reward_task_products")
        .select("reward_id, product_id")
        .in("reward_id", list.map((r) => r.id));
      const map: Record<string, string[]> = {};
      for (const row of (tp ?? []) as { reward_id: string; product_id: string }[]) {
        (map[row.reward_id] ||= []).push(row.product_id);
      }
      setProductsByReward(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const resetForm = () => {
    setForm({
      title: "",
      description: "",
      image: "",
      referral_goal: 5,
      expires_hours: 168,
      reward_price: 0,
      product_amount: 1,
      require_purchase: false,
      purchase_percent: 70,
      pinned_products: [],
    });
    setTaskType("referral");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("Title is required.");
    if (Number(form.reward_price) <= 0) return setError("Reward price must be greater than 0.");
    if (taskType === "referral") {
      if (Number(form.referral_goal) <= 0) return setError("Number of users to refer is required.");
      if (Number(form.expires_hours) <= 0) return setError("Expiry time is required.");
    } else {
      if (Number(form.product_amount) <= 0) return setError("Products amount is required.");
    }

    setBusy(true);
    const insertPayload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim(),
      image: form.image.trim() || null,
      task_type: taskType,
      reward_price: Number(form.reward_price),
      is_free: true,
      points: 0,
      is_active: true,
    };
    if (taskType === "referral") {
      insertPayload.referral_goal = Number(form.referral_goal);
      insertPayload.expires_hours = Number(form.expires_hours);
      insertPayload.require_purchase = form.require_purchase;
      insertPayload.purchase_percent = form.require_purchase ? Number(form.purchase_percent) : null;
    } else {
      insertPayload.product_amount = Number(form.product_amount);
      insertPayload.expires_hours = Number(form.expires_hours) || null;
    }

    const { data: created, error: insertError } = await supabase
      .from("rewards")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(insertPayload as any)
      .select()
      .single();
    if (insertError || !created) {
      setBusy(false);
      setError(insertError?.message ?? "Failed to create");
      return;
    }

    if (form.pinned_products.length > 0) {
      const rows = form.pinned_products.map((pid) => ({
        reward_id: created.id,
        product_id: pid,
      }));
      const { error: ppError } = await supabase.from("reward_task_products").insert(rows);
      if (ppError) {
        setBusy(false);
        setError(ppError.message);
        return;
      }
    }

    setBusy(false);
    resetForm();
    setShowForm(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this reward task?")) return;
    await supabase.from("rewards").delete().eq("id", id);
    await load();
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    await supabase.from("rewards").update({ is_active: !is_active }).eq("id", id);
    await load();
  };

  const togglePinned = (productId: string) => {
    setForm((f) => ({
      ...f,
      pinned_products: f.pinned_products.includes(productId)
        ? f.pinned_products.filter((id) => id !== productId)
        : [...f.pinned_products, productId],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Reward Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create referral or purchase tasks. Users who complete them earn free products.
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            setShowForm((s) => !s);
          }}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {showForm ? "Cancel" : "New task"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-5 rounded-lg border border-border/40 bg-card p-5"
        >
          {/* Task type selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTaskType("referral")}
              className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                taskType === "referral"
                  ? "border-primary bg-primary/5"
                  : "border-border/40 hover:border-border"
              }`}
            >
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Referral task</p>
                <p className="text-xs text-muted-foreground">Invite friends to earn</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setTaskType("purchase")}
              className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                taskType === "purchase"
                  ? "border-primary bg-primary/5"
                  : "border-border/40 hover:border-border"
              }`}
            >
              <ShoppingBag className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Purchase task</p>
                <p className="text-xs text-muted-foreground">Buy X products to earn</p>
              </div>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="Image (optional)">
              <div className="space-y-2">
                {form.image && (
                  <img src={form.image} alt="" className="h-24 w-24 rounded object-cover border border-border/40" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const path = `rewards/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
                    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { cacheControl: "3600", upsert: false });
                    if (upErr) { setError(upErr.message); return; }
                    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
                    setForm((f) => ({ ...f, image: urlData.publicUrl }));
                  }}
                  className="text-xs"
                />
              </div>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input min-h-[70px]"
            />
          </Field>

          {taskType === "referral" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="How many users to refer">
                <input
                  type="number"
                  min={1}
                  value={form.referral_goal}
                  onChange={(e) => setForm({ ...form, referral_goal: Number(e.target.value) })}
                  className="input"
                />
              </Field>
              <Field label="Expiry time">
                <select
                  value={form.expires_hours}
                  onChange={(e) => setForm({ ...form, expires_hours: Number(e.target.value) })}
                  className="input"
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.hours} value={o.hours}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reward price (₦) — products ≤ this are free">
                <input
                  type="number"
                  min={0}
                  value={form.reward_price}
                  onChange={(e) => setForm({ ...form, reward_price: Number(e.target.value) })}
                  className="input"
                />
              </Field>
              <Field label="Referred users must purchase?">
                <label className="flex items-center gap-2 pt-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.require_purchase}
                    onChange={(e) => setForm({ ...form, require_purchase: e.target.checked })}
                  />
                  Require referred users to complete a paid order
                </label>
              </Field>
              {form.require_purchase && (
                <Field label="% of referred users that must purchase">
                  <select
                    value={form.purchase_percent}
                    onChange={(e) => setForm({ ...form, purchase_percent: Number(e.target.value) })}
                    className="input"
                  >
                    <option value={30}>30%</option>
                    <option value={50}>50%</option>
                    <option value={70}>70%</option>
                    <option value={100}>100% (all)</option>
                  </select>
                </Field>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Products amount (how many to buy)">
                <input
                  type="number"
                  min={1}
                  value={form.product_amount}
                  onChange={(e) => setForm({ ...form, product_amount: Number(e.target.value) })}
                  className="input"
                />
              </Field>
              <Field label="Reward price (₦) — free product at/below this">
                <input
                  type="number"
                  min={0}
                  value={form.reward_price}
                  onChange={(e) => setForm({ ...form, reward_price: Number(e.target.value) })}
                  className="input"
                />
              </Field>
              <Field label="Expiry time (optional)">
                <select
                  value={form.expires_hours}
                  onChange={(e) => setForm({ ...form, expires_hours: Number(e.target.value) })}
                  className="input"
                >
                  <option value={0}>No expiry</option>
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.hours} value={o.hours}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}

          {/* Pinned products */}
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Pin specific reward products (optional)
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              If none pinned, user can choose any product at or below the reward price.
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border/40 p-2">
              {products.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">No products available.</p>
              ) : (
                products.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-3 rounded px-2 py-1 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={form.pinned_products.includes(p.id)}
                      onChange={() => togglePinned(p.id)}
                    />
                    <img src={p.image} alt="" className="h-8 w-8 rounded object-cover" />
                    <span className="flex-1 truncate text-sm">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatNaira(p.price)}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-gold-gradient px-5 py-2 text-xs uppercase tracking-wider text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving…" : "Create task"}
          </button>
          <style>{`.input{width:100%;border:1px solid hsl(var(--border) / 0.4);background:hsl(var(--background));border-radius:6px;padding:8px 12px;font-size:14px;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rewards.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card p-12 text-center">
          <Gift className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No reward tasks yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <div
              key={r.id}
              className="overflow-hidden rounded-lg border border-border/40 bg-card"
            >
              {r.image && (
                <img src={r.image} alt={r.title} className="aspect-video w-full object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-primary">
                      {r.task_type === "referral" ? "Referral" : "Purchase"}
                    </span>
                    <p className="font-medium">{r.title}</p>
                  </div>
                  <button
                    onClick={() => void remove(r.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {r.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                )}
                <dl className="mt-3 space-y-1 text-xs">
                  {r.task_type === "referral" && (
                    <>
                      <Row label="Goal" value={`${r.referral_goal} referrals`} />
                      <Row
                        label="Expiry"
                        value={
                          EXPIRY_OPTIONS.find((o) => o.hours === r.expires_hours)?.label ??
                          `${r.expires_hours}h`
                        }
                      />
                      {r.require_purchase && (
                        <Row label="Must buy" value={`${r.purchase_percent}% of referrals`} />
                      )}
                    </>
                  )}
                  {r.task_type === "purchase" && (
                    <Row label="Products to buy" value={`${r.product_amount}`} />
                  )}
                  <Row
                    label="Reward"
                    value={`Free product ≤ ${formatNaira(r.reward_price ?? 0)}`}
                  />
                  <Row label="Pinned" value={`${(productsByReward[r.id] ?? []).length} products`} />
                </dl>
                <button
                  type="button"
                  onClick={() => void toggleActive(r.id, r.is_active)}
                  className={`mt-3 w-full rounded-full px-3 py-1 text-[11px] uppercase tracking-wider ${
                    r.is_active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.is_active ? "Active" : "Inactive"} — tap to toggle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
