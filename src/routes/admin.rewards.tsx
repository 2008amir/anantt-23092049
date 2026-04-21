import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Gift, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/rewards")({
  component: RewardsPage,
});

type Reward = {
  id: string;
  title: string;
  description: string;
  image: string | null;
  points: number;
  is_free: boolean;
  created_at: string;
};

function RewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    image: "",
    points: 0,
    is_free: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("rewards")
      .select("*")
      .order("created_at", { ascending: false });
    setRewards((data ?? []) as Reward[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("Title is required.");
    setBusy(true);
    const { error } = await supabase.from("rewards").insert({
      title: form.title.trim(),
      description: form.description.trim(),
      image: form.image.trim() || null,
      points: Number(form.points) || 0,
      is_free: form.is_free,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setForm({ title: "", description: "", image: "", points: 0, is_free: false });
    setShowForm(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this reward?")) return;
    await supabase.from("rewards").delete().eq("id", id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Rewards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create rewards customers can redeem with points.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {showForm ? "Cancel" : "New reward"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-lg border border-border/40 bg-card p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="Image URL (optional)">
              <input
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                className="input"
                placeholder="https://…"
              />
            </Field>
            <Field label="Points required">
              <input
                type="number"
                min={0}
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                className="input"
              />
            </Field>
            <Field label="Free reward">
              <label className="flex items-center gap-2 pt-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_free}
                  onChange={(e) => setForm({ ...form, is_free: e.target.checked })}
                />
                Mark as free reward
              </label>
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input min-h-[80px]"
            />
          </Field>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-gold-gradient px-5 py-2 text-xs uppercase tracking-wider text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Saving…" : "Create reward"}
          </button>
          <style>{`.input{width:100%;border:1px solid hsl(var(--border) / 0.4);background:hsl(var(--background));border-radius:6px;padding:8px 12px;font-size:14px;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rewards.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card p-12 text-center">
          <Gift className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No rewards yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-lg border border-border/40 bg-card">
              {r.image && (
                <img src={r.image} alt={r.title} className="aspect-video w-full object-cover" />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{r.title}</p>
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
                <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-wider">
                  {r.is_free ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Free</span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5">{r.points} pts</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
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
