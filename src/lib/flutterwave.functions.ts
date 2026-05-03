import { createServerFn } from "@tanstack/react-start";
import { getFlutterwaveAuthContext } from "./flutterwave-auth.server";

export const FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK-179082bdf3e13ed7270551d4d05dd4a5-X";

const FLW_BASE = "https://api.flutterwave.com/v3";

function secretKey() {
  const key = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error("FLUTTERWAVE_SECRET_KEY not configured");
  return key;
}

async function flwFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${FLW_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status === "error") {
    const err = new Error(json?.message ?? `Flutterwave error ${res.status}`) as Error & { code?: string };
    err.code = json?.message ?? "";
    throw err;
  }
  return json;
}

/**
 * Initialize a Flutterwave Standard checkout (hosted page) — used for card,
 * Opay (mobilemoneyghana / opay redirect via paylink), or any non-saved flow.
 */
export const initFlutterwave = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      email: string;
      name?: string;
      phone?: string;
      tx_ref: string;
      callbackUrl: string;
      paymentOptions?: string; // e.g. "card", "opay", "banktransfer"
      meta?: Record<string, unknown>;
      accessToken?: string;
    }) => {
      if (!input?.amount || input.amount <= 0) throw new Error("amount required");
      if (!input.email || !/^\S+@\S+\.\S+$/.test(input.email)) throw new Error("valid email required");
      if (!input.tx_ref) throw new Error("tx_ref required");
      if (!input.callbackUrl) throw new Error("callbackUrl required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { userId } = await getFlutterwaveAuthContext(data.accessToken);

    const res = await flwFetch("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: data.tx_ref,
        amount: data.amount,
        currency: "NGN",
        redirect_url: data.callbackUrl,
        payment_options: data.paymentOptions ?? "card,banktransfer,opay,ussd",
        customer: {
          email: data.email,
          name: data.name,
          phonenumber: data.phone,
        },
        meta: { ...(data.meta ?? {}), user_id: userId },
      }),
    });

    return {
      link: res.data?.link as string,
      tx_ref: data.tx_ref,
    };
  });

/**
 * Charge a saved card token (re-bill the customer without redirect).
 */
export const chargeSavedCard = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      email: string;
      tx_ref: string;
      token: string;
      meta?: Record<string, unknown>;
      accessToken?: string;
    }) => {
      if (!input?.token) throw new Error("token required");
      if (!input?.amount || input.amount <= 0) throw new Error("amount required");
      if (!input.tx_ref) throw new Error("tx_ref required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { userId } = await getFlutterwaveAuthContext(data.accessToken);

    const res = await flwFetch("/tokenized-charges", {
      method: "POST",
      body: JSON.stringify({
        token: data.token,
        currency: "NGN",
        country: "NG",
        amount: data.amount,
        email: data.email,
        tx_ref: data.tx_ref,
        narration: "Luxe Sparkles order",
        meta: { ...(data.meta ?? {}), user_id: userId },
      }),
    });

    return {
      success: res.data?.status === "successful",
      status: res.data?.status as string,
      flw_ref: res.data?.flw_ref as string,
      tx_ref: data.tx_ref,
    };
  });

/**
 * Create a one-off dedicated virtual bank account for an order.
 * The account expires after the amount is paid.
 */
export const createVirtualAccount = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      email: string;
      tx_ref: string;
      name?: string;
      bvn?: string;
      accessToken?: string;
    }) => {
      if (!input?.amount || input.amount <= 0) throw new Error("amount required");
      if (!input.email) throw new Error("email required");
      if (!input.tx_ref) throw new Error("tx_ref required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    await getFlutterwaveAuthContext(data.accessToken);

    const res = await flwFetch("/virtual-account-numbers", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        amount: data.amount,
        tx_ref: data.tx_ref,
        is_permanent: false,
        narration: data.name ?? "Luxe Sparkles Order",
        currency: "NGN",
      }),
    });

    return {
      account_number: res.data?.account_number as string,
      bank_name: res.data?.bank_name as string,
      account_name: (res.data?.account_name ?? data.name ?? "Luxe Sparkles") as string,
      expiry_date: res.data?.expiry_date as string,
      amount: res.data?.amount ?? data.amount,
      order_ref: res.data?.order_ref as string,
      flw_ref: res.data?.flw_ref as string,
    };
  });

/**
 * Verify a transaction by tx_ref (used after redirect or popup callback).
 * Optionally save the card token for future re-billing.
 */
export const verifyFlutterwave = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      tx_ref: string;
      transaction_id?: string | number;
      saveCard?: boolean;
      accessToken?: string;
    }) => {
      if (!input?.tx_ref) throw new Error("tx_ref required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { supabase, userId } = await getFlutterwaveAuthContext(data.accessToken);

    let tx: Record<string, unknown> | null = null;
    try {
      if (data.transaction_id) {
        const res = await flwFetch(`/transactions/${data.transaction_id}/verify`);
        tx = res.data;
      } else {
        const res = await flwFetch(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(data.tx_ref)}`);
        tx = res.data;
      }
    } catch (err) {
      // No transaction yet (e.g. waiting for bank transfer) — return pending
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("no transaction") || msg.includes("not found")) {
        return { success: false, status: "pending", tx_ref: data.tx_ref, flw_ref: "", amount: 0, payment_type: "" };
      }
      throw err;
    }

    const success = tx?.status === "successful";

    if (success && data.saveCard && tx) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const card = (tx as any).card as
        | { token?: string; last_4digits?: string; expiry?: string; type?: string; issuer?: string }
        | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customer = (tx as any).customer as { email?: string; name?: string } | undefined;

      if (card?.token) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { data: existing } = await sb
          .from("payment_methods")
          .select("id")
          .eq("user_id", userId)
          .eq("authorization_code", card.token)
          .maybeSingle();
        if (!existing) {
          const expiry = card.expiry ?? "//";
          const [exp_month, exp_year] = expiry.split("/");
          await sb.from("payment_methods").insert({
            user_id: userId,
            brand: card.type ?? card.issuer ?? "Card",
            last4: card.last_4digits ?? "",
            exp_month: exp_month ?? "",
            exp_year: exp_year ?? "",
            card_holder: customer?.name ?? "",
            authorization_code: card.token,
            email: customer?.email ?? null,
          });
        }
      }
    }

    return {
      success,
      status: (tx?.status as string) ?? "unknown",
      tx_ref: (tx?.tx_ref as string) ?? data.tx_ref,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      flw_ref: (tx as any)?.flw_ref as string,
      amount: (tx?.amount as number) ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payment_type: (tx as any)?.payment_type as string,
    };
  });
