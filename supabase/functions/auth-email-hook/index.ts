// Supabase Auth "Send Email" hook.
// Receives auth email events (signup, recovery, etc.) and sends them
// through Resend from luxesparkles@codebreakers.uk.
//
// Configure in Cloud → Auth → Hooks → "Send Email" hook with the URL:
//   https://<project-ref>.supabase.co/functions/v1/auth-email-hook
// and the secret stored as SEND_EMAIL_HOOK_SECRET (v1,whsec_...).

import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const HOOK_SECRET = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

const FROM = "Maison Luxe <luxesparkles@codebreakers.uk>";
const GATEWAY = "https://connector-gateway.lovable.dev/resend";

type EmailActionType =
  | "signup"
  | "login"
  | "invite"
  | "magiclink"
  | "recovery"
  | "email_change"
  | "email_change_current"
  | "email_change_new"
  | "reauthentication";

interface HookPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: EmailActionType;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function subjectFor(type: EmailActionType): string {
  switch (type) {
    case "signup":
      return "Verify your email — Maison Luxe";
    case "recovery":
      return "Reset your password — Maison Luxe";
    case "magiclink":
      return "Your sign-in link — Maison Luxe";
    case "invite":
      return "You're invited — Maison Luxe";
    case "email_change":
    case "email_change_current":
    case "email_change_new":
      return "Confirm your new email — Maison Luxe";
    case "reauthentication":
      return "Confirm it's you — Maison Luxe";
    default:
      return "Maison Luxe";
  }
}

function headlineFor(type: EmailActionType): string {
  switch (type) {
    case "signup":
      return "Verify your email";
    case "recovery":
      return "Reset your password";
    case "magiclink":
      return "Your sign-in link";
    case "invite":
      return "You're invited to Maison Luxe";
    case "email_change":
    case "email_change_current":
    case "email_change_new":
      return "Confirm your new email";
    case "reauthentication":
      return "Confirm it's really you";
    default:
      return "Maison Luxe";
  }
}

function buildHtml(opts: {
  type: EmailActionType;
  confirmUrl: string;
  token: string;
}): string {
  const headline = headlineFor(opts.type);
  const intro =
    opts.type === "signup"
      ? "Welcome to Maison Luxe. Please confirm your email address to activate your account."
      : opts.type === "recovery"
        ? "We received a request to reset the password on your Maison Luxe account."
        : opts.type === "magiclink"
          ? "Use the secure link below to sign in to Maison Luxe."
          : "Please confirm this action on your Maison Luxe account.";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f4ef;font-family:Georgia,serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4ef;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e7e2d6;">
            <tr>
              <td style="padding:32px 40px;border-bottom:1px solid #e7e2d6;text-align:center;">
                <div style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#b08a3e;">Maison Luxe</div>
                <h1 style="margin:12px 0 0 0;font-size:28px;font-weight:400;color:#1a1a1a;">${headline}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;">
                <p style="margin:0 0 24px 0;">${intro}</p>
                <p style="text-align:center;margin:0 0 24px 0;">
                  <a href="${opts.confirmUrl}" style="display:inline-block;background:#b08a3e;color:#ffffff;text-decoration:none;padding:14px 32px;font-size:12px;letter-spacing:0.25em;text-transform:uppercase;">Confirm</a>
                </p>
                <p style="margin:0 0 8px 0;font-size:13px;color:#666;">Or use this code:</p>
                <p style="margin:0 0 24px 0;font-family:'Courier New',monospace;font-size:20px;letter-spacing:4px;color:#1a1a1a;">${opts.token}</p>
                <p style="margin:0;font-size:12px;color:#888;">If you didn't request this, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px;border-top:1px solid #e7e2d6;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#888;">
                © Maison Luxe · supports@codebreakers.uk
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!RESEND_API_KEY || !LOVABLE_API_KEY) {
    console.error("Missing RESEND_API_KEY or LOVABLE_API_KEY");
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  // Verify Supabase Auth webhook signature (Standard Webhooks).
  let payload: HookPayload;
  try {
    if (HOOK_SECRET) {
      const headers = Object.fromEntries(req.headers);
      const wh = new Webhook(HOOK_SECRET.replace(/^v1,/, ""));
      payload = wh.verify(rawBody, headers) as HookPayload;
    } else {
      // Allow unsecured during initial wiring; Supabase will sign once secret is set.
      payload = JSON.parse(rawBody) as HookPayload;
    }
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response(JSON.stringify({ error: "invalid_signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { user, email_data } = payload;
  const confirmUrl =
    `${email_data.site_url}/auth/v1/verify` +
    `?token=${encodeURIComponent(email_data.token_hash)}` +
    `&type=${encodeURIComponent(email_data.email_action_type)}` +
    `&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

  const html = buildHtml({
    type: email_data.email_action_type,
    confirmUrl,
    token: email_data.token,
  });

  try {
    const res = await fetch(`${GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: FROM,
        to: [user.email],
        subject: subjectFor(email_data.email_action_type),
        html,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Resend send failed:", res.status, data);
      return new Response(JSON.stringify({ error: "send_failed", details: data }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Resend request error:", err);
    return new Response(JSON.stringify({ error: "send_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
