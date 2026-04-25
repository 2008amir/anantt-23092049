import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const FROM = "Maison Luxe <luxesparkles@codebreakers.uk>";
const GATEWAY = "https://connector-gateway.lovable.dev/resend";

function getAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateCode(): string {
  // 6-digit numeric code
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}

function emailHtml(code: string, purpose: string): string {
  const intent =
    purpose === "signup"
      ? "verify your account"
      : purpose === "signin"
        ? "sign in to your account"
        : "verify your identity";
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#ffffff;padding:24px;color:#111">
    <div style="max-width:480px;margin:0 auto;border:1px solid #eee;border-radius:8px;padding:32px">
      <h1 style="font-size:18px;letter-spacing:0.2em;text-transform:uppercase;color:#b8860b;margin:0 0 8px">Maison Luxe</h1>
      <h2 style="font-size:22px;margin:8px 0 16px">Your verification code</h2>
      <p style="font-size:14px;color:#444;line-height:1.5;margin:0 0 16px">
        Use the code below to ${intent}. This code expires in <strong>10 minutes</strong>.
      </p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:0.5em;text-align:center;background:#faf6ec;padding:18px;border-radius:6px;color:#111">${code}</div>
      <p style="font-size:12px;color:#888;margin:20px 0 0">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </body></html>`;
}

async function sendCodeEmail(to: string, code: string, purpose: string) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    throw new Error("Email service is not configured");
  }
  const subject =
    purpose === "signup"
      ? `${code} is your Maison Luxe verification code`
      : `${code} is your Maison Luxe sign-in code`;

  const res = await fetch(`${GATEWAY}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html: emailHtml(code, purpose),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Failed to send email (${res.status}): ${t.slice(0, 200)}`);
  }
}

export const requestAuthCode = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; purpose: "signup" | "signin" }) => {
    const email = String(input.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");
    const purpose = input.purpose === "signup" ? "signup" : "signin";
    return { email, purpose };
  })
  .handler(async ({ data }) => {
    const admin = getAdmin();

    // Rate limit: max 3 unused codes in last 5 minutes
    const sinceIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("auth_email_codes")
      .select("id", { count: "exact", head: true })
      .eq("email", data.email)
      .eq("purpose", data.purpose)
      .gte("created_at", sinceIso);
    if ((count ?? 0) >= 3) {
      throw new Error("Too many codes requested. Please wait a few minutes.");
    }

    const code = generateCode();
    const code_hash = await sha256Hex(`${data.email}:${code}`);
    const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await admin.from("auth_email_codes").insert({
      email: data.email,
      purpose: data.purpose,
      code_hash,
      expires_at,
    });
    if (error) throw new Error(error.message);

    await sendCodeEmail(data.email, code, data.purpose);
    return { ok: true };
  });

export const verifyAuthCode = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { email: string; code: string; purpose: "signup" | "signin" }) => {
      const email = String(input.email || "").trim().toLowerCase();
      const code = String(input.code || "").trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");
      if (!/^\d{6}$/.test(code)) throw new Error("Code must be 6 digits");
      const purpose = input.purpose === "signup" ? "signup" : "signin";
      return { email, code, purpose };
    },
  )
  .handler(async ({ data }) => {
    const admin = getAdmin();
    const code_hash = await sha256Hex(`${data.email}:${data.code}`);

    const { data: rows, error } = await admin
      .from("auth_email_codes")
      .select("id, attempts, used, expires_at")
      .eq("email", data.email)
      .eq("purpose", data.purpose)
      .eq("code_hash", code_hash)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);

    const row = rows?.[0];
    if (!row) {
      // Still increment attempts on the most recent unused code for this email/purpose
      await admin.rpc; // no-op; keep type happy
      const { data: latest } = await admin
        .from("auth_email_codes")
        .select("id, attempts")
        .eq("email", data.email)
        .eq("purpose", data.purpose)
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1);
      const last = latest?.[0];
      if (last) {
        await admin
          .from("auth_email_codes")
          .update({ attempts: (last.attempts ?? 0) + 1 })
          .eq("id", last.id);
      }
      throw new Error("Invalid verification code");
    }
    if (row.used) throw new Error("This code has already been used");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("This code has expired. Please request a new one.");
    }
    if ((row.attempts ?? 0) >= 5) {
      throw new Error("Too many attempts. Please request a new code.");
    }

    const { error: upErr } = await admin
      .from("auth_email_codes")
      .update({ used: true })
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });
