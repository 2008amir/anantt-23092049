// Supabase Auth "Send Email" hook.
// Receives auth email events (signup, recovery, etc.) and sends them
// through Brevo (Sendinblue) from luxesparkles@codebreakers.uk.

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

const FROM_EMAIL = "luxesparkles@codebreakers.uk";
const FROM_NAME = "Luxe Sparkles";
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

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
      return "Verify your email — Luxe Sparkles";
    case "recovery":
      return "Reset your password — Luxe Sparkles";
    case "magiclink":
      return "Your sign-in link — Luxe Sparkles";
    case "invite":
      return "You're invited — Luxe Sparkles";
    case "email_change":
    case "email_change_current":
    case "email_change_new":
      return "Confirm your new email — Luxe Sparkles";
    case "reauthentication":
      return "Confirm it's you — Luxe Sparkles";
    default:
      return "Luxe Sparkles";
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
      return "You're invited to Luxe Sparkles";
    case "email_change":
    case "email_change_current":
    case "email_change_new":
      return "Confirm your new email";
    case "reauthentication":
      return "Confirm it's really you";
    default:
      return "Luxe Sparkles";
  }
}

function buildHtml(opts: {
  type: EmailActionType;
  confirmUrl: string;
  token: string;
}): string {
  const headline = headlineFor(opts.type);
  const action =
    opts.type === "signup"
      ? "activate your account"
      : opts.type === "recovery"
        ? "reset your password"
        : opts.type === "magiclink"
          ? "sign in"
          : "confirm this action";

  const intro = `Thank you for using Luxe Sparkles! To ${action}, please verify your email address by clicking the button below.`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f3f3;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f3f3;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;max-width:600px;width:100%;">
          <tr>
            <td style="padding:0;">
              <div style="background:linear-gradient(180deg,#fff8ec 0%,#fdf1d8 100%);padding:36px 20px 28px 20px;text-align:center;">
                <div style="font-size:18px;color:#c9a14a;letter-spacing:2px;">✦  ✧</div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:40px;color:#1a1a1a;margin-top:6px;">Luxe Sparkles</div>
                <div style="font-size:14px;color:#c9a14a;margin-top:2px;">✧</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px 8px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;color:#1a1a1a;">${headline === "Verify your email" ? "Verify Your Email Address" : headline}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 40px 0 40px;font-size:15px;line-height:1.55;color:#1a1a1a;">
              <p style="margin:0 0 14px 0;">Hello,</p>
              <p style="margin:0 0 24px 0;">${intro}</p>
              <p style="text-align:center;margin:0 0 26px 0;">
                <a href="${opts.confirmUrl}" style="display:inline-block;background:#c9a14a;color:#ffffff;text-decoration:none;padding:16px 64px;font-size:16px;font-weight:600;border-radius:6px;">Verify My Email</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 24px 40px;">
              <div style="background:#efefef;padding:18px 20px;text-align:center;font-size:13px;color:#333;border-radius:4px;">
                <strong>Note:</strong> This link will expire in 60 minutes.<br/>
                Please use it promptly.<br/>
                <span style="font-family:'Courier New',monospace;font-size:14px;letter-spacing:2px;color:#1a1a1a;">${opts.token}</span>
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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!BREVO_API_KEY) {
    console.error("Missing BREVO_API_KEY");
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  let payload: HookPayload;
  try {
    payload = JSON.parse(rawBody) as HookPayload;
  } catch (err) {
    console.error("Invalid payload:", err);
    return new Response(JSON.stringify({ error: "invalid_payload" }), {
      status: 400,
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
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY,
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: FROM_NAME, email: FROM_EMAIL },
        to: [{ email: user.email }],
        subject: subjectFor(email_data.email_action_type),
        htmlContent: html,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Brevo send failed:", res.status, data);
      return new Response(JSON.stringify({ error: "send_failed", details: data }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.messageId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Brevo request error:", err);
    return new Response(JSON.stringify({ error: "send_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
