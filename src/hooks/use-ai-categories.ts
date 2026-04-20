import { useEffect, useState } from "react";
import { generateCategories, type AICategory } from "@/lib/categories.functions";

const CACHE_KEY = "lux_ai_categories_v1";
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24h

let inflight: Promise<AICategory[]> | null = null;

async function load(): Promise<AICategory[]> {
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { ts: number; data: AICategory[] };
        if (Date.now() - parsed.ts < CACHE_TTL && parsed.data?.length) {
          return parsed.data;
        }
      }
    } catch {
      // ignore
    }
  }
  if (!inflight) {
    inflight = generateCategories()
      .then((res) => {
        const data = res.categories ?? [];
        if (typeof window !== "undefined" && data.length) {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
          } catch {
            // ignore
          }
        }
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useAICategories() {
  const [categories, setCategories] = useState<AICategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading };
}
