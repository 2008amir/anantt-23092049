import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
};

const STORAGE_KEY = "ml_theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystem(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(resolved: "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", resolved === "light");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Load saved preference once mounted (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
      setThemeState(saved);
    } catch {
      setThemeState("system");
    }
  }, []);

  const resolved: "light" | "dark" = useMemo(
    () => (theme === "system" ? getSystem() : theme),
    [theme],
  );

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  // React to OS changes when in "system" mode
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme(getSystem());
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback so callers don't crash if used outside provider.
    return {
      theme: "dark",
      resolved: "dark",
      setTheme: () => {
        /* no-op */
      },
    };
  }
  return ctx;
}
