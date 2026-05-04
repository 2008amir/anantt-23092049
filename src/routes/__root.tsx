import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouterState } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider } from "@/lib/theme";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Splash } from "@/components/Splash";
import { CartBubble } from "@/components/CartBubble";
import { Toaster } from "@/components/ui/sonner";
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat";
import { PWA } from "@/components/PWA";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-gold-gradient">404</h1>
        <h2 className="mt-4 font-serif text-2xl text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex items-center justify-center bg-gold-gradient px-8 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground transition-smooth hover:opacity-90"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Luxe Sparkles — A Curated Atelier of Considered Objects" },
      {
        name: "description",
        content:
          "Discover a meticulously curated collection of luxury timepieces, leather goods, fragrance, and home objects from the world's finest houses.",
      },
      { property: "og:title", content: "Luxe Sparkles — A Curated Atelier of Considered Objects" },
      { name: "twitter:title", content: "Luxe Sparkles — A Curated Atelier of Considered Objects" },
      { name: "description", content: "A luxury general merchandise marketplace with product browsing, search, cart, checkout, and order management." },
      { property: "og:description", content: "A luxury general merchandise marketplace with product browsing, search, cart, checkout, and order management." },
      { name: "twitter:description", content: "A luxury general merchandise marketplace with product browsing, search, cart, checkout, and order management." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/111629ba-7dda-4374-af68-8286fdeef935/id-preview-a556fe51--7ec3279f-b67f-4ffe-8911-e1b882a2f4b0.lovable.app-1777030033771.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/111629ba-7dda-4374-af68-8286fdeef935/id-preview-a556fe51--7ec3279f-b67f-4ffe-8911-e1b882a2f4b0.lovable.app-1777030033771.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { location } = useRouterState();
  const standalonePaths = new Set([
    "/verify-signup",
    "/verify-device",
    "/forgot-password",
    "/reset-password",
  ]);
  const isStandaloneRoute = standalonePaths.has(location.pathname);

  return (
    <ThemeProvider>
      <StoreProvider>
        {isStandaloneRoute ? (
          <Outlet />
        ) : (
          <>
            <ActivityTracker />
            <ReferralCapture />
            <CopyProtection />
            <PWA />
            <Splash>
              <div className="flex flex-col bg-background" style={{ minHeight: "100dvh" }}>
                <Header />
                <main className="flex-1">
                  <Outlet />
                </main>
                <CartBubble />
                <Footer />
                <Toaster position="top-center" richColors closeButton />
              </div>
            </Splash>
          </>
        )}
      </StoreProvider>
    </ThemeProvider>
  );
}

function CopyProtection() {
  if (typeof window !== "undefined") {
    if (!(window as unknown as { __mlCopyGuard?: boolean }).__mlCopyGuard) {
      (window as unknown as { __mlCopyGuard?: boolean }).__mlCopyGuard = true;
      const isFormField = (el: EventTarget | null) => {
        if (!(el instanceof HTMLElement)) return false;
        const tag = el.tagName;
        return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
      };
      const block = (e: Event) => {
        if (isFormField(e.target)) return;
        e.preventDefault();
      };
      document.addEventListener("contextmenu", block);
      document.addEventListener("copy", block);
      document.addEventListener("cut", block);
      document.addEventListener("dragstart", block);
      document.addEventListener("selectstart", block);
    }
  }
  return null;
}

function ActivityTracker() {
  useActivityHeartbeat();
  return null;
}

function ReferralCapture() {
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref && /^[A-Z0-9]{4,16}$/i.test(ref)) {
        localStorage.setItem("ml_ref_code", ref.toUpperCase());
      }
    } catch {
      // ignore
    }
  }
  return null;
}
