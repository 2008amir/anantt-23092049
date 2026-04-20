import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/account/settings")({
  component: SettingsPanel,
});

type SavedCard = { id: string; brand: string; last4: string; exp: string };

function SettingsPanel() {
  const { user, profile, signOut, refresh } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [showAddCard, setShowAddCard] = useState(false);

  // Card form
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name);
  }, [profile]);

  // Local-only payment list (cards are NEVER saved to DB for security)
  useEffect(() => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(`lux_cards_${user.id}`);
      if (raw) setCards(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, [user]);

  if (!user) return null;

  const persistCards = (list: SavedCard[]) => {
    setCards(list);
    try { localStorage.setItem(`lux_cards_${user.id}`, JSON.stringify(list)); } catch { /* ignore */ }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    setSavingProfile(false);
    if (error) console.error(error);
    else await refresh();
  };

  const addCard = () => {
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 13 || !cardName || !cardExp || cardCvc.length < 3) return;
    const brand = digits.startsWith("4") ? "Visa" : digits.startsWith("5") ? "Mastercard" : "Card";
    persistCards([
      ...cards,
      { id: crypto.randomUUID(), brand, last4: digits.slice(-4), exp: cardExp },
    ]);
    setCardNumber(""); setCardName(""); setCardExp(""); setCardCvc("");
    setShowAddCard(false);
  };

  const removeCard = (id: string) => persistCards(cards.filter((c) => c.id !== id));

  return (
    <div>
      <h2 className="font-serif text-3xl">Account Settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">Manage your account, preferences and payment methods.</p>

      <div className="mt-8 space-y-6">
        {/* Personal */}
        <Section title="Personal Information">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Email" value={user.email ?? ""} readOnly />
        </Section>

        {/* Preferences (with Payment inside) */}
        <Section title="Preferences">
          <Select label="Currency" options={["USD ($)", "EUR (€)", "GBP (£)"]} />
          <Select label="Language" options={["English", "Français", "Italiano"]} />

          <div className="sm:col-span-2 mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.25em] text-primary">Payment Methods</p>
              <button
                type="button"
                onClick={() => setShowAddCard((v) => !v)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> {showAddCard ? "Cancel" : "Add card"}
              </button>
            </div>

            {cards.length === 0 && !showAddCard ? (
              <p className="mt-3 text-sm text-muted-foreground">No payment methods saved.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {cards.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border border-border bg-background px-4 py-3">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <p className="text-sm text-foreground">{c.brand} •••• {c.last4}</p>
                      <p className="text-xs text-muted-foreground">Exp {c.exp}</p>
                    </div>
                    <button type="button" onClick={() => removeCard(c.id)} aria-label="Remove" className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showAddCard && (
              <div className="mt-4 grid gap-3 border border-border bg-background p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Card Number" value={cardNumber} onChange={setCardNumber} placeholder="1234 5678 9012 3456" />
                </div>
                <div className="sm:col-span-2">
                  <Field label="Cardholder Name" value={cardName} onChange={setCardName} />
                </div>
                <Field label="Expiry (MM/YY)" value={cardExp} onChange={setCardExp} placeholder="12/27" />
                <Field label="CVC" value={cardCvc} onChange={setCardCvc} placeholder="123" />
                <div className="sm:col-span-2">
                  <button type="button" onClick={addCard} className="w-full bg-gold-gradient py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground">
                    Save Card
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Security */}
        <Section title="Security">
          <Field label="New Password" type="password" />
          <Field label="Confirm Password" type="password" />
        </Section>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={savingProfile}
            className="bg-gold-gradient px-8 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground disabled:opacity-60"
          >
            {savingProfile ? "Saving…" : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="border border-destructive/40 px-8 py-3 text-xs uppercase tracking-[0.25em] text-destructive hover:bg-destructive/10"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border p-6">
      <p className="text-xs uppercase tracking-[0.25em] text-primary">{title}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, readOnly,
}: {
  label: string; value?: string; onChange?: (v: string) => void; type?: string; placeholder?: string; readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value ?? ""}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary disabled:opacity-60"
      />
    </label>
  );
}

function Select({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <select className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
