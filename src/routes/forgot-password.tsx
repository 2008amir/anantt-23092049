import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Spinner } from "@/components/PasswordField";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { RecaptchaCheckbox, resetRecaptchaWidgets } from "@/lib/recaptcha";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot Password — Luxe Sparkles" }] }),
  component: ForgotPassword,
});

const RESEND_SECONDS = 60;

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const formattedTimer = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  }, [secondsLeft]);

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
    if (!captchaToken) return setError("Please verify you are not a robot");
    setBusy(true);
    try {
      const { startPasswordReset } = await import("@/lib/forgot-password.functions");
      const res = await startPasswordReset({ data: { email, recaptchaToken: captchaToken } });
      if (!res.ok) {
        if (res.reason === "no_user") setError("User does not exist.");
        else if (res.reason === "rate_limited") setError("Too many attempts. Please try again later.");
        else if (res.reason === "captcha") setError("Security check failed. Please try again.");
        else setError("Could not send reset code. Please try again.");
        resetRecaptchaWidgets();
        setCaptchaToken(null);
        return;
      }
      setStep(2);
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start reset");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (value: string) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const { verifyPasswordResetCode } = await import("@/lib/forgot-password.functions");
      const res = await verifyPasswordResetCode({ data: { email, code: value } });
      if (!res.ok) {
        if (res.reason === "wrong")
          setError(
            res.attemptsLeft > 0
              ? `Incorrect code. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left.`
              : "Incorrect code.",
          );
        else if (res.reason === "expired") setError("Code expired. Please request a new one.");
        else if (res.reason === "too_many") setError("Too many incorrect attempts.");
        else setError("Verification failed.");
        setCode("");
        return;
      }
      try {
        sessionStorage.setItem("ml_pwreset_ticket", res.ticket);
        sessionStorage.setItem("ml_pwreset_email", email);
      } catch {
        /* ignore */
      }
      void navigate({ to: "/reset-password" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify code");
    } finally {
      submittedRef.current = false;
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || busy) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const { resendPasswordResetCode } = await import("@/lib/forgot-password.functions");
      const res = await resendPasswordResetCode({ data: { email } });
      if (!res.ok) {
        if (res.reason === "cooldown") setSecondsLeft(res.retryIn);
        setError(res.reason === "no_pending" ? "Please request a new code." : "Could not resend code.");
        return;
      }
      setInfo("A new verification code has been sent.");
      setSecondsLeft(RESEND_SECONDS);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-border bg-card/50 p-10 shadow-luxury">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-primary">
          {step === 1 ? "Forgot password" : "Verify your email"}
        </p>
        <h1 className="mt-3 text-center font-serif text-3xl">
          {step === 1 ? "Reset your password" : "Enter the code"}
        </h1>

        {step === 1 && (
          <form onSubmit={submitEmail} className="mt-8 space-y-4">
            <label className="block">
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-smooth focus:border-primary"
              />
            </label>
            <RecaptchaCheckbox onChange={setCaptchaToken} />
            {error && <p className="text-xs text-destructive">{error}</p>}
            {info && <p className="text-xs text-emerald-600 dark:text-emerald-400">{info}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Sending…" : "Send verification code"}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to{" "}
              <span className="text-foreground">{email}</span>.
            </p>
            <div className="mt-6 flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (v.length === 6 && !busy) void submitCode(v);
                }}
                disabled={busy}
                inputMode="numeric"
                pattern="[0-9]*"
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {busy && (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner /> <span>Working…</span>
              </div>
            )}
            {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
            {info && <p className="mt-5 text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}

            <div className="mt-8 text-sm text-muted-foreground">
              Didn't get the code?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={secondsLeft > 0 || busy}
                className="text-primary underline disabled:no-underline disabled:text-muted-foreground"
              >
                {secondsLeft > 0 ? `Resend in ${formattedTimer}` : "Resend code"}
              </button>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/login" className="hover:text-primary">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
