import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SENDER_EMAIL = "luxesparkles-de@codebreakers.uk";
const SENDER_NAME = "Luxe Sparkles Delivery";

type OrderItemRow = {
  product_name: string;
  product_image: string | null;
  quantity: number;
  price: number | string;
  variant?: { color?: string; size?: string } | null;
};

type ShippingAddress = {
  name?: string;
  address?: string;
  address_line?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
} | null;

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAddress(addr: ShippingAddress): string {
  if (!addr) return "—";
  const line = addr.address ?? addr.address_line ?? "";
  const parts = [
    line,
    [addr.city, addr.state].filter(Boolean).join(", "),
    addr.zip,
    addr.country,
    addr.phone ? `Phone: ${addr.phone}` : null,
  ].filter(Boolean) as string[];
  return parts.map(escapeHtml).join("<br/>");
}

function buildEmailHtml(opts: {
  customerName: string;
  customerEmail: string;
  shippingAddress: ShippingAddress;
  deliveryPlace: string;
  items: OrderItemRow[];
  total: number;
  orderId: string;
}) {
  const itemsHtml = opts.items
    .map((it) => {
      const variantText = it.variant
        ? [
            it.variant.color ? `Color: ${it.variant.color}` : "",
            it.variant.size ? `Size: ${it.variant.size}` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : "";
      const lineTotal = (Number(it.price) * it.quantity).toLocaleString();
      const img = it.product_image
        ? `<img src="${escapeHtml(it.product_image)}" alt="${escapeHtml(it.product_name)}" width="84" height="84" style="display:block;width:84px;height:84px;object-fit:cover;border:1px solid #e5d6a8;border-radius:4px;background:#fff;" />`
        : `<div style="width:84px;height:84px;background:#f3f3f3;border:1px solid #e5d6a8;border-radius:4px;"></div>`;
      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #eee;vertical-align:top;width:100px;">${img}</td>
          <td style="padding:14px 12px;border-bottom:1px solid #eee;vertical-align:top;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:600;">${escapeHtml(it.product_name)}</div>
            <div style="font-size:12px;color:#666;margin-top:4px;">Quantity: ${it.quantity}</div>
            ${variantText ? `<div style="font-size:12px;color:#666;margin-top:2px;">${escapeHtml(variantText)}</div>` : ""}
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #eee;vertical-align:top;text-align:right;font-family:Helvetica,Arial,sans-serif;color:#c9a14a;font-weight:600;white-space:nowrap;">
            ₦${lineTotal}
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f3f3f3;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f3f3;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="background:#ffffff;max-width:640px;width:100%;">
          <tr>
            <td style="padding:0;">
              <div style="background:linear-gradient(180deg,#fff8ec 0%,#fdf1d8 100%);padding:36px 20px 28px 20px;text-align:center;">
                <div style="font-size:18px;color:#c9a14a;letter-spacing:2px;">✦  ✧</div>
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;color:#1a1a1a;margin-top:6px;">Luxe Sparkles</div>
                <div style="font-size:13px;color:#c9a14a;margin-top:2px;letter-spacing:2px;text-transform:uppercase;">Order Delivered</div>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 40px 8px 40px;text-align:center;">
              <h1 style="margin:0;font-size:26px;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;">Your order is here, ${escapeHtml(opts.customerName)}! 🎉</h1>
              <p style="margin:14px 0 0 0;font-size:14px;color:#444;">Your products have been successfully delivered.</p>
              <p style="margin:6px 0 0 0;font-size:12px;color:#888;">Order #${escapeHtml(opts.orderId.slice(0, 8).toUpperCase())}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 0 40px;">
              <div style="background:#fff8ec;border:1px solid #e5d6a8;border-radius:6px;padding:18px 20px;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1a1a;margin-bottom:8px;">📍 Pickup / Drop-off Point</div>
                <p style="margin:0 0 10px 0;font-size:15px;line-height:1.6;color:#1a1a1a;">
                  Please collect your package at:<br/>
                  <strong style="color:#c9a14a;font-size:16px;">${escapeHtml(opts.deliveryPlace)}</strong>
                </p>
                <p style="margin:0;font-size:13px;line-height:1.7;color:#444;">
                  Your products have arrived safely and are now waiting for you at the location above.
                  Our delivery partner has confirmed handover at this point — please proceed there to
                  receive your order. Kindly bring a valid form of identification matching the name on
                  the order so the package can be released to you without delay. If you have authorised
                  someone else to collect on your behalf, they should bring both their ID and a written
                  note from you. We recommend collecting your order as soon as possible to avoid any
                  storage limitations at the pickup point. Once you receive the package, take a moment
                  to inspect each item carefully — every Luxe Sparkles piece is hand-checked, polished,
                  and securely packaged before it leaves our atelier, but if anything looks off, please
                  contact our customer care team immediately and we will make it right. Thank you for
                  trusting Luxe Sparkles with your purchase. We hope every piece brings you joy, and we
                  look forward to welcoming you back to our collection again very soon. ✨
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 40px 0 40px;">
              <h2 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1a1a1a;border-bottom:2px solid #c9a14a;padding-bottom:6px;">Your Items</h2>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                ${itemsHtml}
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                <tr>
                  <td style="text-align:right;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1a1a;">
                    Order Total:
                    <span style="color:#c9a14a;font-weight:700;margin-left:8px;">₦${opts.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 0 40px;">
              <h2 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1a1a1a;border-bottom:2px solid #c9a14a;padding-bottom:6px;">Customer Details</h2>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#1a1a1a;">
                <strong>Name:</strong> ${escapeHtml(opts.customerName)}<br/>
                <strong>Email:</strong> ${escapeHtml(opts.customerEmail)}<br/>
                <strong>Delivery Address:</strong><br/>
                ${formatAddress(opts.shippingAddress)}
              </p>
              <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#1a1a1a;">
                <strong>Delivery Place:</strong> ${escapeHtml(opts.deliveryPlace)}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 0 40px;text-align:center;">
              <a href="https://luxesparkles.codebreakers.uk/orders/${escapeHtml(opts.orderId)}"
                 style="display:inline-block;background:linear-gradient(135deg,#c9a14a,#e5c879);color:#fff;padding:14px 36px;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase;border-radius:4px;">
                Track Your Order
              </a>
              <p style="margin:10px 0 0 0;font-size:12px;color:#888;">View order status, address, and pickup point.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 40px 28px 40px;text-align:center;font-size:13px;color:#666;border-top:1px solid #eee;margin-top:24px;">
              Need help with your delivery? Just reply to this email and we'll take care of it.
              <div style="margin-top:14px;color:#888;font-size:12px;">© ${new Date().getFullYear()} Luxe Sparkles. All rights reserved.</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendBrevo(opts: { to: string; subject: string; html: string }) {
  const apiKey = process.env.BREVO_DELIVERED_API_KEY;
  if (!apiKey) throw new Error("Delivered email key not configured");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: opts.to }],
      subject: opts.subject,
      htmlContent: opts.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Brevo delivered email error", res.status, body);
    throw new Error("Delivered email send failed");
  }
}

/**
 * Sends a "your order has been delivered" email after the deliverer marks it delivered.
 */
export const sendOrderDeliveredEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ orderId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, total, delivery_stage, delivery_place, shipping_address, order_items(*)")
      .eq("id", data.orderId)
      .maybeSingle();

    if (error || !order) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (order.delivery_stage !== "delivered") {
      return { ok: false as const, reason: "not_delivered" as const };
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, last_name, display_name")
      .eq("id", order.user_id)
      .maybeSingle();

    const shipping = (order.shipping_address ?? null) as ShippingAddress;
    const recipient = profile?.email ?? null;
    if (!recipient) {
      return { ok: false as const, reason: "no_email" as const };
    }

    const customerName =
      shipping?.name ||
      [shipping?.first_name, shipping?.last_name].filter(Boolean).join(" ").trim() ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
      profile?.display_name ||
      "valued customer";

    const items = (order.order_items ?? []) as OrderItemRow[];
    const total = Number(order.total) || 0;
    const deliveryPlace = (order.delivery_place ?? "").trim() || "your delivery address";

    const html = buildEmailHtml({
      customerName,
      customerEmail: recipient,
      shippingAddress: shipping,
      deliveryPlace,
      items,
      total,
      orderId: order.id,
    });

    try {
      await sendBrevo({
        to: recipient,
        subject: `Your Luxe Sparkles order has been delivered ✨`,
        html,
      });
    } catch (e) {
      console.error("delivered email failed", e);
      return { ok: false as const, reason: "email" as const };
    }

    return { ok: true as const };
  });
