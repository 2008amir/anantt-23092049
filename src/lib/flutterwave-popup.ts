const FLUTTERWAVE_PUBLIC_KEY = "FLWPUBK-179082bdf3e13ed7270551d4d05dd4a5-X";

type FlwConfig = {
  public_key: string;
  tx_ref: string;
  amount: number;
  currency: string;
  payment_options?: string;
  customer: { email: string; name?: string; phone_number?: string };
  meta?: Record<string, unknown>;
  customizations?: { title?: string; description?: string; logo?: string };
  callback: (data: { status: string; tx_ref: string; transaction_id?: number | string }) => void;
  onclose: () => void;
};

declare global {
  interface Window {
    FlutterwaveCheckout?: (config: FlwConfig) => void;
  }
}

let loadingPromise: Promise<void> | null = null;

export function loadFlutterwaveScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.FlutterwaveCheckout) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error("Failed to load Flutterwave"));
    };
    document.head.appendChild(script);
  });
  return loadingPromise;
}

export async function openFlutterwavePopup(opts: {
  email: string;
  name?: string;
  phone?: string;
  amount: number;
  tx_ref: string;
  paymentOptions?: string;
  meta?: Record<string, unknown>;
  title?: string;
  description?: string;
}): Promise<{ status: string; tx_ref: string; transaction_id?: number | string } | null> {
  await loadFlutterwaveScript();
  if (!window.FlutterwaveCheckout) throw new Error("Flutterwave not available");
  return new Promise((resolve) => {
    window.FlutterwaveCheckout!({
      public_key: FLUTTERWAVE_PUBLIC_KEY,
      tx_ref: opts.tx_ref,
      amount: opts.amount,
      currency: "NGN",
      payment_options: opts.paymentOptions ?? "card,banktransfer,opay,ussd",
      customer: { email: opts.email, name: opts.name, phone_number: opts.phone },
      meta: opts.meta,
      customizations: {
        title: opts.title ?? "Luxe Sparkles",
        description: opts.description ?? "Order payment",
      },
      callback: (data) => {
        resolve({ status: data.status, tx_ref: data.tx_ref, transaction_id: data.transaction_id });
      },
      onclose: () => resolve(null),
    });
  });
}
