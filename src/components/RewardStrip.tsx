import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { useStore } from "@/lib/store";
import { fetchActiveTasks, fetchEnrollments, type RewardTask } from "@/lib/rewards";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function RewardStrip() {
  const { user } = useStore();
  const [tasks, setTasks] = useState<RewardTask[]>([]);
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchActiveTasks();
        if (cancelled) return;
        // Signed-in users see all referral tasks plus any purchase tasks
        // they haven't already enrolled in. Anonymous visitors see every
        // active task — the strip simply starts showing up as soon as they
        // create an account, without extra work.
        let visible = list;
        if (user) {
          const enrollments = await fetchEnrollments(user.id);
          const enrolledPurchase = new Set(
            enrollments
              .filter((e) => {
                const t = list.find((x) => x.id === e.reward_id);
                return t?.task_type === "purchase";
              })
              .map((e) => e.reward_id),
          );
          visible = list.filter((t) => !enrolledPurchase.has(t.id));
        }
        if (cancelled) return;
        setTasks(shuffle(visible));
      } catch (err) {
        console.error("reward strip", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const count = tasks.length;
  const [lastInteract, setLastInteract] = useState(0);

  // Auto-rotate every 10s. Reshuffle positions every full cycle so
  // the ordering changes across refreshes and over time.
  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => {
      const el = scrollerRef.current;
      if (!el) return;
      setIndex((prev) => {
        const next = prev + 1;
        if (next >= count) {
          // end of list → reshuffle and return to start
          setTasks((p) => shuffle(p));
          el.scrollTo({ left: 0, behavior: "smooth" });
          return 0;
        }
        el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
        return next;
      });
    }, 10000);
    return () => clearInterval(t);
    // lastInteract is a dep so manual scroll resets the 10s timer
  }, [count, lastInteract]);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w === 0) return;
    const i = Math.round(el.scrollLeft / w);
    if (i !== index && i >= 0 && i < count) setIndex(i);
  };

  // Reset the 10s timer whenever the user manually swipes the carousel.
  const onManualScroll = () => {
    setLastInteract(Date.now());
  };

  const counterLabel = useMemo(
    () => (count > 1 ? `${index + 1}/${count}` : null),
    [index, count],
  );

  // Render nothing — no spacing at all — when there are no tasks
  if (count === 0) return null;

  return (
    <div className="mx-auto mt-3 max-w-5xl px-2">
      <div
        className="overflow-hidden rounded-2xl border-2 border-primary/60 p-2 shadow-luxury backdrop-blur-md"
        style={{
          backgroundImage:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 28%, transparent), color-mix(in oklab, var(--primary) 12%, transparent), color-mix(in oklab, var(--primary) 22%, transparent))",
          boxShadow:
            "0 8px 24px -8px color-mix(in oklab, var(--primary) 40%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--primary) 35%, transparent)",
        }}
      >
        <div
          ref={scrollerRef}
          onScroll={onScroll}
          onTouchStart={onManualScroll}
          onMouseDown={onManualScroll}
          onWheel={onManualScroll}
          className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
          style={{ scrollBehavior: "smooth" }}
        >
          {tasks.map((t) => (
            <Link
              key={t.id}
              to="/account/reward/$id"
              params={{ id: t.id }}
              className="group relative flex w-full shrink-0 snap-center items-center gap-4 px-3"
              style={{ height: "7.5pc" }}
            >
              {t.image ? (
                <img
                  src={t.image}
                  alt=""
                  className="h-[6.5pc] w-32 shrink-0 object-cover"
                  style={{ borderRadius: "20%" }}
                />
              ) : (
                <div
                  className="flex h-[6.5pc] w-32 shrink-0 items-center justify-center bg-gold-gradient/10"
                  style={{ borderRadius: "20%" }}
                >
                  <Gift className="h-8 w-8 text-primary" strokeWidth={1.5} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-serif text-base text-foreground">
                  {t.title}
                </p>
                {t.description && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-primary">
                Start →
              </span>
            </Link>
          ))}
        </div>
      </div>
      {counterLabel && (
        <div className="mt-1 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {counterLabel}
        </div>
      )}
    </div>
  );
}
