import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Flutterwave webhook endpoint.
 *
 * Configure this URL in your Flutterwave dashboard
 * (Settings → Webhooks):
 *   https://luxesparkles.codebreakers.uk/webhook/flutterwave
 *
 * Set the "Secret hash" to the same value as the FLUTTERWAVE_WEBHOOK_SECRET
 * runtime secret. Flutterwave sends it back in the `verif-hash` header on
 * every event so we can authenticate the call.
 */
export const Route = createFileRoute("/api/public/flutterwave-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
        const signature = request.headers.get("verif-hash");
        if (!secret || !signature || signature !== secret) {
          return new Response("Invalid signature", { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as {
          event?: string;
          data?: {
            tx_ref?: string;
            status?: string;
            amount?: number;
            id?: string | number;
            meta?: { order_id?: string };
          };
        } | null;

        if (!body?.data) {
          return new Response("Bad payload", { status: 400 });
        }

        const { tx_ref, status, meta } = body.data;
        const orderId = meta?.order_id;
        if (!orderId && !tx_ref) {
          return new Response("Missing reference", { status: 400 });
        }

        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response("Backend not configured", { status: 500 });
        }
        const admin = createClient<Database>(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const success = status === "successful" || status === "succeeded";
        const update = success
          ? { payment_status: "paid", status: "Processing" }
          : status === "failed" || status === "cancelled"
            ? { payment_status: "failed", status: "Payment Failed" }
            : null;

        if (!update) return new Response("ok"); // pending — ignore

        const query = admin.from("orders").update(update);
        const { error } = orderId
          ? await query.eq("id", orderId)
          : await query.eq("payment_reference", tx_ref!);

        if (error) {
          console.error("Webhook update failed:", error);
          return new Response("DB error", { status: 500 });
        }

        if (success) {
          try {
            const { sendOrderConfirmationEmail } = await import(
              "@/lib/order-email.functions"
            );
            const targetId =
              orderId ??
              (
                await admin
                  .from("orders")
                  .select("id")
                  .eq("payment_reference", tx_ref!)
                  .maybeSingle()
              ).data?.id;
            if (targetId) {
              await sendOrderConfirmationEmail({ data: { orderId: targetId } });
            }
          } catch (e) {
            console.error("webhook order confirmation email failed", e);
          }
        }

        return new Response("ok");
      },
    },
  },
});
