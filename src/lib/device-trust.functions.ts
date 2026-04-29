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

/**
 * Check whether the current request comes from a trusted device for this email.
 * Trust = (matching device cookie id) OR (matching browser fingerprint) recorded
 * for this user. Touches last_seen_at when trusted.
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

    // Look up user by email
    const { data: userRow } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // If no profile found yet, treat as untrusted but don't reveal account existence.
    if (!userRow?.id) {
      return { trusted: false, userExists: false } as const;
    }

    // Find a trusted device row by cookie OR fingerprint
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
 * Send a magic-link verification email to the user, telling them a sign-in
 * was attempted from a new device. Visiting the link will sign them in AND
 * the /verify-device page will then mark this browser as trusted.
 */
export const sendDeviceVerificationLink = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(320) }).parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const origin = getRequestHeader("origin") || `https://${getRequestHeader("host") ?? ""}`;
    const redirectTo = `${origin}/verify-device`;

    // generateLink → magiclink. Will deliver via the configured Send Email hook
    // (our auth-email-hook function), so the user gets a branded email.
    const { error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (error) {
      console.error("generateLink magiclink failed", error);
      // Avoid leaking which emails exist
      return { ok: true } as const;
    }
    return { ok: true } as const;
  });

/**
 * Called from /verify-device once the user has clicked the magic link and
 * Supabase has established a session. Records this browser as trusted for
 * the now-authenticated user.
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
