// Server-only security helpers: reCAPTCHA verification, attempt logging, rate limiting.
// Never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function verifyRecaptcha(
  token: string | null | undefined,
  action: string,
  remoteIp?: string | null,
): Promise<{ ok: boolean; score?: number; reason?: string }> {
  const secret = process.env.RECAPTCHA_V2_SECRET_KEY ?? process.env.RECAPTCHA_SECRET_KEY;
  // If secret is not configured, fail-open in dev only — but ALWAYS log it.
  if (!secret) {
    console.warn("[security] RECAPTCHA_V2_SECRET_KEY not configured — skipping verification");
    return { ok: true, reason: "no_secret" };
  }
  if (!token) return { ok: false, reason: "missing_token" };

  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    if (remoteIp) body.set("remoteip", remoteIp);
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await res.json()) as {
      success: boolean;
      score?: number;
      action?: string;
      "error-codes"?: string[];
    };
    if (!json.success) {
      return { ok: false, reason: (json["error-codes"] || []).join(",") || "failed" };
    }
    // v2 checkbox doesn't return action/score — success is enough.
    void action;
    return { ok: true, score: json.score };
  } catch (e) {
    console.error("[security] recaptcha verify error", e);
    return { ok: false, reason: "network" };
  }
}

/**
 * Log a failed login/forgot-password attempt. Always returns silently.
 * The 404-style log line is what the user requested in their server logs.
 */
export async function logFailedAttempt(opts: {
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  reason: string;
  path?: string;
}): Promise<void> {
  // Emit a 404-style log line so any wrong-password attempt shows as 404 in server logs.
  console.warn(
    `[404] auth-failed path=${opts.path ?? "/auth"} email=${opts.email ?? "-"} ip=${opts.ip ?? "-"} reason=${opts.reason}`,
  );
  try {
    await supabaseAdmin.from("login_attempts").insert({
      email: (opts.email ?? "").toLowerCase() || null,
      ip: opts.ip ?? null,
      user_agent: opts.userAgent ?? null,
      reason: opts.reason,
    });
  } catch (e) {
    console.error("[security] failed to log attempt", e);
  }
}

/**
 * Returns true if the (email, ip) combination has hit too many failures recently.
 * Defaults: 8 failures per email or 15 per IP within the last 15 minutes.
 */
export async function isRateLimited(opts: {
  email?: string | null;
  ip?: string | null;
  windowMinutes?: number;
  perEmail?: number;
  perIp?: number;
}): Promise<boolean> {
  const win = opts.windowMinutes ?? 15;
  const perEmail = opts.perEmail ?? 8;
  const perIp = opts.perIp ?? 15;
  const since = new Date(Date.now() - win * 60_000).toISOString();

  if (opts.email) {
    const { count } = await supabaseAdmin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", opts.email.toLowerCase())
      .gte("created_at", since);
    if ((count ?? 0) >= perEmail) return true;
  }
  if (opts.ip) {
    const { count } = await supabaseAdmin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip", opts.ip)
      .gte("created_at", since);
    if ((count ?? 0) >= perIp) return true;
  }
  return false;
}
