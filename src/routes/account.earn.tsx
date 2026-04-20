import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Recommend } from "@/components/Recommend";

type Reward = {
  id: string;
  title: string;
  description: string;
  image: string | null;
  points: number;
  is_free: boolean;
};

export const Route = createFileRoute("/account/earn")({
  head: () => ({ meta: [{ title: "Earn & Free — Maison Luxe" }] }),
  component: EarnFreePage,
});

function EarnFreePage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("rewards")
      .select("id, title, description, image, points, is_free")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        setRewards((data ?? []) as Reward[]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div>
        <h2 className="font-serif text-3xl">Earn & Free</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Exclusive rewards, points, and complimentary pieces curated for our collectors.
        </p>

        <div className="mt-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rewards.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 border border-dashed border-border bg-card/30 px-6 py-20 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-gradient/10">
                <Gift className="h-7 w-7 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-serif text-lg text-foreground">No rewards yet</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Check back soon for exclusive offers
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {rewards.map((r) => (
                <article key={r.id} className="overflow-hidden border border-border bg-card/50 transition-smooth hover:border-primary">
                  {r.image && (
                    <div className="aspect-video overflow-hidden">
                      <img src={r.image} alt={r.title} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
                        {r.is_free ? "Complimentary" : `${r.points} pts`}
                      </p>
                    </div>
                    <h3 className="mt-2 font-serif text-lg text-foreground">{r.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{r.description}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      <Recommend />
    </>
  );
}
