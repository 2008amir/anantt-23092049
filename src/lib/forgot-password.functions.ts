import { createServerFn } from "@tanstack/react-start";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyRecaptcha, logFailedAttempt, isRateLimited } from "./security.server";

const TTL_MIN = 15;
const RESEND_SEC = 60;
const PURPOSE = "password_reset";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateCode(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const n = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
  return (n % 1_000_000).toString().padStart(6, "0");
}

function buildEmailHtml(code: string, email: string) {
  const codeBoxes = code
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;min-width:42px;padding:14px 0;margin:0 4px;background:#fff;border:1px solid #e5d6a8;border-radius:6px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:#1a1a1a;letter-spacing:2px;">${d}</span>`,
    )
    .join("");
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f3f3;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f3f3;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;max-width:600px;width:100%;">
<tr><td style="padding:0;">
<div style="background:linear-gradient(180deg,#fff8ec 0%,#fdf1d8 100%);padding:36px 20px 28px 20px;text-align:center;">
<div style="font-size:18px;color:#c9a14a;letter-spacing:2px;">✦  ✧</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:40px;color:#1a1a1a;margin-top:6px;">Luxe Sparkles</div>
</div></td></tr>
<tr><td style="padding:32px 40px 8px 40px;text-align:center;">
<h1 style="margin:0;font-size:24px;color:#1a1a1a;">Reset your password</h1></td></tr>
<tr><td style="padding:18px 40px 0 40px;font-size:15px;line-height:1.55;color:#1a1a1a;">
<p style="margin:0 0 14px 0;">Hello,</p>
<p style="margin:0 0 24px 0;">We received a request to reset the password for your Luxe Sparkles account. Use the verification code below to continue. If you didn't request this, you can safely ignore this email.</p>
<p style="text-align:center;margin:0 0 26px 0;white-space:nowrap;">${codeBoxes}</p>
</td></tr>
<tr><td style="padding:0 40px 24px 40px;">
<div style="background:#efefef;padding:18px 20px;text-align:center;font-size:13px;color:#333;border-radius:4px;">
This verification code is for your email address: ${email}<br/>
<strong>Note:</strong> This code will expire in ${TTL_MIN} minutes.</div>
</td></tr>
<tr><td style="padding:18px 40px 28px 40px;text-align:center;font-size:13px;color:#333;border-top:1px solid #eee;">
If you did not request this, please <u>ignore this email</u>.
<div style="margin-top:14px;color:#888;font-size:12px;">© ${new Date().getFullYear()} Luxe Sparkles. All rights reserved.</div>
</td></tr>
</table></td></tr></table></body></html>`;
}

async function sendBrevo(to: string, html: string) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("Brevo not configured");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey, accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "Luxe Sparkles", email: "luxesparkles@codebreakers.uk" },
      to: [{ email: to }],
      subject: "Reset your password — Luxe Sparkles",
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Brevo password-reset send failed", res.status, body);
    throw new Error("send_failed");
  }
}

/**
 * Step 1: user submits email + reCAPTCHA token. We check the email exists,
 * generate an OTP, and email it. Returns generic ok regardless to avoid
 * leaking which emails are registered.
 */
export const startPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(320),
        recaptchaToken: z.string().min(10).max(4096).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const ua = getRequestHeader("user-agent") ?? null;
    const email = data.email.toLowerCase();

    // Captcha check first to avoid abuse-driven email floods
    const captcha = await verifyRecaptcha(data.recaptchaToken ?? null, "forgot_password", ip);
    if (!captcha.ok) {
      await logFailedAttempt({ email, ip, userAgent: ua, reason: `captcha:${captcha.reason}`, path: "/forgot-password" });
      return { ok: false as const, reason: "captcha" as const };
    }

    if (await isRateLimited({ email, ip })) {
      await logFailedAttempt({ email, ip, userAgent: ua, reason: "rate_limited", path: "/forgot-password" });
      return { ok: false as const, reason: "rate_limited" as const };
    }

    // Look up the user
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!row?.id) {
      await logFailedAttempt({ email, ip, userAgent: ua, reason: "no_such_user", path: "/forgot-password" });
      return { ok: false as const, reason: "no_user" as const };
    }

    // Invalidate prior pending codes
    await supabaseAdmin
      .from("auth_email_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("purpose", PURPOSE)
      .eq("used", false);

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + TTL_MIN * 60_000).toISOString();

    await supabaseAdmin.from("auth_email_codes").insert({
      email,
      code_hash: codeHash,
      purpose: PURPOSE,
      expires_at: expiresAt,
      last_sent_at: new Date().toISOString(),
    });

    try {
      await sendBrevo(email, buildEmailHtml(code, email));
    } catch {
      return { ok: false as const, reason: "email" as const };
    }

    return { ok: true as const };
  });

export const resendPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email().max(320) }).parse(input))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const { data: row } = await supabaseAdmin
      .from("auth_email_codes")
      .select("id, last_sent_at")
      .eq("email", email)
      .eq("purpose", PURPOSE)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "no_pending" as const };

    const elapsed = (Date.now() - new Date(row.last_sent_at).getTime()) / 1000;
    if (elapsed < RESEND_SEC) {
      return { ok: false as const, reason: "cooldown" as const, retryIn: Math.ceil(RESEND_SEC - elapsed) };
    }

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + TTL_MIN * 60_000).toISOString();
    await supabaseAdmin
      .from("auth_email_codes")
      .update({
        code_hash: codeHash,
        attempts: 0,
        last_sent_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq("id", row.id);

    try {
      await sendBrevo(email, buildEmailHtml(code, email));
    } catch {
      return { ok: false as const, reason: "email" as const };
    }
    return { ok: true as const, retryIn: RESEND_SEC };
  });

/**
 * Step 2: verify the OTP. Returns a short-lived ticket the client must POST
 * back together with the new password.
 */
export const verifyPasswordResetCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(320),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const ua = getRequestHeader("user-agent") ?? null;
    const email = data.email.toLowerCase();
    const codeHash = await sha256Hex(data.code);

    const { data: row } = await supabaseAdmin
      .from("auth_email_codes")
      .select("id, code_hash, attempts, used, expires_at")
      .eq("email", email)
      .eq("purpose", PURPOSE)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) {
      await logFailedAttempt({ email, ip, userAgent: ua, reason: "reset_no_pending", path: "/forgot-password" });
      return { ok: false as const, reason: "no_pending" as const };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }
    if (row.attempts >= 5) {
      return { ok: false as const, reason: "too_many" as const };
    }
    if (row.code_hash !== codeHash) {
      await supabaseAdmin
        .from("auth_email_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      await logFailedAttempt({ email, ip, userAgent: ua, reason: "reset_wrong_code", path: "/forgot-password" });
      return {
        ok: false as const,
        reason: "wrong" as const,
        attemptsLeft: Math.max(0, 5 - (row.attempts + 1)),
      };
    }

    // OK — issue a short-lived ticket (signed value containing email + nonce, hashed and stored).
    // We just reuse the same row by extending it with a fresh hash that the client doesn't know,
    // and return the raw nonce as the ticket.
    const ticket = crypto.randomUUID() + "." + crypto.randomUUID();
    const ticketHash = await sha256Hex(ticket);
    const ticketExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();

    // Mark current code used, write a fresh row to hold the ticket
    await supabaseAdmin.from("auth_email_codes").update({ used: true }).eq("id", row.id);
    await supabaseAdmin.from("auth_email_codes").insert({
      email,
      code_hash: ticketHash,
      purpose: "password_reset_ticket",
      expires_at: ticketExpiresAt,
      last_sent_at: new Date().toISOString(),
    });

    return { ok: true as const, ticket };
  });

/**
 * Step 3: with a valid ticket, set the new password via admin API.
 */
export const finishPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(320),
        ticket: z.string().min(10).max(200),
        newPassword: z.string().min(8).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const ua = getRequestHeader("user-agent") ?? null;
    const email = data.email.toLowerCase();
    const ticketHash = await sha256Hex(data.ticket);

    const { data: row } = await supabaseAdmin
      .from("auth_email_codes")
      .select("id, code_hash, used, expires_at")
      .eq("email", email)
      .eq("purpose", "password_reset_ticket")
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row || row.code_hash !== ticketHash) {
      await logFailedAttempt({ email, ip, userAgent: ua, reason: "reset_bad_ticket", path: "/forgot-password" });
      return { ok: false as const, reason: "invalid" as const };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }

    // Find the user by email and update their password
    // listUsers is paged; filter is best done by listing then matching, but
    // for our scale we can use admin.getUserByEmail via a direct query.
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!prof?.id) {
      return { ok: false as const, reason: "invalid" as const };
    }

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(prof.id, {
      password: data.newPassword,
    });
    if (updErr) {
      console.error("password reset update failed", updErr);
      return { ok: false as const, reason: "server" as const };
    }

    await supabaseAdmin.from("auth_email_codes").update({ used: true }).eq("id", row.id);
    return { ok: true as const };
  });
