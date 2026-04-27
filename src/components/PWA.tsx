import { useEffect, useState } from "react";

/**
 * Registers the service worker (production only) and shows a small
 * offline indicator. Service workers are intentionally NOT registered
 * in the Lovable editor preview iframe — they would cache stale builds
 * and break the live preview.
 */
export function PWA() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();
    const isPreviewHost =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com");

    if (isPreviewHost || isInIframe) {
      // Make doubly sure no SW is left over from a previous visit.
      navigator.serviceWorker?.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    // Dynamic import — vite-plugin-pwa generates this virtual module only at build time.
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({ immediate: true });
      })
      .catch(() => {
        // No SW available (e.g. dev build) — silently ignore.
      });

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="fixed left-1/2 top-3 z-[100] -translate-x-1/2 rounded-full border border-amber-500/40 bg-amber-500/15 px-4 py-1.5 text-[11px] uppercase tracking-[0.25em] text-amber-600 backdrop-blur">
      You're offline — viewing cached content
    </div>
  );
}
