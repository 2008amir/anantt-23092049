import { PAYSTACK_PUBLIC_KEY } from "./paystack.client";


type PaystackHandler = {
  openIframe: () => void;
};

type PaystackPopup = {
  setup: (opts: {
    key: string;
    email: string;
    amount: number; // in kobo/cents
    ref?: string;
    channels?: string[];
    metadata?: Record<string, unknown>;
    callback: (response: { reference: string }) => void;
    onClose: () => void;
  }) => PaystackHandler;
};

declare global {
  interface Window {
    PaystackPop?: PaystackPopup;
  }
}

let loadingPromise: Promise<void> | null = null;

export function loadPaystackScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.PaystackPop) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loadingPromise = null;
      reject(new Error("Failed to load Paystack"));
    };
    document.head.appendChild(script);
  });
  return loadingPromise;
}

export async function openPaystackPopup(opts: {
  email: string;
  amount: number; // in major currency units (e.g. naira)
  reference: string;
  channels?: string[];
  metadata?: Record<string, unknown>;
}): Promise<{ reference: string } | null> {
  await loadPaystackScript();
  if (!window.PaystackPop) throw new Error("Paystack not available");
  return new Promise((resolve) => {
    const handler = window.PaystackPop!.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: opts.email,
      amount: Math.round(opts.amount * 100),
      ref: opts.reference,
      channels: opts.channels ?? ["card", "bank_transfer", "ussd", "mobile_money"],
      metadata: opts.metadata,
      callback: (response) => resolve({ reference: response.reference }),
      onClose: () => resolve(null),
    });
    handler.openIframe();
  });
}
