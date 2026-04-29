import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { markCurrentDeviceTrusted } from "@/lib/device-trust.functions";
import { Spinner } from "@/components/PasswordField";

export const Route = createFileRoute("/verify-device")({
  head: () => ({ meta: [{ title: "Verify Device — Maison Luxe" }] }),
  component: VerifyDevice,
});

function VerifyDevice() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("Verifying this device…");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Wait briefly for Supabase to consume the magic-link hash and create a session.
        let session = (await supabase.auth.getSession()).data.session;
        for (let i = 0; i < 20 && !session; i++) {
          await new Promise((r) => setTimeout(r, 150));
          session = (await supabase.auth.getSession()).data.session;
        }
        if (cancelled) return;

        if (!session?.user) {
          setStatus("error");
          setMessage("Verification link is invalid or has expired. Please sign in again.");
          return;
        }

        const { collectDeviceSignals } = await import("@/lib/device-fingerprint");
        const device = await collectDeviceSignals();

        await markCurrentDeviceTrusted({
          data: { userId: session.user.id, fingerprint: device.fingerprint },
        });

        if (cancelled) return;
        setStatus("ok");
        setMessage("Device verified. Redirecting…");
        setTimeout(() => {
          if (!cancelled) void navigate({ to: "/account" });
        }, 1200);
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Could not verify this device.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md border border-border bg-card/50 p-10 text-center shadow-luxury">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Device Verification</p>
        <h1 className="mt-3 font-serif text-3xl">
          {status === "working" ? "Verifying…" : status === "ok" ? "All set" : "Verification failed"}
        </h1>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {status === "working" && <Spinner />}
          <span>{message}</span>
        </div>
        {status === "error" && (
          <p className="mt-6 text-xs text-muted-foreground">
            <Link to="/login" className="text-primary underline">Return to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
}
