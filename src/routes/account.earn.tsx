import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Loader2, Users, ShoppingBag, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { fetchActiveTasks, fetchEnrollments, type Enrollment, type RewardTask } from "@/lib/rewards";

export const Route = createFileRoute("/account/earn")({
  head: () => ({ meta: [{ title: "Earn & Free — Luxe Sparkles" }] }),
  component: EarnFreePage,
});

function EarnFreePage() {
  const { user } = useStore();
  const [tasks, setTasks] = useState<RewardTask[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [t, e] = await Promise.all([fetchActiveTasks(), fetchEnrollments(user.id)]);
        if (cancelled) return;
        setTasks(t);
        setEnrollments(e);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Only purchase tasks disappear once enrolled. Referral tasks can be
  // enrolled multiple times, so they always remain visible in the list.
  const enrolledPurchaseIds = new Set(
    enrollments
      .filter((e) => {
        const task = tasks.find((t) => t.id === e.reward_id);
        return task?.task_type === "purchase";
      })
      .map((e) => e.reward_id),
  );
  const visibleTasks = tasks.filter((t) => !enrolledPurchaseIds.has(t.id));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-3xl">Earn & Free</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete tasks and claim complimentary products.
          </p>
        </div>
        <Link
          to="/account/enrolled"
          className="text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
        >
          My tasks →
        </Link>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visibleTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 border border-dashed border-border bg-card/30 px-6 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-gradient/10">
              <Gift className="h-7 w-7 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-serif text-lg text-foreground">No tasks available</p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Check back soon
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {visibleTasks.map((t) => (
              <Link
                key={t.id}
                to="/account/reward/$id"
                params={{ id: t.id }}
                className="group overflow-hidden border border-border bg-card/50 transition-smooth hover:border-primary"
              >
                {t.image && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={t.image}
                      alt={t.title}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-primary">
                    {t.task_type === "referral" ? (
                      <>
                        <Users className="h-3.5 w-3.5" /> Referral task
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-3.5 w-3.5" /> Purchase task
                      </>
                    )}
                  </div>
                  <h3 className="mt-2 font-serif text-lg text-foreground">{t.title}</h3>
                  {t.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-end">
                    <span className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-primary">
                      Start
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
