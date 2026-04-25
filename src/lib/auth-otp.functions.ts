import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genCode(): string {
  // 6-digit numeric code, uniformly random
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1_000_000).toString().padStart(6, "0");
}

const FROM_EMAIL = "Maison Luxe <luxesparkles@codebreakers.uk>";
const CODE_TTL_MIN = 5;
const MAX_ATTEMPTS = 5;

async function sendCodeEmail(to: string, code: string, purpose: "signup" | "login_2fa") {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) throw new Error("Email service not configured");

  const heading = purpose === "signup" ? "Verify your account" : "Sign-in verification code";
  const intro =
    purpose === "signup"
      ? "Welcome to Maison Luxe. Use the code below to finish creating your account."
      : "We noticed a sign-in from a new device. Use the code below to confirm it's you.";

  const html = `
    <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;padding:32px;color:#1a1a1a;background:#ffffff">
      <h1 style="font-size:22px;letter-spacing:0.04em;margin:0 0 8px;text-align:center">MAISON LUXE</h1>
      <p style="text-align:center;color:#888;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 32px">${heading}</p>
      <p style="font-size:14px;line-height:1.6;color:#333">${intro}</p>
      <div style="margin:32px 0;text-align:center">
        <div style="display:inline-block;font-size:34px;letter-spacing:0.5em;font-family:Menlo,monospace;font-weight:700;padding:18px 26px;background:#faf7f2;border:1px solid #e8dfce;border-radius:6px">${code}</div>
      </div>
      <p style="font-size:13px;color:#666;line-height:1.6;text-align:center">This code expires in ${CODE_TTL_MIN} minutes. If you didn't request it, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
      <p style="font-size:11px;color:#999;text-align:center">© Maison Luxe</p>
    </div>
  `;

  const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: purpose === "signup" ? "Your Maison Luxe verification code" : "Your sign-in code",
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Resend error", res.status, text);
    throw new Error("Failed to send verification email");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Send verification code (purpose: signup or login_2fa)
// ─────────────────────────────────────────────────────────────────────────

export const sendVerificationCode = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; purpose: "signup" | "login_2fa" }) => {
    const email = String(d.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");
    if (d.purpose !== "signup" && d.purpose !== "login_2fa") throw new Error("Invalid purpose");
    return { email, purpose: d.purpose };
  })
  .handler(async ({ data }) => {
    const sb = adminClient();

    // Rate-limit: max 3 codes per email/purpose in last 5 minutes
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await sb
      .from("auth_email_codes")
      .select("id", { count: "exact", head: true })
      .eq("email", data.email)
      .eq("purpose", data.purpose)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) {
      throw new Error("Too many codes requested. Please wait a few minutes.");
    }

    // For signup: ensure email isn't already a confirmed user
    if (data.purpose === "signup") {
      const { data: existing } = await sb
        .from("profiles")
        .select("id")
        .eq("email", data.email)
        .maybeSingle();
      if (existing) throw new Error("An account with that email already exists.");
    }

    const code = genCode();
    const code_hash = await sha256(`${data.email}:${data.purpose}:${code}`);
    const expires_at = new Date(Date.now() + CODE_TTL_MIN * 60 * 1000).toISOString();

    // Invalidate previous unused codes for the same email/purpose
    await sb
      .from("auth_email_codes")
      .update({ used: true })
      .eq("email", data.email)
      .eq("purpose", data.purpose)
      .eq("used", false);

    const { error: insErr } = await sb
      .from("auth_email_codes")
      .insert({ email: data.email, purpose: data.purpose, code_hash, expires_at });
    if (insErr) throw new Error(insErr.message);

    await sendCodeEmail(data.email, code, data.purpose);

    return { ok: true, expiresInSec: CODE_TTL_MIN * 60 };
  });

// ─────────────────────────────────────────────────────────────────────────
// 2. Verify a code (returns ok). Marks code as used on success.
// ─────────────────────────────────────────────────────────────────────────

