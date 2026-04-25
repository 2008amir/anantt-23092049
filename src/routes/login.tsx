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
import { requestAuthCode, verifyAuthCode } from "@/lib/auth-codes.functions";

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
  // signup: 1 = details, 2 = password, 3 = verify code
  // signin: 1 = email+password, 2 = verify code
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Signin fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [referralCode, setReferralCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Verification code
  const [code, setCode] = useState("");
  const [resendBusy, setResendBusy] = useState(false);

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

  // ── Sign in: send code first ─────────────────────────────────────
  const signinSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
    if (!password) return setError("Please enter your password");
    setBusy(true);
    try {
      // Verify password is correct BEFORE sending a code (avoids leaking codes
      // for wrong-password attempts but doesn't sign the user in yet — we
      // immediately sign back out and require the code).
      const { error: pwErr } = await supabase.auth.signInWithPassword({ email, password });
      if (pwErr) {
        if (pwErr.message.toLowerCase().includes("invalid login")) {
          setError("Invalid email or password.");
        } else {
          setError(pwErr.message);
        }
        return;
      }
      await supabase.auth.signOut();

      await requestAuthCode({ data: { email, purpose: "signin" } });
      setCode("");
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  };

  const signinVerifyAndLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    setBusy(true);
    try {
      await verifyAuthCode({ data: { email, code, purpose: "signin" } });
      await signIn(email, password);
      // navigation handled by the useEffect above
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  // ── Sign up: details → password → verify code ────────────────────
  const signupStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim()) return setError("First name is required");
    if (!lastName.trim()) return setError("Last name is required");
    if (!country) return setError("Please select a country");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
    setStep(2);
  };

  const signupSendCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isPasswordValid(password)) return setError("Password does not meet all requirements");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setBusy(true);
    try {
      await requestAuthCode({ data: { email, purpose: "signup" } });
      setCode("");
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  };

  const signupVerifyAndCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    setBusy(true);
    try {
      await verifyAuthCode({ data: { email, code, purpose: "signup" } });
      await signUp(email, password, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
        country,
        referralCode: referralCode.trim() || undefined,
      });
      // navigation handled by useEffect once auth state changes
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (
        msg.toLowerCase().includes("already registered") ||
        msg.toLowerCase().includes("user already")
      ) {
        setError("An account with that email already exists. Try signing in.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setResendBusy(true);
    try {
      await requestAuthCode({
        data: { email, purpose: mode === "signup" ? "signup" : "signin" },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code");
    } finally {
      setResendBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setStep(1);
    setError("");
    setCode("");
  };

  const heading = (() => {
    if (mode === "signin") {
      return step === 1 ? "Sign In" : "Verify It's You";
    }
    if (step === 1) return "Create Account";
    if (step === 2) return "Set Password";
    return "Verify Your Email";
  })();

  const subhead = (() => {
    if (mode === "signin") {
      return step === 1 ? "Welcome Back" : "Enter Your Code";
    }
    if (step === 1) return "Join the House";
    if (step === 2) return "Secure Your Account";
    return "Almost There";
  })();

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-border bg-card/50 p-10 shadow-luxury">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-primary">{subhead}</p>
        <h1 className="mt-3 text-center font-serif text-4xl">{heading}</h1>

        {/* ─── SIGN IN ─────────────────────────────────────────── */}
        {mode === "signin" && step === 1 && (
          <form onSubmit={signinSendCode} className="mt-8 space-y-4">
            <Input label="Email" type="email" value={email} onChange={setEmail} />
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Sending code…" : "Sign In"}
            </button>
          </form>
        )}

        {mode === "signin" && step === 2 && (
          <CodeStep
            email={email}
            code={code}
            setCode={setCode}
            onSubmit={signinVerifyAndLogin}
            onResend={resendCode}
            onBack={() => { setStep(1); setError(""); }}
            busy={busy}
            resendBusy={resendBusy}
            error={error}
            ctaLabel="Sign In"
            ctaBusyLabel="Signing in…"
          />
        )}

        {/* ─── SIGN UP ─────────────────────────────────────────── */}
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
          <form onSubmit={signupSendCode} className="mt-8 space-y-4">
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
              {busy ? "Sending code…" : "Continue →"}
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

        {mode === "signup" && step === 3 && (
          <CodeStep
            email={email}
            code={code}
            setCode={setCode}
            onSubmit={signupVerifyAndCreate}
            onResend={resendCode}
            onBack={() => { setStep(2); setError(""); }}
            busy={busy}
            resendBusy={resendBusy}
            error={error}
            ctaLabel="Create Account"
            ctaBusyLabel="Creating account…"
          />
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

function CodeStep({
  email,
  code,
  setCode,
  onSubmit,
  onResend,
  onBack,
  busy,
  resendBusy,
  error,
  ctaLabel,
  ctaBusyLabel,
}: {
  email: string;
  code: string;
  setCode: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onResend: () => void;
  onBack: () => void;
  busy: boolean;
  resendBusy: boolean;
  error: string;
  ctaLabel: string;
  ctaBusyLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        We sent a 6-digit code to <span className="text-foreground">{email}</span>
      </p>
      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Verification Code</span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="mt-2 w-full border border-border bg-background px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-foreground outline-none transition-smooth focus:border-primary"
          placeholder="••••••"
        />
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
      >
        {busy && <Spinner />}
        {busy ? ctaBusyLabel : ctaLabel}
      </button>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="py-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-primary"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={resendBusy}
          className="flex items-center gap-2 py-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-primary disabled:opacity-60"
        >
          {resendBusy && <Spinner />}
          {resendBusy ? "Sending…" : "Resend code"}
        </button>
      </div>
    </form>
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
