// Client-side Google reCAPTCHA v3 helper.
// The site key is public — safe to commit.
export const RECAPTCHA_SITE_KEY = "6LfY4dcsAAAAANabQtm8bE1JO3tH_F0DDu8JhdnQ";

let loaderPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as unknown as { grecaptcha?: unknown }).grecaptcha) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("reCAPTCHA failed to load"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}

type Grecaptcha = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, opts: { action: string }) => Promise<string>;
};

export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    await loadScript();
    const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
    if (!g) return null;
    return await new Promise<string>((resolve) => {
      g.ready(() => {
        g.execute(RECAPTCHA_SITE_KEY, { action })
          .then(resolve)
          .catch(() => resolve(""));
      });
    });
  } catch {
    return null;
  }
}
