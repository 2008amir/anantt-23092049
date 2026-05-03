import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import hero from "@/assets/hero.jpg";

const KEY = "lux_entered_v1";

export function Splash({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(true);

  useEffect(() => {
    const has = typeof window !== "undefined" && localStorage.getItem(KEY) === "1";
    setEntered(has);
    setReady(true);
  }, []);

  const enter = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // ignore
    }
    setEntered(true);
    // Land on the home page (first bottom-nav tab) after the very first entry.
    if (location.pathname !== "/") {
      void navigate({ to: "/" });
    }
  };

  if (!ready) return null;
  if (entered) return <>{children}</>;

  return (
    <section className="fixed inset-0 z-50 overflow-hidden bg-background">
      <img
        src={hero}
        alt="Luxe Sparkles"
        className="absolute inset-0 h-full w-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background" />
      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.5em] text-primary">Luxe Sparkles</p>
        <h1 className="mt-6 font-serif text-5xl leading-[1.05] text-foreground md:text-7xl">
          Objects of <em className="text-gold-gradient">enduring</em> craft.
        </h1>
        <p className="mt-6 max-w-md text-sm text-muted-foreground md:text-base">
          A curated atelier of timepieces, leather goods, fragrance, and home objects from the world's finest houses.
        </p>
        <button
          type="button"
          onClick={enter}
          className="group mt-12 inline-flex items-center gap-3 bg-gold-gradient px-12 py-5 text-xs uppercase tracking-[0.35em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90"
        >
          Start
          <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-1" />
        </button>
        <p className="mt-8 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Tap once · welcome inside
        </p>
      </div>
    </section>
  );
}
