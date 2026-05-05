import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL } from "@/hooks/use-admin";
import {
  PasswordField,
  PasswordRequirements,
  isPasswordValid,
  Spinner,
} from "@/components/PasswordField";
import { RecaptchaCheckbox, resetRecaptchaWidgets } from "@/lib/recaptcha";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Luxe Sparkles" }] }),
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
  const [success, setSuccess] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

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
    if (!password) return setError("Please enter your password");
    if (!captchaToken) return setError("Please verify you are not a robot");
    setBusy(true);
    try {
      await signIn(email, password, captchaToken);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (msg.toLowerCase().includes("invalid login")) setError("Invalid email or password.");
      else setError(msg);
      resetRecaptchaWidgets();
      setCaptchaToken(null);
    } finally {
      setBusy(false);
    }
  };

  const signupStep1 = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim()) return setError("First name is required");
    if (!lastName.trim()) return setError("Last name is required");
    if (!country) return setError("Please select a country");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
    if (!captchaToken) return setError("Please verify you are not a robot");
    setBusy(true);
    try {
      const { checkEmailExists } = await import("@/lib/device-trust.functions");
      const res = await checkEmailExists({ data: { email } });
      if (res.exists) {
        setError("Email already exists. Please sign in instead.");
        return;
      }
      setStep(2);
      setCaptchaToken(null);
      resetRecaptchaWidgets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify email");
    } finally {
      setBusy(false);
    }
  };

  const signupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isPasswordValid(password)) return setError("Password does not meet all requirements");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setBusy(true);
    try {
      const { collectDeviceSignals } = await import("@/lib/device-fingerprint");
      const device = await collectDeviceSignals();
      const { startSignupVerification } = await import("@/lib/device-trust.functions");
      const res = await startSignupVerification({
        data: {
          email,
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
          country,
          referralCode: referralCode.trim() || undefined,
          deviceFp: device.fingerprint,
        },
      });
      if (!res.ok) {
        if (res.reason === "exists") {
          setError("An account with that email already exists. Try signing in.");
        } else if (res.reason === "email") {
          setError("Could not send verification email. Please try again.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }
      void navigate({
        to: "/verify-signup",
        search: { email },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start verification");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setStep(1);
    setError("");
    setSuccess("");
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
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
            <RecaptchaCheckbox onChange={setCaptchaToken} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Signing in…" : "Sign In"}
            </button>
            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-primary underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <span className="relative bg-card/50 px-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">or</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const { lovable } = await import("@/integrations/lovable");
                  const result = await lovable.auth.signInWithOAuth("google", {
                    redirect_uri: window.location.origin,
                  });
                  if (result.error) {
                    setError("Could not start Google sign-in.");
                  }
                } catch {
                  setError("Google sign-in unavailable.");
                }
              }}
              className="flex w-full items-center justify-center gap-2 border border-border bg-background py-3 text-xs uppercase tracking-[0.25em] text-foreground transition-smooth hover:border-primary hover:text-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2c-.3 1.5-1.1 2.7-2.3 3.6v3h3.7c2.2-2 3.4-4.9 3.4-8.8z"/>
                <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-3c-1 .7-2.4 1.1-3.9 1.1-3 0-5.6-2-6.5-4.8H1.6v3C3.5 21.6 7.4 24 12 24z"/>
                <path fill="#FBBC05" d="M5.5 14.5c-.2-.7-.4-1.4-.4-2.5s.2-1.8.4-2.5v-3H1.6C.6 8.4 0 10.1 0 12s.6 3.6 1.6 5.5l3.9-3z"/>
                <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.4 0 3.5 2.4 1.6 6.5l3.9 3C6.4 6.8 9 4.8 12 4.8z"/>
              </svg>
              Continue with Google
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
            <RecaptchaCheckbox onChange={setCaptchaToken} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Checking…" : "Continue →"}
            </button>
          </form>
        )}

        {mode === "signup" && step === 2 && !success && (
          <form onSubmit={signupSubmit} className="mt-8 space-y-4">
            <PasswordField label="Create Password" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordRequirements password={password} />
            <PasswordField label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" invalid={confirmPassword.length > 0 && confirmPassword !== password} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Creating account…" : "Complete"}
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

        {mode === "signup" && success && (
          <div className="mt-8 space-y-4 text-center">
            <div className="border border-primary/40 bg-primary/5 p-6 text-sm text-foreground">
              {success}
            </div>
            <button
              type="button"
              onClick={() => {
                setSuccess("");
                setMode("signin");
                setStep(1);
                setPassword("");
                setConfirmPassword("");
              }}
              className="w-full bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90"
            >
              Back to Sign In
            </button>
          </div>
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
