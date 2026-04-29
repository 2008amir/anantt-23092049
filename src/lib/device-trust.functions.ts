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

function buildEmailHtml(opts: { headline: string; intro: string; confirmUrl: string; email: string; expiresMin: number }) {
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
              <p style="text-align:center;margin:0 0 26px 0;">
                <a href="${opts.confirmUrl}" style="display:inline-block;background:#c9a14a;color:#ffffff;text-decoration:none;padding:16px 64px;font-size:16px;font-weight:600;border-radius:6px;">Verify My Email</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <div style="background:#efefef;padding:18px 20px;text-align:center;font-size:13px;color:#333;border-radius:4px;">
                This verification link is for your email address: ${opts.email}<br/>
                <strong>Note:</strong> This link will expire in ${opts.expiresMin} minutes.<br/>
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
 * Generate a Supabase magic link, store it in our DB under a custom token,
 * and email the user a branded link via Brevo. The link points back to our
 * /verify-device page with our token; that page exchanges the token for the
 * real Supabase action URL and consumes it.
 */
export const sendDeviceVerificationLink = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(320) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const origin = getRequestHeader("origin") || `https://${getRequestHeader("host") ?? ""}`;
    const redirectTo = `${origin}/verify-device`;

    // Generate Supabase magic link (we DO NOT email it via the auth hook)
    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (error || !linkData?.properties?.action_link) {
      console.error("generateLink failed", error);
      // Avoid leaking existence
      return { ok: true } as const;
    }

    // Create our own opaque token; store hash in DB tied to the action link
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256Hex(token);

    const expiresMin = 30;
    const expiresAt = new Date(Date.now() + expiresMin * 60_000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("email_verification_links").insert({
      email,
      token_hash: tokenHash,
      action_link: linkData.properties.action_link,
      purpose: "verify",
      expires_at: expiresAt,
    });
    if (insErr) {
      console.error("verification insert failed", insErr);
      return { ok: true } as const;
    }

    const confirmUrl = `${origin}/verify-device?t=${encodeURIComponent(token)}`;
    const html = buildEmailHtml({
      headline: "Verify Your Email Address",
      intro:
        "Thank you for using Luxe Sparkles! To verify a new sign-in, please confirm your email address by clicking the button below.",
      confirmUrl,
      email,
      expiresMin,
    });

    try {
      await sendBrevoEmail({
        to: email,
        subject: "Verify your email — Luxe Sparkles",
        html,
      });
    } catch (e) {
      console.error("brevo send failed", e);
    }

    return { ok: true } as const;
  });

/**
 * Validate a token from the email link against our DB. If valid and not
 * consumed, mark consumed and return the underlying Supabase action_link
 * so the page can redirect there to establish a real session.
 */
export const consumeVerificationToken = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ token: z.string().min(16).max(256) }).parse(input),
  )
  .handler(async ({ data }) => {
    const tokenHash = await sha256Hex(data.token);

    const { data: row, error } = await supabaseAdmin
      .from("email_verification_links")
      .select("id, action_link, consumed, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error || !row) {
      return { ok: false, reason: "invalid" as const };
    }
    if (row.consumed) {
      return { ok: false, reason: "used" as const };
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, reason: "expired" as const };
    }

    await supabaseAdmin
      .from("email_verification_links")
      .update({ consumed: true, consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    return { ok: true as const, actionLink: row.action_link };
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
