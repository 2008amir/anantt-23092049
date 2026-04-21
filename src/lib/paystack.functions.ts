import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PAYSTACK_PUBLIC_KEY = "pk_live_bf83087e2c333f9db3c6ee41d95d1befa13e8c8f";

const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY not configured");
  return key;
}

async function paystackFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message ?? `Paystack error ${res.status}`);
  }
  return json;
}

// ─── Initialize a transaction (returns authorization_url + reference) ────────
export const initPaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    amount: number;
    email: string;
    channels?: string[];
    callbackUrl: string;
    metadata?: Record<string, unknown>;
    authorization_code?: string;
  }) => {
    if (!input?.amount || input.amount <= 0) throw new Error("amount required");
    if (!input.email || !/^\S+@\S+\.\S+$/.test(input.email)) throw new Error("valid email required");
    if (!input.callbackUrl) throw new Error("callbackUrl required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // If using a saved card, charge the authorization directly
    if (data.authorization_code) {
      const res = await paystackFetch("/transaction/charge_authorization", {
        method: "POST",
        body: JSON.stringify({
          authorization_code: data.authorization_code,
          email: data.email,
          amount: Math.round(data.amount * 100), // kobo/cents
          metadata: { ...(data.metadata ?? {}), user_id: userId },
        }),
      });
      return {
        mode: "charged" as const,
        reference: res.data?.reference as string,
        status: res.data?.status as string,
      };
    }

    const res = await paystackFetch("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(data.amount * 100),
        email: data.email,
        callback_url: data.callbackUrl,
        channels: data.channels ?? ["card", "bank_transfer", "ussd", "mobile_money"],
        metadata: { ...(data.metadata ?? {}), user_id: userId },
      }),
    });

    return {
      mode: "redirect" as const,
      authorization_url: res.data?.authorization_url as string,
      reference: res.data?.reference as string,
    };
  });

// ─── Verify a transaction & optionally save the card ────────────────────────
export const verifyPaystack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reference: string; saveCard?: boolean }) => {
    if (!input?.reference) throw new Error("reference required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const res = await paystackFetch(`/transaction/verify/${encodeURIComponent(data.reference)}`);
    const tx = res.data;
    const success = tx?.status === "success";

    if (success && data.saveCard && tx?.authorization?.reusable && tx?.authorization?.authorization_code) {
      const auth = tx.authorization;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: existing } = await sb
        .from("payment_methods")
        .select("id")
        .eq("user_id", userId)
        .eq("authorization_code", auth.authorization_code)
        .maybeSingle();
      if (!existing) {
        await sb.from("payment_methods").insert({
          user_id: userId,
          brand: auth.brand ?? auth.card_type ?? "Card",
          last4: auth.last4 ?? "",
          exp_month: auth.exp_month ?? "",
          exp_year: auth.exp_year ?? "",
          card_holder: auth.account_name ?? tx.customer?.first_name ?? "",
          authorization_code: auth.authorization_code,
          paystack_customer_code: tx.customer?.customer_code ?? null,
          email: tx.customer?.email ?? null,
        });
      }
    }

    return {
      success,
      status: tx?.status as string,
      reference: tx?.reference as string,
      amount: (tx?.amount ?? 0) / 100,
      channel: tx?.channel as string,
    };
  });
