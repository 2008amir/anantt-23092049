import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  resendDeviceCode,
  verifyDeviceCode,
} from "@/lib/device-trust.functions";
import { Spinner } from "@/components/PasswordField";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const searchSchema = z.object({
  email: z.string().email(),
});

export const Route = createFileRoute("/verify-device")({
  head: () => ({ meta: [{ title: "Verify Device — Luxe Sparkles" }] }),
  validateSearch: (search) => searchSchema.parse(search),
  component: VerifyDevice,
});

const RESEND_SECONDS = 60;

function VerifyDevice() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [done, setDone] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
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

  const submit = async (value: string) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const { collectDeviceSignals } = await import("@/lib/device-fingerprint");
      const device = await collectDeviceSignals();
      const res = await verifyDeviceCode({
        data: { email, code: value, fingerprint: device.fingerprint },
      });
      if (!res.ok) {
        if (res.reason === "wrong") {
          setError(
            res.attemptsLeft > 0
              ? `Incorrect code. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? "" : "s"} left.`
              : "Incorrect code.",
          );
        } else if (res.reason === "expired") {
          setError("This code has expired. Please request a new one.");
        } else if (res.reason === "too_many") {
          setError("Too many incorrect attempts. Please request a new code.");
        } else if (res.reason === "no_pending") {
          setError("No pending verification found. Please sign in again.");
        } else {
          setError("Could not verify. Please try again.");
        }
        setCode("");
        return;
      }
      setDone(true);
      setInfo("Device verified! Signing you in…");
      if (res.actionLink) {
        window.location.replace(res.actionLink);
        return;
      }
      setTimeout(() => {
        void navigate({ to: "/login" });
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify code");
    } finally {
      submittedRef.current = false;
      setBusy(false);
    }
  };

  const handleChange = (v: string) => {
    setCode(v);
    if (v.length === 6 && !busy && !done) {
      void submit(v);
    }
  };

  const handleResend = async () => {
    if (secondsLeft > 0 || busy) return;
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const res = await resendDeviceCode({ data: { email } });
      if (!res.ok) {
        if (res.reason === "cooldown") {
          setSecondsLeft(res.retryIn);
          setError(`Please wait ${res.retryIn}s before requesting another code.`);
        } else if (res.reason === "no_pending") {
          setError("No pending verification found. Please sign in again.");
        } else {
          setError("Could not resend code. Please try again.");
        }
        return;
      }
      setInfo("A new verification code has been sent to your email.");
      setSecondsLeft(RESEND_SECONDS);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-border bg-card/50 p-10 text-center shadow-luxury">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Welcome Back</p>
        <h1 className="mt-3 font-serif text-3xl">Verify it's you</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          An OTP has been sent to your email{" "}
          <span className="text-foreground">{email}</span>. Confirm the verification to
          continue signing in from this device.
        </p>

        <div className="mt-8 flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={handleChange}
            disabled={busy || done}
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
          Didn’t get the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={secondsLeft > 0 || busy || done}
            className="text-primary underline disabled:no-underline disabled:text-muted-foreground"
          >
            {secondsLeft > 0 ? `Resend in ${formattedTimer}` : "Resend code"}
          </button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          <Link to="/login" className="hover:text-primary">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
