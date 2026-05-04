import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import {
  PasswordField,
  PasswordRequirements,
  isPasswordValid,
  Spinner,
} from "@/components/PasswordField";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set New Password — Luxe Sparkles" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      const t = sessionStorage.getItem("ml_pwreset_ticket") ?? "";
      const e = sessionStorage.getItem("ml_pwreset_email") ?? "";
      setTicket(t);
      setEmail(e);
      if (!t || !e) {
        setError("Reset session expired. Please start again.");
      }
    } catch {
      setError("Reset session unavailable.");
    }
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!ticket || !email) return setError("Reset session expired. Please start again.");
    if (!isPasswordValid(password)) return setError("Password does not meet all requirements");
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    try {
      const { finishPasswordReset } = await import("@/lib/forgot-password.functions");
      const res = await finishPasswordReset({ data: { email, ticket, newPassword: password } });
      if (!res.ok) {
        setError(
          res.reason === "expired"
            ? "Reset window expired. Please start again."
            : res.reason === "invalid"
              ? "Invalid reset request. Please start again."
              : "Could not reset password. Please try again.",
        );
        return;
      }
      try {
        sessionStorage.removeItem("ml_pwreset_ticket");
        sessionStorage.removeItem("ml_pwreset_email");
      } catch {
        /* ignore */
      }
      setDone(true);
      setTimeout(() => void navigate({ to: "/login" }), 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-border bg-card/50 p-10 shadow-luxury">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-primary">Almost there</p>
        <h1 className="mt-3 text-center font-serif text-3xl">Set a new password</h1>
        {!done ? (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <PasswordField label="Create Password" value={password} onChange={setPassword} autoComplete="new-password" />
            <PasswordRequirements password={password} />
            <PasswordField
              label="Confirm Password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              invalid={confirm.length > 0 && confirm !== password}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Spinner />}
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : (
          <div className="mt-8 border border-primary/40 bg-primary/5 p-6 text-center text-sm">
            Password updated! Redirecting to sign in…
          </div>
        )}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/login" className="hover:text-primary">← Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
