import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset Password — Luxe Sparkles" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-border bg-card/50 p-10 shadow-luxury">
        <p className="text-center text-xs uppercase tracking-[0.3em] text-primary">
          Password reset moved
        </p>
        <h1 className="mt-3 text-center font-serif text-3xl">Use Forgot Password</h1>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Enter your email, code, and new password on the Forgot Password page.
        </p>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/forgot-password" className="hover:text-primary">
            Go to forgot password →
          </Link>
        </p>
      </div>
    </div>
  );
}
