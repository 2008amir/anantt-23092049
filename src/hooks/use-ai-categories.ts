import { useEffect, useState } from "react";
import { generateCategories } from "@/lib/ai.functions";

export type AICategory = { name: string; productIds: string[] };

let inflight: Promise<AICategory[]> | null = null;

async function load(): Promise<AICategory[]> {
  // Server caches via ai_cache table. No client-side localStorage cache.
  if (!inflight) {
    inflight = generateCategories()
      .then((res: { categories: AICategory[] }) => res.categories ?? [])
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
