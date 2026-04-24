import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL } from "@/hooks/use-admin";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Maison Luxe" }] }),
  component: Login,
});

function Login() {
  const { user, signIn, signUp } = useStore();
  const navigate = useNavigate();

  // Auto-route signed-in users to the right place (admin / deliverer / account)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      if (user.email?.toLowerCase() === ADMIN_EMAIL) {
        if (!cancelled) void navigate({ to: "/admin" });
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (cancelled) return;
      const r = (roles ?? []).map((x) => x.role);
      if (r.includes("admin")) void navigate({ to: "/admin" });
      else if (r.includes("deliverer")) void navigate({ to: "/deliverer" });
      else void navigate({ to: "/account" });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<1 | 2>(1);

  // Signin fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [referralCode, setReferralCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Prefill referral code from ?ref=
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("ml_ref_code");
      if (saved) setReferralCode(saved);
    } catch {
      // ignore
    }
  }, []);

  const signinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (msg.toLowerCase().includes("invalid login")) setError("Invalid email or password.");
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const signupStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim()) return setError("First name is required");
    if (!lastName.trim()) return setError("Last name is required");
    if (!country) return setError("Please select a country");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
    setStep(2);
  };

  const signupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setBusy(true);
    try {
      await signUp(email, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        country,
        referralCode: referralCode.trim() || undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already")) {
        setError("An account with that email already exists. Try signing in.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setStep(1);
    setError("");
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-border bg-card/50 p-10 shadow-luxury">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-primary">
          {mode === "signin" ? "Welcome Back" : step === 1 ? "Join the House" : "Secure Your Account"}
        </p>
        <h1 className="mt-3 text-center font-serif text-4xl">
          {mode === "signin" ? "Sign In" : step === 1 ? "Create Account" : "Set Password"}
        </h1>

        {mode === "signin" && (
          <form onSubmit={signinSubmit} className="mt-8 space-y-4">
            <Input label="Email" type="email" value={email} onChange={setEmail} />
            <Input label="Password" type="password" value={password} onChange={setPassword} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Sign In"}
            </button>
          </form>
        )}

        {mode === "signup" && step === 1 && (
          <form onSubmit={signupStep1} className="mt-8 space-y-4">
            <Input label="First Name" value={firstName} onChange={setFirstName} />
            <Input label="Last Name" value={lastName} onChange={setLastName} />
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Country</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary"
              >
                <option value="Nigeria">Nigeria</option>
              </select>
            </label>
            <Input label="Email" type="email" value={email} onChange={setEmail} />
            <Input label="Referral Code (optional)" value={referralCode} onChange={setReferralCode} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              className="w-full bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90"
            >
              Continue →
            </button>
          </form>
        )}

        {mode === "signup" && step === 2 && (
          <form onSubmit={signupSubmit} className="mt-8 space-y-4">
            <Input label="Create Password" type="password" value={password} onChange={setPassword} />
            <Input label="Confirm Password" type="password" value={confirmPassword} onChange={setConfirmPassword} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Creating account…" : "Create Account"}
            </button>
            <button
              type="button"
              onClick={() => { setStep(1); setError(""); }}
              className="w-full py-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-primary"
            >
              ← Back
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already a member? "}
          <button type="button" onClick={switchMode} className="text-primary underline">
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">← Return to shop</Link>
        </p>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary"
      />
    </label>
  );
}
