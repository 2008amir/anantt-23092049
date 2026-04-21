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
      // Admin email always lands on admin
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
    return () => { cancelled = true; };
  }, [user, navigate]);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, name || undefined);
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Authentication failed";
      // Friendlier error
      if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already")) {
        setError("An account with that email already exists. Try signing in.");
      } else if (msg.toLowerCase().includes("invalid login")) {
        setError("Invalid email or password.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-border bg-card/50 p-10 shadow-luxury">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-primary">
          {mode === "signin" ? "Welcome Back" : "Join the House"}
        </p>
        <h1 className="mt-3 text-center font-serif text-4xl">
          {mode === "signin" ? "Sign In" : "Create Account"}
        </h1>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === "signup" && <Input label="Name" value={name} onChange={setName} />}
          <Input label="Email" type="email" value={email} onChange={setEmail} />
          <Input label="Password" type="password" value={password} onChange={setPassword} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here? " : "Already a member? "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
            className="text-primary underline"
          >
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
