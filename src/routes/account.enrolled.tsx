import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Loader2, ChevronRight, Users, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  fetchEnrollments,
  fetchReferrals,
  isTaskCompleted,
  timeRemaining,
  type Enrollment,
  type RewardTask,
  type Referral,
} from "@/lib/rewards";

export const Route = createFileRoute("/account/enrolled")({
  head: () => ({ meta: [{ title: "Enrolled Rewards — Luxe Sparkles" }] }),
  component: EnrolledPage,
});

type EnrollmentWithTask = Enrollment & { task: RewardTask | null };

function EnrolledPage() {
  const { user } = useStore();
  const [rows, setRows] = useState<EnrollmentWithTask[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  // Re-render every second for countdown
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [enrollments, refs] = await Promise.all([
          fetchEnrollments(user.id),
          fetchReferrals(user.id),
        ]);
        if (cancelled) return;
        setReferrals(refs);
        // Exclude expired (unclaimed) ones — they live on /account/expired
        const active = enrollments.filter(
          (e) =>
            e.status === "completed" ||
            e.expires_at === null ||
            new Date(e.expires_at) >= new Date(),
        );
        if (active.length === 0) {
          setRows([]);
          return;
        }
        const { data: tasks } = await supabase
          .from("rewards")
          .select("*")
          .in("id", active.map((e) => e.reward_id));
        const map = new Map<string, RewardTask>();
        for (const t of (tasks ?? []) as unknown as RewardTask[]) map.set(t.id, t);
        setRows(active.map((e) => ({ ...e, task: map.get(e.reward_id) ?? null })));
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

  return (
    <div>
      <h2 className="font-serif text-3xl">Enrolled Rewards</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tasks you've started. Progress updates automatically.
      </p>

      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border border-dashed border-border bg-card/30 px-6 py-20 text-center">
            <Gift className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No enrolled tasks yet.</p>
            <Link
              to="/account/earn"
              className="text-xs uppercase tracking-[0.25em] text-primary hover:underline"
            >
              Browse rewards →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const task = row.task;
              const myRefs = referrals.filter((r) => r.enrollment_id === row.id);
              const completed =
                row.status === "completed" ||
                (task?.task_type === "referral" && task && isTaskCompleted(task, myRefs));
              const expired =
                row.status !== "completed" &&
                row.expires_at !== null &&
                new Date(row.expires_at) < new Date();
              const label = completed
                ? "Completed — claim now"
                : expired
                  ? "Expired"
                  : timeRemaining(row.expires_at);
              const title = task?.title ?? "Removed reward";
              const image = task?.image ?? null;
              const taskType = task?.task_type ?? "referral";
              const content = (
                <>
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-gold-gradient/10">
                      {taskType === "referral" ? (
                        <Users className="h-6 w-6 text-primary" />
                      ) : (
                        <ShoppingBag className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{title}</p>
                    <p
                      className={`mt-1 text-[11px] uppercase tracking-wider ${
                        completed
                          ? "text-primary"
                          : expired
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {task ? label : "No longer available"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </>
              );
              if (!task) {
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-4 border border-border bg-card/50 p-4 opacity-60"
                  >
                    {content}
                  </div>
                );
              }
              return (
                <Link
                  key={row.id}
                  to="/account/reward/$id"
                  params={{ id: task.id }}
                  className="flex items-center gap-4 border border-border bg-card/50 p-4 transition-smooth hover:border-primary"
                >
                  {content}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