export const verifyCode = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; purpose: "signup" | "login_2fa"; code: string }) => {
    const email = String(d.email || "").trim().toLowerCase();
    const code = String(d.code || "").trim();
    if (!/^\d{6}$/.test(code)) throw new Error("Invalid code format");
    if (d.purpose !== "signup" && d.purpose !== "login_2fa") throw new Error("Invalid purpose");
    return { email, purpose: d.purpose, code };
  })
  .handler(async ({ data }) => {
    const sb = adminClient();
    const code_hash = await sha256(`${data.email}:${data.purpose}:${data.code}`);

    const { data: row } = await sb
      .from("auth_email_codes")
      .select("*")
      .eq("email", data.email)
      .eq("purpose", data.purpose)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) throw new Error("No active code. Request a new one.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expired. Request a new one.");
    if (row.attempts >= MAX_ATTEMPTS) throw new Error("Too many attempts. Request a new code.");

    if (row.code_hash !== code_hash) {
      await sb
        .from("auth_email_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error("Incorrect code.");
    }

    await sb.from("auth_email_codes").update({ used: true }).eq("id", row.id);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────────────────────
// 3. Verify code AND create user (signup). Returns nothing — client signs in.
// ─────────────────────────────────────────────────────────────────────────

export const verifyAndCreateUser = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      email: string;
      password: string;
      code: string;
      firstName?: string;
      lastName?: string;
      displayName?: string;
      country?: string;
      referralCode?: string;
      deviceFp?: string;
    }) => {
      const email = String(d.email || "").trim().toLowerCase();
      const code = String(d.code || "").trim();
      const password = String(d.password || "");
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");
      if (!/^\d{6}$/.test(code)) throw new Error("Invalid code");
      if (password.length < 8) throw new Error("Weak password");
      return {
        email,
        password,
        code,
        firstName: d.firstName?.trim() || "",
        lastName: d.lastName?.trim() || "",
        displayName: d.displayName?.trim() || "",
        country: d.country?.trim() || "",
        referralCode: d.referralCode?.trim() || "",
        deviceFp: d.deviceFp?.trim() || "",
      };
    },
  )
  .handler(async ({ data }) => {
    const sb = adminClient();
    const code_hash = await sha256(`${data.email}:signup:${data.code}`);

    const { data: row } = await sb
      .from("auth_email_codes")
      .select("*")
      .eq("email", data.email)
      .eq("purpose", "signup")
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) throw new Error("No active code. Request a new one.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Code expired. Request a new one.");
    if (row.attempts >= MAX_ATTEMPTS) throw new Error("Too many attempts. Request a new code.");
    if (row.code_hash !== code_hash) {
      await sb
        .from("auth_email_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error("Incorrect code.");
    }

    // Mark code used
    await sb.from("auth_email_codes").update({ used: true }).eq("id", row.id);

    // Create the user (email auto-confirmed since we just verified ownership)
    const meta: Record<string, string> = {};
    if (data.displayName) meta.display_name = data.displayName;
    if (data.firstName) meta.first_name = data.firstName;
    if (data.lastName) meta.last_name = data.lastName;
    if (data.country) meta.country = data.country;
    if (data.referralCode) meta.ref = data.referralCode;
    if (data.deviceFp) meta.device_fp = data.deviceFp;

    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: meta,
    });
    if (createErr) throw new Error(createErr.message);

    return { ok: true, userId: created.user?.id ?? null };
  });

// ─────────────────────────────────────────────────────────────────────────
// 4. Check if a device is already trusted for this email.
//    Returns { known: true } if any prior user with this email logged in
//    from this device fingerprint. We cross-check via referral_devices.
// ─────────────────────────────────────────────────────────────────────────

export const isDeviceKnown = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; fingerprint: string }) => {
    const email = String(d.email || "").trim().toLowerCase();
    const fp = String(d.fingerprint || "").trim();
    return { email, fingerprint: fp };
  })
  .handler(async ({ data }) => {
    if (!data.fingerprint || data.fingerprint === "ssr") return { known: false };
    const sb = adminClient();

    const { data: prof } = await sb
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (!prof) return { known: false };

    const { count } = await sb
      .from("referral_devices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", prof.id)
      .eq("fingerprint", data.fingerprint);

    return { known: (count ?? 0) > 0 };
  });

// ─────────────────────────────────────────────────────────────────────────
// 5. Register the current device for an authenticated user (after 2FA).
// ─────────────────────────────────────────────────────────────────────────

export const registerKnownDevice = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      email: string;
      fingerprint: string;
      ip?: string | null;
      userAgent?: string | null;
      platform?: string | null;
    }) => ({
      email: String(d.email || "").trim().toLowerCase(),
      fingerprint: String(d.fingerprint || "").trim(),
      ip: d.ip ?? null,
      userAgent: d.userAgent ?? null,
      platform: d.platform ?? null,
    }),
  )
  .handler(async ({ data }) => {
    if (!data.fingerprint) return { ok: false };
    const sb = adminClient();
    const { data: prof } = await sb
      .from("profiles")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();
    if (!prof) return { ok: false };
    await sb.from("referral_devices").insert({
      user_id: prof.id,
      fingerprint: data.fingerprint,
      ip: data.ip,
      user_agent: data.userAgent,
      platform: data.platform,
    });
    return { ok: true };
  });
