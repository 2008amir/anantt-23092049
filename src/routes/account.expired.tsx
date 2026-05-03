import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Loader2, ChevronRight, Users, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  fetchEnrollments,
  type Enrollment,
  type RewardTask,
} from "@/lib/rewards";

export const Route = createFileRoute("/account/expired")({
  head: () => ({ meta: [{ title: "Expired Rewards — Luxe Sparkles" }] }),
  component: ExpiredPage,
});

type EnrollmentWithTask = Enrollment & { task: RewardTask | null };

function ExpiredPage() {
  const { user } = useStore();
  const [rows, setRows] = useState<EnrollmentWithTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const enrollments = await fetchEnrollments(user.id);
        if (cancelled) return;
        const expired = enrollments.filter(
          (e) =>
            e.status !== "completed" &&
            e.expires_at !== null &&
            new Date(e.expires_at) < new Date(),
        );
        if (expired.length === 0) {
          setRows([]);
          return;
        }
        const { data: tasks } = await supabase
          .from("rewards")
          .select("*")
          .in(
            "id",
            expired.map((e) => e.reward_id),
          );
        const map = new Map<string, RewardTask>();
        for (const t of (tasks ?? []) as unknown as RewardTask[]) map.set(t.id, t);
        setRows(expired.map((e) => ({ ...e, task: map.get(e.reward_id) ?? null })));
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
      <h2 className="font-serif text-3xl">Expired Rewards</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tasks that ran out of time before completion.
      </p>

      <div className="mt-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 border border-dashed border-border bg-card/30 px-6 py-20 text-center">
            <Gift className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No expired tasks.</p>
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
              const title = task?.title ?? "Removed reward";
              const image = task?.image ?? null;
              const taskType = task?.task_type ?? "referral";
              const content = (
                <>
                  {image ? (
                    <img
                      src={image}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded object-cover grayscale"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-muted">
                      {taskType === "referral" ? (
                        <Users className="h-6 w-6 text-muted-foreground" />
                      ) : (
                        <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{title}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-destructive">
                      {task ? "Expired" : "Expired · No longer available"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </>
              );
              if (!task) {
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-4 border border-border bg-card/40 p-4 opacity-60"
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
                  className="flex items-center gap-4 border border-border bg-card/40 p-4 opacity-75 transition-smooth hover:border-primary hover:opacity-100"
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
