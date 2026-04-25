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
import { OtpInput } from "@/components/OtpInput";
import {
  sendVerificationCode,
  verifyAndCreateUser,
  isDeviceKnown,
  registerKnownDevice,
} from "@/lib/auth-otp.functions";
import { collectDeviceSignals, type DeviceSignals } from "@/lib/device-fingerprint";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign In — Maison Luxe" }] }),
  component: Login,
});

type SignupStep = 1 | 2 | 3;
type LoginStep = 1 | 2;

function Login() {
  const { user, signIn } = useStore();
  const navigate = useNavigate();

  // Auto-route signed-in users
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
  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [loginStep, setLoginStep] = useState<LoginStep>(1);

  // Shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [country, setCountry] = useState("Nigeria");
  const [referralCode, setReferralCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // OTP
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  // Prefill referral code
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("ml_ref_code");
      if (saved) setReferralCode(saved);
    } catch {
      // ignore
    }
  }, []);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const headerText = (() => {
    if (mode === "signin") {
      if (loginStep === 2) return { eyebrow: "Verify Device", title: "Enter Code" };
      return { eyebrow: "Welcome Back", title: "Sign In" };
    }
    if (signupStep === 1) return { eyebrow: "Join the House", title: "Create Account" };
    if (signupStep === 2) return { eyebrow: "Secure Your Account", title: "Set Password" };
    return { eyebrow: "Verify Email", title: "Enter Code" };
  })();

  // ─── SIGN IN FLOW ────────────────────────────────────────────────
  const signinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
    if (!password) return setError("Please enter your password");
    setBusy(true);
    try {
      // Verify password BEFORE sending code (so wrong-password attempts don't spam codes)
      const { data: probe, error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr || !probe.session) {
        throw new Error("Invalid email or password.");
      }

      // Check device. We have an active session now — keep it if device is known.
      let device: DeviceSignals | null = null;
      try {
        device = await collectDeviceSignals();
      } catch {
        // ignore — treat as unknown
      }

      const { known } = await isDeviceKnown({
        data: { email, fingerprint: device?.fingerprint ?? "" },
      });

      if (known) {
        // Done — auth state listener will navigate.
        return;
      }

      // Unknown device → sign out, send code, ask user to confirm.
      await supabase.auth.signOut();
      await sendVerificationCode({ data: { email, purpose: "login_2fa" } });
      setLoginStep(2);
      setOtp("");
      setResendIn(60);
      setInfo(`We sent a 6-digit code to ${email}. It expires in 5 minutes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  const verifyLoginCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    setBusy(true);
    try {
      // Verify code via signing in (server checks code first by re-using verifyCode-like flow)
      // We use a dedicated server fn that verifies the code, then we sign in with password.
      const device = await collectDeviceSignals().catch(() => null);

      // Use the verify endpoint indirectly: we just call sign-in after server verifies.
      // Here we call verifyCode by creating a small inline server fn? — instead reuse verifyAndCreateUser path is wrong.
      // We'll call the dedicated verifyCode then signInWithPassword.
      const { verifyCode } = await import("@/lib/auth-otp.functions");
      await verifyCode({ data: { email, purpose: "login_2fa", code: otp } });

      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) throw signErr;

      // Register the device so future logins on it are seamless
      if (device?.fingerprint) {
        try {
          await registerKnownDevice({
            data: {
              email,
              fingerprint: device.fingerprint,
              ip: device.ip,
              userAgent: device.user_agent,
              platform: device.platform,
            },
          });
        } catch {
          // best-effort
        }
      }
      // auth listener navigates
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  // ─── SIGN UP FLOW ────────────────────────────────────────────────
  const signupStep1 = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!firstName.trim()) return setError("First name is required");
    if (!lastName.trim()) return setError("Last name is required");
    if (!country) return setError("Please select a country");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
    setSignupStep(2);
  };

  const signupStep2 = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!isPasswordValid(password)) return setError("Password does not meet all requirements");
    if (password !== confirmPassword) return setError("Passwords do not match");
    setBusy(true);
    try {
      await sendVerificationCode({ data: { email, purpose: "signup" } });
      setSignupStep(3);
      setOtp("");
      setResendIn(60);
      setInfo(`We sent a 6-digit code to ${email}. It expires in 5 minutes.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const verifySignupCode = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) return setError("Enter the 6-digit code");
    setBusy(true);
    try {
      const device = await collectDeviceSignals().catch(() => null);

      await verifyAndCreateUser({
        data: {
          email,
          password,
          code: otp,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName: `${firstName.trim()} ${lastName.trim()}`.trim(),
          country,
          referralCode: referralCode.trim() || undefined,
          deviceFp: device?.fingerprint,
        },
      });

      // Sign in
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signErr) throw signErr;

      // Register this device as trusted for the new user
      if (device?.fingerprint) {
        try {
          await registerKnownDevice({
            data: {
              email,
              fingerprint: device.fingerprint,
              ip: device.ip,
              userAgent: device.user_agent,
              platform: device.platform,
            },
          });
        } catch {
          // best-effort
        }
      }

      // Clear captured referral
      try {
        localStorage.removeItem("ml_ref_code");
      } catch {
        // ignore
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async (purpose: "signup" | "login_2fa") => {
    if (resendIn > 0 || busy) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      await sendVerificationCode({ data: { email, purpose } });
      setResendIn(60);
      setInfo("A new code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setSignupStep(1);
    setLoginStep(1);
    setError("");
    setInfo("");
    setOtp("");
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-border bg-card/50 p-10 shadow-luxury">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-primary">
          {headerText.eyebrow}
        </p>
        <h1 className="mt-3 text-center font-serif text-4xl">{headerText.title}</h1>

        {/* SIGN IN — step 1 (creds) */}
        {mode === "signin" && loginStep === 1 && (
          <form onSubmit={signinSubmit} className="mt-8 space-y-4">
            <Input label="Email" type="email" value={email} onChange={setEmail} />
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        )}

        {/* SIGN IN — step 2 (OTP for new device) */}
        {mode === "signin" && loginStep === 2 && (
          <form onSubmit={verifyLoginCode} className="mt-8 space-y-5">
            {info && (
              <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center text-xs text-primary">
                {info}
              </p>
            )}
            <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            {error && <p className="text-center text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy || otp.length !== 6}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Verifying…" : "Verify & Sign In"}
            </button>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => {
                  setLoginStep(1);
                  setError("");
                  setInfo("");
                }}
                className="uppercase tracking-[0.25em] hover:text-primary"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || busy}
                onClick={() => resendCode("login_2fa")}
                className="uppercase tracking-[0.25em] hover:text-primary disabled:opacity-50"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend Code"}
              </button>
            </div>
          </form>
        )}

        {/* SIGN UP — step 1 (details) */}
        {mode === "signup" && signupStep === 1 && (
          <form onSubmit={signupStep1} className="mt-8 space-y-4">
            <Input label="First Name" value={firstName} onChange={setFirstName} />
            <Input label="Last Name" value={lastName} onChange={setLastName} />
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Country
              </span>
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

        {/* SIGN UP — step 2 (password) */}
        {mode === "signup" && signupStep === 2 && (
          <form onSubmit={signupStep2} className="mt-8 space-y-4">
            <PasswordField
              label="Create Password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
            />
            <PasswordRequirements password={password} />
            <PasswordField
              label="Confirm Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              invalid={confirmPassword.length > 0 && confirmPassword !== password}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Sending code…" : "Send Verification Code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSignupStep(1);
                setError("");
              }}
              className="w-full py-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-primary"
            >
              ← Back
            </button>
          </form>
        )}

        {/* SIGN UP — step 3 (OTP) */}
        {mode === "signup" && signupStep === 3 && (
          <form onSubmit={verifySignupCode} className="mt-8 space-y-5">
            {info && (
              <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center text-xs text-primary">
                {info}
              </p>
            )}
            <OtpInput value={otp} onChange={setOtp} disabled={busy} />
            {error && <p className="text-center text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy || otp.length !== 6}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Creating account…" : "Verify & Create Account"}
            </button>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => {
                  setSignupStep(2);
                  setError("");
                  setInfo("");
                }}
                className="uppercase tracking-[0.25em] hover:text-primary"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || busy}
                onClick={() => resendCode("signup")}
                className="uppercase tracking-[0.25em] hover:text-primary disabled:opacity-50"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend Code"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already a member? "}
          <button type="button" onClick={switchMode} className="text-primary underline">
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">
            ← Return to shop
          </Link>
        </p>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
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

