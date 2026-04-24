import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { StoreProvider } from "@/lib/store";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Splash } from "@/components/Splash";
import { CartBubble } from "@/components/CartBubble";
import { Toaster } from "@/components/ui/sonner";
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat";


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
      { title: "Maison Luxe — A Curated Atelier of Considered Objects" },
      {
        name: "description",
        content:
          "Discover a meticulously curated collection of luxury timepieces, leather goods, fragrance, and home objects from the world's finest houses.",
      },
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
  return (
    <StoreProvider>
      <ActivityTracker />
      <ReferralCapture />
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
    </StoreProvider>
  );
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
