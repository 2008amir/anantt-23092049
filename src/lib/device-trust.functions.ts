import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestIP, getRequestHeader, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const COOKIE = "ml_dev_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

function ensureDeviceCookie(): string {
  let id = getCookie(COOKIE);
  if (!id) {
    id = crypto.randomUUID();
    setCookie(COOKIE, id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR * 5,
    });
  }
  return id;
}

function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser = /Chrome\//.test(ua)
    ? "Chrome"
    : /Firefox\//.test(ua)
    ? "Firefox"
    : /Safari\//.test(ua)
    ? "Safari"
    : /Edg\//.test(ua)
    ? "Edge"
    : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X/.test(ua)
    ? "Mac"
    : /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iOS/.test(ua)
    ? "iOS"
    : /Linux/.test(ua)
    ? "Linux"
    : "Device";
  return `${browser} on ${os}${isMobile ? " (mobile)" : ""}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildEmailHtml(opts: { headline: string; intro: string; code: string; email: string; expiresMin: number }) {
  const codeBoxes = opts.code
    .split("")
    .map(
      (d) =>
        `<span style="display:inline-block;min-width:42px;padding:14px 0;margin:0 4px;background:#fff;border:1px solid #e5d6a8;border-radius:6px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:#1a1a1a;letter-spacing:2px;">${d}</span>`,
    )
    .join("");
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f3f3;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f3f3;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;max-width:600px;width:100%;">
          <tr>
            <td style="padding:0;">
              <div style="background:linear-gradient(180deg,#fff8ec 0%,#fdf1d8 100%);padding:36px 20px 28px 20px;text-align:center;position:relative;">
                <div style="font-size:18px;color:#c9a14a;letter-spacing:2px;">✦  ✧</div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:40px;color:#1a1a1a;margin-top:6px;">Luxe Sparkles</div>
                <div style="font-size:14px;color:#c9a14a;margin-top:2px;">✧</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 8px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;color:#1a1a1a;">${opts.headline}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px 0 40px;font-size:15px;line-height:1.55;color:#1a1a1a;">
              <p style="margin:0 0 14px 0;">Hello,</p>
              <p style="margin:0 0 24px 0;">${opts.intro}</p>
              <p style="text-align:center;margin:0 0 26px 0;white-space:nowrap;">
                ${codeBoxes}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <div style="background:#efefef;padding:18px 20px;text-align:center;font-size:13px;color:#333;border-radius:4px;">
                This verification code is for your email address: ${opts.email}<br/>
                <strong>Note:</strong> This code will expire in ${opts.expiresMin} minutes.<br/>
                Please use it promptly.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px 28px 40px;text-align:center;font-size:13px;color:#333;border-top:1px solid #eee;">
              If you did not request this, please <u>ignore this email</u>.
              <div style="margin-top:14px;color:#888;font-size:12px;">© ${new Date().getFullYear()} Luxe Sparkles. All rights reserved.</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendBrevoEmail(opts: { to: string; subject: string; html: string }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("Brevo not configured");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Luxe Sparkles", email: "luxesparkles@codebreakers.uk" },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Brevo error", res.status, body);
    throw new Error("Email send failed");
  }
}

/**
 * Check whether an email is already registered.
 */
export const checkEmailExists = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(320) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    return { exists: !!row?.id } as const;
  });

/**
 * Check whether the current request comes from a trusted device for this email.
 */
export const checkDeviceTrust = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(320),
        fingerprint: z.string().min(8).max(128).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const cookieId = ensureDeviceCookie();
    const email = data.email.toLowerCase();

    const { data: userRow } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!userRow?.id) {
      return { trusted: false, userExists: false } as const;
    }

    let query = supabaseAdmin
      .from("trusted_devices")
      .select("id, device_cookie_id, fingerprint")
      .eq("user_id", userRow.id);

    if (data.fingerprint) {
      query = query.or(`device_cookie_id.eq.${cookieId},fingerprint.eq.${data.fingerprint}`);
    } else {
      query = query.eq("device_cookie_id", cookieId);
    }

    const { data: rows } = await query.limit(1);
    const trusted = !!rows && rows.length > 0;

    if (trusted) {
      await supabaseAdmin
        .from("trusted_devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", rows![0].id);
    }

    return { trusted, userExists: true } as const;
  });

/**
 * Sends a 6-digit OTP for verifying a new device on an existing account.
 * Email subject/body uses the "Welcome back, verify it's you" framing.
 */
const DEVICE_CODE_TTL_MIN = 15;
const DEVICE_RESEND_COOLDOWN_SEC = 60;
const DEVICE_PURPOSE = "device_verify";

async function sendDeviceCodeEmail(email: string, code: string) {
  const html = buildEmailHtml({
    headline: "Welcome back — verify it's you",
    intro:
      "We noticed a sign-in to your Luxe Sparkles account from a new device. Please use the verification code below to confirm it's really you.",
    code,
    email,
    expiresMin: DEVICE_CODE_TTL_MIN,
  });
  await sendBrevoEmail({
    to: email,
    subject: "Welcome back — verify it's you — Luxe Sparkles",
    html,
  });
}

export const startDeviceVerification = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(320) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();

    // Invalidate previous pending codes for this email/purpose
    await supabaseAdmin
      .from("auth_email_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("purpose", DEVICE_PURPOSE)
      .eq("used", false);

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MIN * 60_000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("auth_email_codes").insert({
      email,
      code_hash: codeHash,
      purpose: DEVICE_PURPOSE,
      expires_at: expiresAt,
      last_sent_at: new Date().toISOString(),
    });
    if (insErr) {
      console.error("auth_email_codes insert failed", insErr);
      return { ok: false as const, reason: "server" as const };
    }

    try {
      await sendDeviceCodeEmail(email, code);
    } catch (e) {
      console.error("brevo device code send failed", e);
      return { ok: false as const, reason: "email" as const };
    }
    return { ok: true as const };
  });

export const resendDeviceCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(320) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();

    const { data: row } = await supabaseAdmin
      .from("auth_email_codes")
      .select("id, last_sent_at, used")
      .eq("email", email)
      .eq("purpose", DEVICE_PURPOSE)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) {
      return { ok: false as const, reason: "no_pending" as const };
    }

    const elapsed = (Date.now() - new Date(row.last_sent_at).getTime()) / 1000;
    if (elapsed < DEVICE_RESEND_COOLDOWN_SEC) {
      return {
        ok: false as const,
        reason: "cooldown" as const,
        retryIn: Math.ceil(DEVICE_RESEND_COOLDOWN_SEC - elapsed),
      };
    }

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MIN * 60_000).toISOString();

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
      await sendDeviceCodeEmail(email, code);
    } catch (e) {
      console.error("brevo device code resend failed", e);
      return { ok: false as const, reason: "email" as const };
    }
    return { ok: true as const, retryIn: DEVICE_RESEND_COOLDOWN_SEC };
  });

/**
 * Verifies the device OTP. On success: marks current device trusted and
 * returns a Supabase magic link so the page can establish a session.
 */
export const verifyDeviceCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(320),
        code: z.string().regex(/^\d{6}$/),
        fingerprint: z.string().min(8).max(128).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const codeHash = await sha256Hex(data.code);

    const { data: row } = await supabaseAdmin
      .from("auth_email_codes")
      .select("id, code_hash, attempts, used, expires_at")
      .eq("email", email)
      .eq("purpose", DEVICE_PURPOSE)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { ok: false as const, reason: "no_pending" as const };
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
      return {
        ok: false as const,
        reason: "wrong" as const,
        attemptsLeft: Math.max(0, 5 - (row.attempts + 1)),
      };
    }

    // Code correct — find user, mark device trusted, generate magic link.
    const { data: userRow } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!userRow?.id) {
      return { ok: false as const, reason: "no_pending" as const };
    }

    const cookieId = ensureDeviceCookie();
    const ua = getRequestHeader("user-agent") ?? null;
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;

    await supabaseAdmin.from("trusted_devices").upsert(
      {
        user_id: userRow.id,
        device_cookie_id: cookieId,
        fingerprint: data.fingerprint ?? null,
        ip,
        user_agent: ua,
        label: deviceLabel(ua),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_cookie_id" },
    );

    await supabaseAdmin
      .from("auth_email_codes")
      .update({ used: true })
      .eq("id", row.id);

    const origin = getRequestHeader("origin") || `https://${getRequestHeader("host") ?? ""}`;
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/account` },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("device verify magic link failed", linkErr);
      return { ok: true as const, actionLink: null };
    }

    return { ok: true as const, actionLink: linkData.properties.action_link };
  });

/**
 * Records this browser as trusted for the now-authenticated user.
 */
export const markCurrentDeviceTrusted = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        fingerprint: z.string().min(8).max(128).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const cookieId = ensureDeviceCookie();
    const ua = getRequestHeader("user-agent") ?? null;
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;

    await supabaseAdmin
      .from("trusted_devices")
      .upsert(
        {
          user_id: data.userId,
          device_cookie_id: cookieId,
          fingerprint: data.fingerprint ?? null,
          ip,
          user_agent: ua,
          label: deviceLabel(ua),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_cookie_id" },
      );

    return { ok: true } as const;
  });

// =====================================================================
// Signup OTP (6-digit code) — defer creating the auth user until verified
// =====================================================================

const SIGNUP_CODE_TTL_MIN = 15;
const RESEND_COOLDOWN_SEC = 60;

function generateCode(): string {
  // Cryptographically random 6-digit code
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const n = (buf[0] << 24 | buf[1] << 16 | buf[2] << 8 | buf[3]) >>> 0;
  return (n % 1_000_000).toString().padStart(6, "0");
}

async function sendSignupCodeEmail(email: string, code: string) {
  const html = buildEmailHtml({
    headline: "Your Verification Code",
    intro:
      "Thank you for joining Luxe Sparkles! Please use the verification code below to confirm your email address and finish creating your account.",
    code,
    email,
    expiresMin: SIGNUP_CODE_TTL_MIN,
  });
  await sendBrevoEmail({
    to: email,
    subject: "Your verification code — Luxe Sparkles",
    html,
  });
}

const signupPayloadSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  displayName: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  referralCode: z.string().max(64).optional(),
  deviceFp: z.string().max(128).optional(),
});

/**
 * Stores pending signup data and emails a 6-digit code. Does NOT create the auth user.
 */
export const startSignupVerification = createServerFn({ method: "POST" })
  .inputValidator((input) => signupPayloadSchema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();

    // Block if already a real user
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existing?.id) {
      return { ok: false as const, reason: "exists" as const };
    }

    // Invalidate previous pending rows for this email
    await supabaseAdmin
      .from("signup_verifications")
      .update({ consumed: true })
      .eq("email", email)
      .eq("consumed", false);

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + SIGNUP_CODE_TTL_MIN * 60_000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("signup_verifications").insert({
      email,
      password: data.password,
      first_name: data.firstName ?? null,
      last_name: data.lastName ?? null,
      display_name: data.displayName ?? null,
      country: data.country ?? null,
      referral_code: data.referralCode ?? null,
      device_fp: data.deviceFp ?? null,
      code_hash: codeHash,
      expires_at: expiresAt,
      last_sent_at: new Date().toISOString(),
    });
    if (insErr) {
      console.error("signup_verifications insert failed", insErr);
      return { ok: false as const, reason: "server" as const };
    }

    try {
      await sendSignupCodeEmail(email, code);
    } catch (e) {
      console.error("brevo send failed", e);
      return { ok: false as const, reason: "email" as const };
    }

    return { ok: true as const };
  });

/**
 * Resends a fresh 6-digit code if cooldown elapsed and there's a pending row.
 */
export const resendSignupCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(320) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();

    const { data: row } = await supabaseAdmin
      .from("signup_verifications")
      .select("id, last_sent_at, consumed")
      .eq("email", email)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) {
      return { ok: false as const, reason: "no_pending" as const };
    }

    const elapsed = (Date.now() - new Date(row.last_sent_at).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SEC) {
      return {
        ok: false as const,
        reason: "cooldown" as const,
        retryIn: Math.ceil(RESEND_COOLDOWN_SEC - elapsed),
      };
    }

    const code = generateCode();
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + SIGNUP_CODE_TTL_MIN * 60_000).toISOString();

    await supabaseAdmin
      .from("signup_verifications")
      .update({
        code_hash: codeHash,
        attempts: 0,
        last_sent_at: new Date().toISOString(),
        expires_at: expiresAt,
      })
      .eq("id", row.id);

    try {
      await sendSignupCodeEmail(email, code);
    } catch (e) {
      console.error("brevo resend failed", e);
      return { ok: false as const, reason: "email" as const };
    }
    return { ok: true as const, retryIn: RESEND_COOLDOWN_SEC };
  });

/**
 * Validates the 6-digit code; if correct, creates the actual Supabase auth user
 * (already email-confirmed) using the stored signup data.
 */
export const verifySignupCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email().max(320),
        code: z.string().regex(/^\d{6}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const codeHash = await sha256Hex(data.code);

    const { data: row } = await supabaseAdmin
      .from("signup_verifications")
      .select(
        "id, code_hash, attempts, consumed, expires_at, password, first_name, last_name, display_name, country, referral_code, device_fp",
      )
      .eq("email", email)
      .eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { ok: false as const, reason: "no_pending" as const };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false as const, reason: "expired" as const };
    }
    if (row.attempts >= 5) {
      return { ok: false as const, reason: "too_many" as const };
    }
    if (row.code_hash !== codeHash) {
      await supabaseAdmin
        .from("signup_verifications")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return {
        ok: false as const,
        reason: "wrong" as const,
        attemptsLeft: Math.max(0, 5 - (row.attempts + 1)),
      };
    }

    // Code correct — create the real user (already confirmed) and consume row.
    const meta: Record<string, string> = {};
    if (row.display_name) meta.display_name = row.display_name;
    if (row.first_name) meta.first_name = row.first_name;
    if (row.last_name) meta.last_name = row.last_name;
    if (row.country) meta.country = row.country;
    if (row.referral_code) meta.ref = row.referral_code;
    if (row.device_fp) meta.device_fp = row.device_fp;

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: row.password,
      email_confirm: true,
      user_metadata: meta,
    });

    if (createErr) {
      console.error("createUser failed", createErr);
      return { ok: false as const, reason: "server" as const };
    }

    if (created.user?.id && row.device_fp) {
      const cookieId = ensureDeviceCookie();
      const ua = getRequestHeader("user-agent") ?? null;
      const ip = getRequestIP({ xForwardedFor: true }) ?? null;
      await supabaseAdmin.from("trusted_devices").upsert(
        {
          user_id: created.user.id,
          device_cookie_id: cookieId,
          fingerprint: row.device_fp,
          ip,
          user_agent: ua,
          label: deviceLabel(ua),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_cookie_id" },
      );
    }

    await supabaseAdmin
      .from("signup_verifications")
      .update({ consumed: true })
      .eq("id", row.id);

    const origin = getRequestHeader("origin") || `https://${getRequestHeader("host") ?? ""}`;
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${origin}/account` },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("post-signup login link failed", linkErr);
      return { ok: true as const, actionLink: null };
    }

    return { ok: true as const, actionLink: linkData.properties.action_link };
  });
