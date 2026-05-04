// Server-validated password sign-in. Wraps Supabase auth so we can:
//  - verify reCAPTCHA v3 on every attempt
//  - enforce rate-limits per email + per IP
//  - emit a "[404]" log line for every wrong password / abusive request
// On success returns the session tokens which the client sets locally.
import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { verifyRecaptcha, logFailedAttempt, isRateLimited } from "./security.server";

export const serverSignIn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(320),
        password: z.string().min(1).max(200),
        recaptchaToken: z.string().min(10).max(4096).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const ua = getRequestHeader("user-agent") ?? null;
    const email = data.email.toLowerCase();

    // Captcha
    const captcha = await verifyRecaptcha(data.recaptchaToken ?? null, "login", ip);
    if (!captcha.ok) {
      await logFailedAttempt({ email, ip, userAgent: ua, reason: `captcha:${captcha.reason}`, path: "/login" });
      return { ok: false as const, reason: "captcha" as const };
    }

    if (await isRateLimited({ email, ip })) {
      await logFailedAttempt({ email, ip, userAgent: ua, reason: "rate_limited", path: "/login" });
      return { ok: false as const, reason: "rate_limited" as const };
    }

    // Use a fresh anon client (no session persistence) so we don't pollute server state
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("[security] supabase env not configured");
      return { ok: false as const, reason: "server" as const };
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: signInData, error } = await sb.auth.signInWithPassword({
      email,
      password: data.password,
    });

    if (error || !signInData?.session) {
      await logFailedAttempt({ email, ip, userAgent: ua, reason: "wrong_password", path: "/login" });
      return { ok: false as const, reason: "invalid" as const };
    }

    return {
      ok: true as const,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      user_id: signInData.user?.id ?? null,
      email: signInData.user?.email ?? null,
    };
  });
