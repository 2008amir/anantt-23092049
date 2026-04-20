import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ShieldCheck, Check, Loader2, MapPin, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore, type Address } from "@/lib/store";

export const Route = createFileRoute("/account/addresses")({
  component: AddressesPage,
});

function AddressesPage() {
  const { user } = useStore();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = () => {
    if (!user) return;
    setLoading(true);
    void supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setAddresses((data ?? []) as Address[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const remove = async (id: string) => {
    if (!user) return;
    await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
    load();
  };

  if (adding) {
    return <AddressForm onClose={() => { setAdding(false); load(); }} />;
  }

  return (
    <div>
      <h2 className="font-serif text-3xl">Addresses</h2>
      <p className="mt-2 text-sm text-muted-foreground">Saved shipping addresses.</p>

      {loading ? (
        <div className="mt-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : addresses.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <>
          <div className="mt-6 space-y-3">
            {addresses.map((a) => (
              <div key={a.id} className="border border-border bg-card/40 p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <p className="font-serif text-base text-foreground">
                      {a.first_name} {a.last_name}
                      {a.is_default && (
                        <span className="ml-2 inline-block bg-gold-gradient px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-primary-foreground">Default</span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{a.address_line}</p>
                    <p className="text-sm text-muted-foreground">{a.city}, {a.state} · {a.country}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{a.phone}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(a.id)}
                    aria-label="Delete"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-6 w-full bg-gold-gradient px-6 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground"
          >
            Add new address
          </button>
        </>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mt-8 border border-dashed border-border p-12 text-center">
      <MapPin className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-muted-foreground">No saved addresses yet.</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-4 bg-gold-gradient px-6 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground"
      >
        Add Address
      </button>
    </div>
  );
}

const COUNTRIES = [
  "United States", "United Kingdom", "France", "Italy", "Germany", "Spain",
  "Switzerland", "Japan", "United Arab Emirates", "Singapore", "Canada", "Australia", "Nigeria",
];

const STATES_BY_COUNTRY: Record<string, string[]> = {
  "United States": ["California", "New York", "Texas", "Florida", "Illinois"],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
  "France": ["Île-de-France", "Provence", "Normandy", "Brittany"],
  "Nigeria": ["Lagos", "Abuja", "Rivers", "Kano", "Oyo"],
};

function AddressForm({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useStore();
  const [country, setCountry] = useState("United States");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!country) e.country = "Required";
    if (!firstName) e.firstName = "Please enter your first name.";
    if (!lastName) e.lastName = "Required";
    if (!phone) e.phone = "Required";
    if (!addressLine) e.addressLine = "Required";
    if (!state) e.state = "Required";
    if (!city) e.city = "Required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !validate()) return;
    setSaving(true);
    try {
      if (isDefault) {
        // unset existing default
        await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
      }
      const { error } = await supabase.from("addresses").insert({
        user_id: user.id,
        country,
        first_name: firstName,
        last_name: lastName,
        phone,
        address_line: addressLine,
        state,
        city,
        is_default: isDefault,
      });
      if (error) throw error;
      onClose();
    } catch (err) {
      console.error(err);
      setErrors({ form: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  const states = STATES_BY_COUNTRY[country] ?? ["State / Province"];

  return (
    <div>
      <header className="-mx-6 -mt-6 mb-6 flex items-center justify-between border-b border-border bg-card/30 px-6 py-4">
        <button type="button" onClick={onClose} aria-label="Back" className="text-foreground hover:text-primary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <h2 className="font-serif text-lg text-foreground">Add a new address</h2>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> All data is safeguarded
          </p>
        </div>
        <span className="w-5" />
      </header>

      {/* Trust banner */}
      <div className="-mx-6 mb-6 flex items-center justify-between gap-4 border-y border-primary/30 bg-primary/5 px-6 py-3 text-xs text-primary">
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Free shipping</span>
        <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> 30-day price assurance</span>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Select label="Country / Region" value={country} onChange={(v) => { setCountry(v); setState(""); }} options={COUNTRIES} required />
        <Field label="First name" value={firstName} onChange={setFirstName} error={errors.firstName} required />
        <Field label="Last name" value={lastName} onChange={setLastName} error={errors.lastName} required />
        <Field label="Phone number" value={phone} onChange={setPhone} error={errors.phone} required type="tel" />
        <Field label="Delivery address" value={addressLine} onChange={setAddressLine} error={errors.addressLine} required placeholder="Street number, name, and other details" />
        <Select label="State" value={state} onChange={setState} options={["", ...states]} required error={errors.state} />
        <Field label="City" value={city} onChange={setCity} error={errors.city} required />

        <div className="border-t border-border pt-4">
          <label className="flex items-center justify-between">
            <span className="text-sm text-foreground">Set as default</span>
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-5 w-5 accent-[oklch(0.82_0.11_85)]"
            />
          </label>
        </div>

        {errors.form && <p className="text-xs text-destructive">{errors.form}</p>}

        <div className="-mx-6 -mb-6 border-t border-border bg-card/30 px-6 py-4">
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label, value, onChange, error, type = "text", placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void; error?: string; type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-2 w-full border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary ${
          error ? "border-destructive" : "border-border"
        }`}
      />
      {error && (
        <span className="mt-1 flex items-center gap-1 text-xs text-destructive">⚠ {error}</span>
      )}
    </label>
  );
}

function Select({
  label, value, onChange, options, required, error,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean; error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-2 w-full border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary ${
          error ? "border-destructive" : "border-border"
        }`}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o || "Select"}</option>
        ))}
      </select>
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}
