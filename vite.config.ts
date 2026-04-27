// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        // Service worker disabled in dev to avoid breaking the Lovable preview iframe.
        devOptions: { enabled: false },
        manifest: {
          name: "Maison Luxe",
          short_name: "Maison Luxe",
          description: "Luxury fashion & sparkle. Shop offline-ready.",
          theme_color: "#0f0f10",
          background_color: "#0f0f10",
          display: "standalone",
          start_url: "/",
          scope: "/",
          icons: [
            { src: "/favicon.ico", sizes: "64x64", type: "image/x-icon" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
          // Don't intercept API/auth/server-fn or webhooks
          navigateFallback: "/",
          navigateFallbackDenylist: [
            /^\/~oauth/,
            /^\/api\//,
            /^\/_/,
            /^\/webhook/,
          ],
          runtimeCaching: [
            // Product images & remote images: cache-first, long lived
            {
              urlPattern: ({ request }) => request.destination === "image",
              handler: "CacheFirst",
              options: {
                cacheName: "img-cache",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Fonts
            {
              urlPattern: ({ request }) => request.destination === "font",
              handler: "CacheFirst",
              options: {
                cacheName: "font-cache",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Supabase REST/storage GETs: stale-while-revalidate so last-seen
            // product/category data is available offline.
            {
              urlPattern: ({ url, request }) =>
                request.method === "GET" &&
                url.hostname.endsWith(".supabase.co") &&
                (url.pathname.startsWith("/rest/") || url.pathname.startsWith("/storage/")),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "supabase-get-cache",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
