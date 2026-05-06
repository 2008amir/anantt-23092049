import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, Loader2, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import { useIsAdmin } from "@/hooks/use-admin";
import { initFlutterwave, verifyFlutterwave } from "@/lib/flutterwave.functions";
import { openFlutterwavePopup } from "@/lib/flutterwave-popup";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/account/settings")({
  component: SettingsPanel,
});

const CARD_BRAND_LOGOS: Record<string, string> = {
  visa: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Visa_Inc._logo.svg",
  mastercard: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg",
  verve: "https://res.cloudinary.com/dkw8oolgs/image/upload/v1700000000/verve_logo.png",
  amex: "https://upload.wikimedia.org/wikipedia/commons/f/fa/American_Express_logo_%282018%29.svg",
};

function brandLogo(brand: string) {
  const k = brand.toLowerCase();
  if (k.includes("visa")) return CARD_BRAND_LOGOS.visa;
  if (k.includes("master")) return CARD_BRAND_LOGOS.mastercard;
  if (k.includes("verve")) return CARD_BRAND_LOGOS.verve;
  if (k.includes("amex") || k.includes("american")) return CARD_BRAND_LOGOS.amex;
  return null;
}

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  exp_month: string;
  exp_year: string;
  card_holder: string;
  is_default: boolean;
};

function SettingsPanel() {
  const { user, profile, signOut, refresh } = useStore();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardSuccess, setCardSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    void loadCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadCards() {
    if (!user) return;
    setLoadingCards(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("payment_methods")
      .select("id, brand, last4, exp_month, exp_year, card_holder, is_default")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setCards((data ?? []) as SavedCard[]);
    setLoadingCards(false);
  }

  if (!user) return null;

  const saveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    setSavingProfile(false);
    if (error) console.error(error);
    else await refresh();
  };

  // Real card verification via a ₦50 Flutterwave charge — proves the card is valid
  // and gives us a reusable token for future payments.
  const addCard = async () => {
    if (!user?.email) return;
    setCardError(null);
    setCardSuccess(null);
    setVerifying(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("Please sign in again to save a card.");

      const tx_ref = `verify-${user.id}-${Date.now()}`;
      await initFlutterwave({
        data: {
          amount: 50,
          email: user.email,
          tx_ref,
          callbackUrl: window.location.origin + "/account/settings",
          paymentOptions: "card",
          meta: { purpose: "card_verification" },
          accessToken,
        },
      });
      const result = await openFlutterwavePopup({
        email: user.email,
        amount: 50,
        tx_ref,
        paymentOptions: "card",
        title: "Verify card",
        description: "₦50 authorization to save your card",
        meta: { purpose: "card_verification" },
      });
      if (!result) {
        setCardError("Card verification cancelled.");
        return;
      }
      const verified = await verifyFlutterwave({
        data: { tx_ref: result.tx_ref, transaction_id: result.transaction_id, saveCard: true, accessToken },
      });
      if (!verified.success) {
        setCardError("Card could not be verified. Please try a different card.");
        return;
      }
      setCardSuccess("Card verified and saved.");
      await loadCards();
    } catch (e) {
      console.error(e);
      setCardError(e instanceof Error ? e.message : "Failed to verify card");
    } finally {
      setVerifying(false);
    }
  };

  const removeCard = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("payment_methods").delete().eq("id", id);
    await loadCards();
  };

  const setDefault = async (id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    await sb.from("payment_methods").update({ is_default: false }).eq("user_id", user.id);
    await sb.from("payment_methods").update({ is_default: true }).eq("id", id);
    await loadCards();
  };

  return (
    <div>
      <h2 className="font-serif text-3xl">Account Settings</h2>
      <p className="mt-2 text-sm text-muted-foreground">Manage your account, preferences and payment methods.</p>

      <div className="mt-8 space-y-6">
        <Section title="Personal Information">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Email" value={user.email ?? ""} readOnly />
        </Section>

        <Section title="Preferences">
          <Select label="Currency" options={["NGN (₦)", "USD ($)", "EUR (€)", "GBP (£)"]} />
          <Select label="Language" options={["English", "Français", "Italiano"]} />

          <div className="sm:col-span-2 mt-4 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.25em] text-primary">Payment Methods</p>
              <button
                type="button"
                onClick={() => void addCard()}
                disabled={verifying}
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
              >
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {verifying ? "Verifying…" : "Add card"}
              </button>
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground">
              We securely verify your card with Flutterwave. A small ₦50 authorization charge confirms the card is real.
              We never store your card number or CVV.
            </p>

            {cardError && <p className="mt-2 text-xs text-destructive">{cardError}</p>}
            {cardSuccess && (
              <p className="mt-2 flex items-center gap-1 text-xs text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> {cardSuccess}
              </p>
            )}

            {loadingCards ? (
              <div className="mt-3 flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : cards.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No payment methods saved.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {cards.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border border-border bg-background px-4 py-3">
                    <div className="flex items-center gap-3">
                      {brandLogo(c.brand) ? (
                        <img src={brandLogo(c.brand)!} alt={c.brand} className="h-7 w-12 object-contain" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-primary" />
                      )}
                      <div>
                        <p className="text-sm text-foreground">
                          {c.brand} •••• {c.last4}{" "}
                          {c.is_default && (
                            <span className="ml-2 rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-primary">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.card_holder} · Exp {c.exp_month}/{c.exp_year}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!c.is_default && (
                        <button
                          type="button"
                          onClick={() => void setDefault(c.id)}
                          className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
                        >
                          Make default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeCard(c.id)}
                        aria-label="Remove"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section title="Security">
          <Field label="New Password" type="password" />
          <Field label="Confirm Password" type="password" />
        </Section>

        <div className="border border-border p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-primary">Appearance</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Theme</p>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <button
            type="button"
            onClick={() => void saveProfile()}
            disabled={savingProfile}
            className="bg-gold-gradient px-8 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground disabled:opacity-60"
          >
            {savingProfile ? "Saving…" : "Save Changes"}
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate({ to: "/admin" })}
              className="border border-primary/40 px-8 py-3 text-xs uppercase tracking-[0.25em] text-primary hover:bg-primary/10"
            >
              Switch to Admin Panel
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
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
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly,
}: {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
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
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
