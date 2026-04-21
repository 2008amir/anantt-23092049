import { createServerFn } from "@tanstack/react-start";
import { getFlutterwaveAuthContext } from "./flutterwave-auth.server";

// Flutterwave v4 (public beta).
// Sandbox host: developersandbox-api.flutterwave.com
const FLW4_HOST = "https://developersandbox-api.flutterwave.com";
const FLW4_OAUTH = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getV4AccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;
  const clientId = process.env.FLUTTERWAVE_V4_CLIENT_ID;
  const clientSecret = process.env.FLUTTERWAVE_V4_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Flutterwave v4 credentials not configured");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(FLW4_OAUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description ?? `Flutterwave v4 auth failed (${res.status})`);
  }
  cachedToken = { token: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 300) * 1000 };
  return cachedToken.token;
}

async function flw4Fetch(path: string, init?: RequestInit & { body?: string }) {
  const token = await getV4AccessToken();
  const traceId = `tr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const idemKey = `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const res = await fetch(`${FLW4_HOST}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Trace-Id": traceId,
      "X-Idempotency-Key": idemKey,
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as {
    status?: string;
    message?: string;
    data?: Record<string, unknown>;
  };
  if (!res.ok || json.status === "error" || json.status === "failed") {
    throw new Error(json.message ?? `Flutterwave v4 error ${res.status}`);
  }
  return json;
}

async function createCustomer(opts: { email: string; name?: string; phone?: string }) {
  const [first, ...rest] = (opts.name ?? "Customer").trim().split(/\s+/);
  const last = rest.length > 0 ? rest.join(" ") : "User";
  const res = await flw4Fetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      email: opts.email,
      name: { first, last },
      ...(opts.phone
        ? { phone: { country_code: "234", number: opts.phone.replace(/^\+?234/, "") } }
        : {}),
    }),
  });
  const id = res.data?.id as string;
  if (!id) throw new Error("Failed to create customer");
  return id;
}

async function createPaymentMethod(type: "opay" | "card" | "bank_transfer") {
  const res = await flw4Fetch("/payment-methods", {
    method: "POST",
    body: JSON.stringify({ type }),
  });
  const id = res.data?.id as string;
  if (!id) throw new Error(`Failed to create ${type} payment method`);
  return id;
}

/* ---------------- OPAY ---------------- */

export const initOpayV4 = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      email: string;
      name?: string;
      phone?: string;
      reference: string;
      meta?: Record<string, unknown>;
      accessToken?: string;
    }) => {
      if (!input?.amount || input.amount <= 0) throw new Error("amount required");
      if (!input.email || !/^\S+@\S+\.\S+$/.test(input.email)) throw new Error("valid email required");
      if (!input.reference) throw new Error("reference required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    await getFlutterwaveAuthContext(data.accessToken);
    const customerId = await createCustomer({ email: data.email, name: data.name, phone: data.phone });
    const paymentMethodId = await createPaymentMethod("opay");
    const chargeRes = await flw4Fetch("/charges", {
      method: "POST",
      body: JSON.stringify({
        currency: "NGN",
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        amount: data.amount,
        reference: data.reference,
        meta: data.meta ?? {},
      }),
    });
    const chargeId = chargeRes.data?.id as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redirectUrl = (chargeRes.data as any)?.next_action?.redirect_url?.url as string | undefined;
    if (!redirectUrl) throw new Error("Opay did not return a redirect URL");
    return { chargeId, reference: data.reference, redirectUrl };
  });

/* ---------------- CARD (hosted page) ---------------- */

export const initCardV4 = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      email: string;
      name?: string;
      phone?: string;
      reference: string;
      saveCard?: boolean;
      meta?: Record<string, unknown>;
      accessToken?: string;
    }) => {
      if (!input?.amount || input.amount <= 0) throw new Error("amount required");
      if (!input.email || !/^\S+@\S+\.\S+$/.test(input.email)) throw new Error("valid email required");
      if (!input.reference) throw new Error("reference required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { userId } = await getFlutterwaveAuthContext(data.accessToken);
    const customerId = await createCustomer({ email: data.email, name: data.name, phone: data.phone });
    const paymentMethodId = await createPaymentMethod("card");
    const chargeRes = await flw4Fetch("/charges", {
      method: "POST",
      body: JSON.stringify({
        currency: "NGN",
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        amount: data.amount,
        reference: data.reference,
        meta: { ...(data.meta ?? {}), user_id: userId, save_card: data.saveCard ? "1" : "0" },
      }),
    });
    const chargeId = chargeRes.data?.id as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextAction = (chargeRes.data as any)?.next_action;
    const redirectUrl = nextAction?.redirect_url?.url as string | undefined;
    if (!redirectUrl) throw new Error("Flutterwave did not return a card redirect URL");
    return { chargeId, reference: data.reference, redirectUrl, customerId, paymentMethodId };
  });

/* ---------------- SAVED CARD (tokenized re-charge) ---------------- */

export const chargeSavedCardV4 = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      email: string;
      reference: string;
      paymentMethodId: string; // saved v4 payment_method id
      customerId: string; // saved v4 customer id
      meta?: Record<string, unknown>;
      accessToken?: string;
    }) => {
      if (!input?.paymentMethodId) throw new Error("paymentMethodId required");
      if (!input?.customerId) throw new Error("customerId required");
      if (!input?.amount || input.amount <= 0) throw new Error("amount required");
      if (!input.reference) throw new Error("reference required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { userId } = await getFlutterwaveAuthContext(data.accessToken);
    const res = await flw4Fetch("/charges", {
      method: "POST",
      body: JSON.stringify({
        currency: "NGN",
        customer_id: data.customerId,
        payment_method_id: data.paymentMethodId,
        amount: data.amount,
        reference: data.reference,
        meta: { ...(data.meta ?? {}), user_id: userId },
      }),
    });
    const status = res.data?.status as string | undefined;
    return {
      chargeId: res.data?.id as string,
      success: status === "succeeded" || status === "successful",
      status: status ?? "pending",
      reference: data.reference,
    };
  });

/* ---------------- BANK TRANSFER (dedicated virtual account) ---------------- */

export const initBankTransferV4 = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      amount: number;
      email: string;
      name?: string;
      phone?: string;
      reference: string;
      meta?: Record<string, unknown>;
      accessToken?: string;
    }) => {
      if (!input?.amount || input.amount <= 0) throw new Error("amount required");
      if (!input.email) throw new Error("email required");
      if (!input.reference) throw new Error("reference required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    await getFlutterwaveAuthContext(data.accessToken);
    const customerId = await createCustomer({ email: data.email, name: data.name, phone: data.phone });
    const paymentMethodId = await createPaymentMethod("bank_transfer");
    const chargeRes = await flw4Fetch("/charges", {
      method: "POST",
      body: JSON.stringify({
        currency: "NGN",
        customer_id: customerId,
        payment_method_id: paymentMethodId,
        amount: data.amount,
        reference: data.reference,
        meta: data.meta ?? {},
      }),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nextAction = (chargeRes.data as any)?.next_action;
    // v4 returns a `payment_instruction` for bank_transfer with account details.
    const instruction =
      nextAction?.payment_instruction ??
      nextAction?.bank_transfer ??
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chargeRes.data as any)?.payment_method_details?.bank_transfer ??
      {};
    return {
      chargeId: chargeRes.data?.id as string,
      reference: data.reference,
      account_number: (instruction.account_number as string) ?? "",
      bank_name: (instruction.bank_name as string) ?? "",
      account_name: (instruction.account_name as string) ?? data.name ?? "Maison Luxe",
      expiry_date: (instruction.expires_at as string) ?? (instruction.expiry_date as string) ?? "",
      amount: data.amount,
    };
  });

/* ---------------- VERIFY (works for any v4 charge) ---------------- */

export const verifyChargeV4 = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { chargeId: string; saveCard?: boolean; accessToken?: string }) => {
      if (!input?.chargeId) throw new Error("chargeId required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    const { supabase, userId } = await getFlutterwaveAuthContext(data.accessToken);
    try {
      const res = await flw4Fetch(`/charges/${data.chargeId}`);
      const tx = res.data ?? {};
      const status = tx.status as string | undefined;
      const success = status === "succeeded" || status === "successful";

      if (success && data.saveCard) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pm = (tx as any).payment_method_details as
          | {
              id?: string;
              type?: string;
              customer_id?: string;
              card?: { last4?: string; brand?: string; exp_month?: string | number; exp_year?: string | number; holder_name?: string };
            }
          | undefined;
        if (pm?.type === "card" && pm.id && pm.card?.last4) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sb = supabase as any;
          const { data: existing } = await sb
            .from("payment_methods")
            .select("id")
            .eq("user_id", userId)
            .eq("authorization_code", pm.id)
            .maybeSingle();
          if (!existing) {
            await sb.from("payment_methods").insert({
              user_id: userId,
              brand: pm.card.brand ?? "Card",
              last4: pm.card.last4,
              exp_month: String(pm.card.exp_month ?? ""),
              exp_year: String(pm.card.exp_year ?? ""),
              card_holder: pm.card.holder_name ?? "",
              authorization_code: pm.id, // v4 payment_method_id
              paystack_customer_code: pm.customer_id ?? null, // reuse column for v4 customer_id
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              email: ((tx as any).customer?.email as string) ?? null,
            });
          }
        }
      }

      return {
        success,
        status: status ?? "pending",
        chargeId: data.chargeId,
        reference: (tx.reference as string) ?? "",
        amount: (tx.amount as number) ?? 0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("not found") || msg.includes("no charge")) {
        return { success: false, status: "pending", chargeId: data.chargeId, reference: "", amount: 0 };
      }
      throw err;
    }
  });
