import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Check,
  Share2,
  Loader2,
  Users,
  ShoppingBag,
  Gift,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";
import {
  enrollInTask,
  fetchReferrals,
  isTaskCompleted,
  progressPercent,
  referralLink,
  timeRemaining,
  type Enrollment,
  type Referral,
  type RewardTask,
} from "@/lib/rewards";
import { toast } from "sonner";

export const Route = createFileRoute("/account/reward/$id")({
  head: () => ({ meta: [{ title: "Reward Task — Luxe Sparkles" }] }),
  component: RewardDetailPage,
});

function RewardDetailPage() {
  const { id } = Route.useParams();
  const { user } = useStore();
  const navigate = useNavigate();

  const [task, setTask] = useState<RewardTask | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [starting, setStarting] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useMemo(
    () => async () => {
      if (!user) return;
      setLoading(true);
      try {
        const [{ data: taskRow }, { data: allEnrollments }] = await Promise.all([
          supabase.from("rewards").select("*").eq("id", id).maybeSingle(),
          supabase
            .from("reward_enrollments")
            .select("*")
            .eq("user_id", user.id)
            .eq("reward_id", id)
            .order("started_at", { ascending: false }),
        ]);
        const row = (taskRow as unknown as RewardTask) ?? null;
        setTask(row);
        // For referral tasks the user can enroll many times; we show the most
        // recent still-active (not expired, not completed) enrollment. For
        // purchase tasks there is at most one enrollment anyway.
        const list = (allEnrollments ?? []) as Enrollment[];
        const active = list.find(
          (e) =>
            e.status === "active" &&
            (!e.expires_at || new Date(e.expires_at) > new Date()),
        );
        const shown = active ?? list[0] ?? null;
        setEnrollment(shown);
        if (shown) {
          const refs = await fetchReferrals(user.id);
          setReferrals(refs.filter((r) => r.enrollment_id === shown.id));
        } else {
          setReferrals([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [id, user],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (text: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      toast.success(kind === "code" ? "Referral code copied" : "Referral link copied");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const share = async (link: string, title: string) => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Join me on Luxe Sparkles",
          text: title,
          url: link,
        });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }
    await copy(link, "link");
  };

  const start = async () => {
    if (!user || !task) return;
    setStarting(true);
    try {
      // Address gate — every reward (referral or purchase) requires a
      // saved shipping address before the user can enroll, so the order
      // can later move to "Processing" without delay.
      const { count } = await supabase
        .from("addresses")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (!count || count === 0) {
        toast.error("Please add a shipping address before starting a task.");
        navigate({ to: "/account/addresses" });
        return;
      }
      const created = await enrollInTask(user.id, task);
      setEnrollment(created);
      setReferrals([]);
      toast.success("Task started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">This reward task was not found.</p>
        <Link
          to="/account/earn"
          className="mt-4 inline-block text-xs uppercase tracking-[0.25em] text-primary hover:underline"
        >
          ← Back to rewards
        </Link>
      </div>
    );
  }

  const expired =
    enrollment?.status !== "completed" &&
    enrollment?.expires_at &&
    new Date(enrollment.expires_at) < new Date();
  const completed =
    enrollment?.status === "completed" ||
    (task.task_type === "referral" && enrollment && isTaskCompleted(task, referrals));

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4">
        {task.image ? (
          <img src={task.image} alt={task.title} className="h-20 w-20 rounded object-cover" />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded bg-gold-gradient/10">
            {task.task_type === "referral" ? (
              <Users className="h-8 w-8 text-primary" />
            ) : (
              <ShoppingBag className="h-8 w-8 text-primary" />
            )}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
            {task.task_type === "referral" ? "Referral task" : "Purchase task"}
          </p>
          <h1 className="mt-1 font-serif text-2xl">{task.title}</h1>
          {task.description && (
            <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
          )}
        </div>
      </div>

      {enrollment?.expires_at && (
        <div className="mt-6 grid gap-3 rounded-md border border-border bg-card/50 p-4 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Time remaining
            </p>
            <p
              className={`mt-1 font-medium ${
                completed
                  ? "text-primary"
                  : expired
                    ? "text-destructive"
                    : "text-foreground"
              }`}
            >
              {completed ? "Task completed" : timeRemaining(enrollment.expires_at)}
            </p>
          </div>
        </div>
      )}

      {/* Not yet enrolled — or referral task where user can start again */}
      {(!enrollment || (task.task_type === "referral" && (!!completed || !!expired))) && (
        <button
          onClick={() => void start()}
          disabled={starting}
          className="mt-6 w-full bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90 disabled:opacity-60"
        >
          {starting ? "Starting…" : enrollment ? "Start another" : "Start task"}
        </button>
      )}

      {/* Enrolled — referral view */}
      {enrollment && task.task_type === "referral" && (
        <ReferralView
          task={task}
          enrollment={enrollment}
          referrals={referrals}
          onCopy={copy}
          onShare={share}
          copied={copied}
          completed={!!completed}
          expired={!!expired}
        />
      )}

      {/* Enrolled — purchase view */}
      {enrollment && task.task_type === "purchase" && (
        <PurchaseView
          task={task}
          enrollment={enrollment}
          completed={!!completed}
          expired={!!expired}
          onBrowse={() => navigate({ to: "/shop" })}
        />
      )}

      {/* Claim button */}
      {enrollment && completed && !enrollment.claimed_product_id && (
        <Link
          to="/account/claim/$id"
          params={{ id: enrollment.id }}
          className="mt-6 flex w-full items-center justify-center gap-2 bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90"
        >
          <Gift className="h-4 w-4" /> Claim your free product
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {enrollment?.claimed_product_id && (
        <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-4 text-center text-sm text-primary">
          You've already claimed your reward from this task.
        </div>
      )}
    </div>
  );
}

function ReferralView({
  task,
  enrollment,
  referrals,
  onCopy,
  onShare,
  copied,
  completed,
  expired,
}: {
  task: RewardTask;
  enrollment: Enrollment;
  referrals: Referral[];
  onCopy: (text: string, kind: "code" | "link") => void;
  onShare: (link: string, title: string) => void;
  copied: "code" | "link" | null;
  completed: boolean;
  expired: boolean;
}) {
  const goal = task.referral_goal ?? 0;
  const pct = progressPercent(referrals.length, goal);
  const link = referralLink(enrollment.referral_code);

  // Fetch invited users (name/email) for this enrollment
  const [invited, setInvited] = useState<{ id: string; first_name: string | null; last_name: string | null; display_name: string | null; email: string | null }[]>([]);
  useEffect(() => {
    if (referrals.length === 0) {
      setInvited([]);
      return;
    }
    const ids = referrals.map((r) => r.referred_user_id);
    void supabase
      .from("profiles")
      .select("id, first_name, last_name, display_name, email")
      .in("id", ids)
      .then(({ data }) => setInvited((data ?? []) as typeof invited));
  }, [referrals]);

  return (
    <div className="mt-6 space-y-5">
      <div>
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Progress</span>
          <span className="text-primary">{pct.toFixed(pct === 100 ? 0 : 1)}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gold-gradient transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        {task.require_purchase && !completed && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Referred friends must complete a paid order to count fully.
          </p>
        )}
      </div>

      <div className="rounded-md border border-border bg-card/50 p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Your referral code</p>
        <div className="mt-2 flex items-center gap-2">
          <p className="flex-1 font-mono text-lg tracking-widest text-foreground">{enrollment.referral_code}</p>
          <button type="button" onClick={() => onCopy(enrollment.referral_code, "code")} className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-wider transition-smooth hover:border-primary hover:text-primary">
            {copied === "code" ? (<><Check className="h-3.5 w-3.5" /> Copied</>) : (<><Copy className="h-3.5 w-3.5" /> Copy code</>)}
          </button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card/50 p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Your referral link</p>
        <p className="mt-2 break-all text-sm text-foreground">{link}</p>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onCopy(link, "link")} className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border px-3 py-2 text-xs uppercase tracking-wider transition-smooth hover:border-primary hover:text-primary">
            {copied === "link" ? (<><Check className="h-3.5 w-3.5" /> Copied</>) : (<><Copy className="h-3.5 w-3.5" /> Copy link</>)}
          </button>
          <button type="button" onClick={() => onShare(link, task.title)} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-gold-gradient px-3 py-2 text-xs uppercase tracking-wider text-primary-foreground shadow-gold transition-smooth hover:opacity-90">
            <Share2 className="h-3.5 w-3.5" /> Share referral link
          </button>
        </div>
      </div>

      {/* Invited users */}
      <div className="rounded-md border border-border bg-card/50 p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          People you invited ({invited.length})
        </p>
        {invited.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No one has signed up with your link yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {invited.map((p) => {
              const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_name || "Friend";
              const ref = referrals.find((r) => r.referred_user_id === p.id);
              return (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.email ?? "—"}</p>
                  </div>
                  {ref?.has_purchased && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">Purchased</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {expired && !completed && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
          This task has expired.
        </div>
      )}
    </div>
  );
}

function PurchaseView({
  task,
  completed,
  expired,
  onBrowse,
}: {
  task: RewardTask;
  enrollment: Enrollment;
  completed: boolean;
  expired: boolean;
  onBrowse: () => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-md border border-border bg-card/50 p-4">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Goal
        </p>
        <p className="mt-1 text-sm text-foreground">
          Buy {task.product_amount ?? 0} product(s) to unlock a free item.
        </p>
      </div>
      {!completed && !expired && (
        <button
          type="button"
          onClick={onBrowse}
          className="w-full bg-gold-gradient py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90"
        >
          Browse products
        </button>
      )}
      {expired && !completed && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
          This task has expired.
        </div>
      )}
    </div>
  );
}
