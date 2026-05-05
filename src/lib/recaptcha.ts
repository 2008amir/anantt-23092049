// Client-side Google reCAPTCHA v2 (Checkbox) helper.
// The site key comes from the server (env RECAPTCHA_V2_SITE_KEY) — the secret
// stays on the server. We render an "I'm not a robot" checkbox above auth
// submit buttons; the resulting token is verified server-side.
import { useEffect, useRef, useState } from "react";

let cachedKey: string | null = null;
let keyPromise: Promise<string> | null = null;
let scriptPromise: Promise<void> | null = null;

async function fetchSiteKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  if (!keyPromise) {
    keyPromise = (async () => {
      const { getRecaptchaSiteKey } = await import("./recaptcha-config.functions");
      const res = await getRecaptchaSiteKey();
      cachedKey = res.siteKey || "";
      return cachedKey;
    })();
  }
  return keyPromise;
}

type GrecaptchaV2 = {
  ready: (cb: () => void) => void;
  render: (
    container: HTMLElement,
    opts: { sitekey: string; callback?: (t: string) => void; "expired-callback"?: () => void; theme?: "light" | "dark" },
  ) => number;
  reset: (id?: number) => void;
  getResponse: (id?: number) => string;
};

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as unknown as { grecaptcha?: GrecaptchaV2 }).grecaptcha) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("reCAPTCHA failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * React component that renders the "I'm not a robot" checkbox.
 * Uses a ref-supplied callback so the parent gets the token without re-renders.
 */
export function RecaptchaCheckbox({
  onChange,
  theme = "light",
}: {
  onChange: (token: string | null) => void;
  theme?: "light" | "dark";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState<string | null>(null);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [, key] = await Promise.all([loadScript(), fetchSiteKey()]);
        if (cancelled || !containerRef.current) return;
        if (!key) {
          setError("Security check unavailable.");
          return;
        }
        const g = (window as unknown as { grecaptcha?: GrecaptchaV2 }).grecaptcha;
        if (!g) return;
        await new Promise<void>((r) => g.ready(r));
        if (cancelled || !containerRef.current || widgetIdRef.current !== null) return;
        widgetIdRef.current = g.render(containerRef.current, {
          sitekey: key,
          theme,
          callback: (t) => onChangeRef.current(t),
          "expired-callback": () => onChangeRef.current(null),
        });
      } catch {
        if (!cancelled) setError("Could not load security check.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [theme]);

  return (
    <div className="flex flex-col items-center">
      <div ref={containerRef} />
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Imperatively reset all rendered widgets. Useful after a failed submit. */
export function resetRecaptchaWidgets() {
  if (typeof window === "undefined") return;
  const g = (window as unknown as { grecaptcha?: GrecaptchaV2 }).grecaptcha;
  try {
    g?.reset();
  } catch {
    /* ignore */
  }
}

/**
 * Backwards-compat shim for any caller that still uses the old v3 API.
 * v2 is interactive — there is no silent token. Returns null so callers can
 * fall back to "please complete the captcha".
 */
export async function getRecaptchaToken(_action: string): Promise<string | null> {
  return null;
}
