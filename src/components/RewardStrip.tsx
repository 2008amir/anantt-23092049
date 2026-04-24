import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gift } from "lucide-react";
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

  // Auto-rotate every 30s — reshuffle order each cycle so positions change
  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => {
      setTasks((prev) => shuffle(prev));
      setIndex(0);
      const el = scrollerRef.current;
      if (el) el.scrollTo({ left: 0, behavior: "smooth" });
    }, 30000);
    return () => clearInterval(t);
  }, [count]);

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

  // Render nothing — no spacing at all — when there are no tasks
  if (count === 0) return null;

  return (
    <div className="mx-auto mt-3 max-w-5xl px-2">
      <div
        className="overflow-hidden rounded-2xl border border-primary/30 bg-card/30 p-2 shadow-luxury backdrop-blur-md"
        style={{
          backgroundImage:
            "linear-gradient(135deg, color-mix(in oklab, var(--primary) 8%, transparent), color-mix(in oklab, var(--primary) 2%, transparent))",
        }}
      >
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
