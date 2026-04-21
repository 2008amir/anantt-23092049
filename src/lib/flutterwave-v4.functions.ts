import { createServerFn } from "@tanstack/react-start";
import { getFlutterwaveAuthContext } from "./flutterwave-auth.server";

// Flutterwave v4 (public beta) — used here specifically for the Opay flow.
// Sandbox host: developersandbox-api.flutterwave.com
// Production host: api.flutterwave.cloud (subject to change while in beta)
const FLW4_HOST = "https://developersandbox-api.flutterwave.com";
const FLW4_OAUTH = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getV4AccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token;
  }
  const clientId = process.env.FLUTTERWAVE_V4_CLIENT_ID;
  const clientSecret = process.env.FLUTTERWAVE_V4_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Flutterwave v4 credentials not configured");
  }
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
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 300) * 1000,
  };
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

/**
 * Initiate an Opay charge via Flutterwave v4. Returns a redirect URL where
 * the customer must authorize the payment on Opay's hosted page.
 */
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

    // 1. Create customer
    const [first, ...rest] = (data.name ?? "Customer").trim().split(/\s+/);
    const last = rest.length > 0 ? rest.join(" ") : "User";
    const customerRes = await flw4Fetch("/customers", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        name: { first, last },
        ...(data.phone
          ? { phone: { country_code: "234", number: data.phone.replace(/^\+?234/, "") } }
          : {}),
      }),
    });
    const customerId = customerRes.data?.id as string;
    if (!customerId) throw new Error("Failed to create customer");

    // 2. Create Opay payment method
    const pmRes = await flw4Fetch("/payment-methods", {
      method: "POST",
      body: JSON.stringify({ type: "opay" }),
    });
    const paymentMethodId = pmRes.data?.id as string;
    if (!paymentMethodId) throw new Error("Failed to create Opay payment method");

    // 3. Create the charge
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
    const nextAction = (chargeRes.data as any)?.next_action;
    const redirectUrl = nextAction?.redirect_url?.url as string | undefined;

    if (!redirectUrl) throw new Error("Opay did not return a redirect URL");

    return {
      chargeId,
      reference: data.reference,
      redirectUrl,
    };
  });

/**
 * Retrieve a v4 charge to verify Opay payment status.
 */
export const verifyOpayV4 = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { chargeId: string; accessToken?: string }) => {
      if (!input?.chargeId) throw new Error("chargeId required");
      if (!input.accessToken) throw new Error("auth required");
      return input;
    },
  )
  .handler(async ({ data }) => {
    await getFlutterwaveAuthContext(data.accessToken);
    try {
      const res = await flw4Fetch(`/charges/${data.chargeId}`);
      const status = res.data?.status as string | undefined;
      const success = status === "succeeded" || status === "successful";
      return {
        success,
        status: status ?? "pending",
        chargeId: data.chargeId,
        reference: (res.data?.reference as string) ?? "",
        amount: (res.data?.amount as number) ?? 0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("not found") || msg.includes("no charge")) {
        return { success: false, status: "pending", chargeId: data.chargeId, reference: "", amount: 0 };
      }
      throw err;
    }
  });
