import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift, Users, ShoppingBag } from "lucide-react";
import { fetchActiveTasks, type RewardTask } from "@/lib/rewards";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function RewardStrip() {
  const [tasks, setTasks] = useState<RewardTask[]>([]);
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchActiveTasks();
        if (cancelled) return;
        setTasks(shuffle(list));
      } catch (err) {
        console.error("reward strip", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const count = tasks.length;

  // Auto-rotate every 30s
  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % count;
        const el = scrollerRef.current;
        if (el) {
          el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
        }
        return next;
      });
    }, 30000);
    return () => clearInterval(t);
  }, [count]);

  // Track index on user scroll
  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    if (w === 0) return;
    const i = Math.round(el.scrollLeft / w);
    if (i !== index && i >= 0 && i < count) setIndex(i);
  };

  const counterLabel = useMemo(
    () => (count > 1 ? `${index + 1}/${count}` : null),
    [index, count],
  );

  if (count === 0) return null;

  return (
    <div className="mx-auto mt-3 max-w-5xl">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
        style={{ scrollBehavior: "smooth" }}
      >
        {tasks.map((t) => (
          <Link
            key={t.id}
            to="/account/reward/$id"
            params={{ id: t.id }}
            className="group relative flex h-[5pc] w-full shrink-0 snap-center items-center gap-3 overflow-hidden border border-border/60 bg-card/60 px-4 transition-smooth hover:border-primary"
          >
            {t.image ? (
              <img
                src={t.image}
                alt=""
                className="h-full w-16 shrink-0 object-cover"
              />
            ) : (
              <div className="flex h-full w-16 shrink-0 items-center justify-center bg-gold-gradient/10">
                <Gift className="h-6 w-6 text-primary" strokeWidth={1.5} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-primary">
                {t.task_type === "referral" ? (
                  <Users className="h-3 w-3" />
                ) : (
                  <ShoppingBag className="h-3 w-3" />
                )}
                {t.task_type === "referral" ? "Referral reward" : "Purchase reward"}
              </div>
              <p className="truncate font-serif text-sm text-foreground">
                {t.title}
              </p>
              {t.description && (
                <p className="truncate text-[11px] text-muted-foreground">
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
      {counterLabel && (
        <div className="mt-1 text-center text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {counterLabel}
        </div>
      )}
    </div>
  );
}
