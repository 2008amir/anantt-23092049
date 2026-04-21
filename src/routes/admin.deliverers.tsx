import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Truck, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/deliverers")({
  component: DeliverersPage,
});

type Deliverer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  state: string;
  city: string | null;
  active: boolean;
  user_id: string | null;
  created_at: string;
};

function DeliverersPage() {
  const [list, setList] = useState<Deliverer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    state: "",
    city: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase
      .from("deliverers")
      .select("*")
      .order("created_at", { ascending: false });
    setList((data ?? []) as Deliverer[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.state.trim()) {
      return setError("Name, email, phone, and state are required.");
    }
    setBusy(true);
    const { error } = await supabase.from("deliverers").insert({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      state: form.state.trim(),
      city: form.city.trim() || null,
      active: true,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setNotice(
      `Deliverer registered. Tell them to sign up using ${form.email.trim().toLowerCase()} — they'll automatically gain access to their delivery dashboard.`,
    );
    setForm({ name: "", email: "", phone: "", state: "", city: "" });
    setShowForm(false);
    await load();
  };

  const toggleActive = async (d: Deliverer) => {
    await supabase.from("deliverers").update({ active: !d.active }).eq("id", d.id);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this deliverer?")) return;
    await supabase.from("deliverers").delete().eq("id", id);
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl">Deliverers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Register delivery staff. They sign up with the same email to get a delivery dashboard.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs uppercase tracking-wider text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> {showForm ? "Cancel" : "Register deliverer"}
        </button>
      </div>

      {notice && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
          {notice}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-lg border border-border/40 bg-card p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="Email (used to sign in)">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="State">
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="input"
                required
              />
            </Field>
            <Field label="City (optional)">
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-gold-gradient px-5 py-2 text-xs uppercase tracking-wider text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Registering…" : "Register"}
          </button>
          <style>{`.input{width:100%;border:1px solid hsl(var(--border) / 0.4);background:hsl(var(--background));border-radius:6px;padding:8px 12px;font-size:14px;outline:none}.input:focus{border-color:hsl(var(--primary))}`}</style>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-border/40 bg-card p-12 text-center">
          <Truck className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No deliverers registered yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/40 bg-card">
          {list.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-5 py-4 last:border-0"
            >
              <div>
                <p className="font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">
                  {d.email} · {d.phone} · {d.city ? `${d.city}, ` : ""}
                  {d.state}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-wider">
                  {d.user_id ? (
                    <span className="text-primary">● Linked to user account</span>
                  ) : (
                    <span className="text-muted-foreground">○ Awaiting signup</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void toggleActive(d)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-[11px] uppercase tracking-wider hover:bg-muted"
                >
                  {d.active ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Active
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground" /> Inactive
                    </>
                  )}
                </button>
                <button
                  onClick={() => void remove(d.id)}
                  className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
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
