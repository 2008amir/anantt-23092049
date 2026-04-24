import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Users, ShoppingBag, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Period = "daily" | "weekly" | "monthly" | "orders" | "revenue";

const PERIOD_META: Record<Period, { title: string; subtitle: string; icon: typeof Users; unitSingular: string; unitPlural: string; bucket: "day" | "week" | "month"; source: "activity" | "orders" | "revenue" }> = {
  daily:    { title: "Daily active users",   subtitle: "Unique users seen each day",        icon: Users,       unitSingular: "user",  unitPlural: "users",  bucket: "day",   source: "activity" },
  weekly:   { title: "Weekly active users",  subtitle: "Unique users seen each week",       icon: Users,       unitSingular: "user",  unitPlural: "users",  bucket: "week",  source: "activity" },
  monthly:  { title: "Monthly active users", subtitle: "Unique users seen each month",      icon: Users,       unitSingular: "user",  unitPlural: "users",  bucket: "month", source: "activity" },
  orders:   { title: "Verified orders",      subtitle: "Paid orders per week",              icon: ShoppingBag, unitSingular: "order", unitPlural: "orders", bucket: "week",  source: "orders" },
  revenue:  { title: "Revenue",              subtitle: "Paid order revenue per week",       icon: TrendingUp,  unitSingular: "₦",     unitPlural: "₦",      bucket: "week",  source: "revenue" },
};

export const Route = createFileRoute("/admin/active/$period")({
  component: ActivePeriodPage,
});

type Bucket = { key: string; label: string; sort: number; value: number };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfWeek(d: Date) {
  // Week starts Sunday
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function fmtDay(key: string) {
  return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function fmtWeek(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const same = start.getMonth() === end.getMonth();
  const s = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const e = end.toLocaleDateString(undefined, {
    month: same ? undefined : "short",
    day: "numeric",
    year: "numeric",
  });
  return `${s} – ${e}`;
}
function fmtMonth(y: number, m: number) {
  return new Date(y, m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function ActivePeriodPage() {
  const { period } = Route.useParams();
  const navigate = useNavigate();
  const meta = PERIOD_META[period as Period];
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meta) {
      void navigate({ to: "/admin" });
      return;
    }
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      let result: Bucket[] = [];

      if (meta.source === "activity") {
        const { data } = await supabase
          .from("user_activity_days")
          .select("user_id, activity_date")
          .order("activity_date", { ascending: false })
          .limit(10000);
        const rows = (data ?? []) as { user_id: string; activity_date: string }[];

        if (meta.bucket === "day") {
          const map = new Map<string, Set<string>>();
          rows.forEach((r) => {
            if (!map.has(r.activity_date)) map.set(r.activity_date, new Set());
            map.get(r.activity_date)!.add(r.user_id);
          });
          result = Array.from(map.entries()).map(([key, set]) => ({
            key,
            label: fmtDay(key),
            sort: new Date(`${key}T00:00:00`).getTime(),
            value: set.size,
          }));
        } else if (meta.bucket === "week") {
          const map = new Map<string, { start: Date; users: Set<string> }>();
          rows.forEach((r) => {
            const d = new Date(`${r.activity_date}T00:00:00`);
            const ws = startOfWeek(d);
            const key = dateKey(ws);
            if (!map.has(key)) map.set(key, { start: ws, users: new Set() });
            map.get(key)!.users.add(r.user_id);
          });
          result = Array.from(map.entries()).map(([key, v]) => ({
            key,
            label: fmtWeek(v.start),
            sort: v.start.getTime(),
            value: v.users.size,
          }));
        } else {
          const map = new Map<string, { y: number; m: number; users: Set<string> }>();
          rows.forEach((r) => {
            const d = new Date(`${r.activity_date}T00:00:00`);
            const y = d.getFullYear();
            const m = d.getMonth();
            const key = `${y}-${pad(m + 1)}`;
            if (!map.has(key)) map.set(key, { y, m, users: new Set() });
            map.get(key)!.users.add(r.user_id);
          });
          result = Array.from(map.entries()).map(([key, v]) => ({
            key,
            label: fmtMonth(v.y, v.m),
            sort: new Date(v.y, v.m, 1).getTime(),
            value: v.users.size,
          }));
        }
      } else {
        // orders / revenue – grouped per week
        const { data } = await supabase
          .from("orders")
          .select("id, total, payment_status, created_at")
          .eq("payment_status", "paid")
          .order("created_at", { ascending: false })
          .limit(10000);
        const rows = (data ?? []) as { id: string; total: number | string; created_at: string }[];
        const map = new Map<string, { start: Date; count: number; total: number }>();
        rows.forEach((r) => {
          const d = new Date(r.created_at);
          const ws = startOfWeek(d);
          const key = dateKey(ws);
          if (!map.has(key)) map.set(key, { start: ws, count: 0, total: 0 });
          const b = map.get(key)!;
          b.count += 1;
          b.total += Number(r.total ?? 0);
        });
        result = Array.from(map.entries()).map(([key, v]) => ({
          key,
          label: fmtWeek(v.start),
          sort: v.start.getTime(),
          value: meta.source === "orders" ? v.count : v.total,
        }));
      }

      // Most recent at top, earliest at bottom
      result.sort((a, b) => b.sort - a.sort);

      if (!cancelled) {
        setBuckets(result);
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [period, meta, navigate]);

  const max = useMemo(() => Math.max(1, ...buckets.map((b) => b.value)), [buckets]);
  const total = useMemo(() => buckets.reduce((s, b) => s + b.value, 0), [buckets]);

  if (!meta) return null;
  const Icon = meta.icon;

  const formatValue = (v: number) =>
    meta.source === "revenue" ? `₦${v.toLocaleString()}` : v.toLocaleString();

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Overview
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <Icon className="h-5 w-5 text-primary" />
          <h1 className="font-serif text-3xl text-foreground">{meta.title}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Periods recorded" value={loading ? "—" : buckets.length.toString()} />
        <SummaryCard
          label={meta.source === "revenue" ? "Total revenue" : `Total ${meta.unitPlural}`}
          value={loading ? "—" : formatValue(total)}
        />
        <SummaryCard
          label="Peak"
          value={loading ? "—" : formatValue(max)}
        />
      </div>

      <div className="rounded-lg border border-border/40 bg-card">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border/40 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:px-6">
          <span>Period</span>
          <span className="hidden sm:inline">Trend</span>
          <span className="text-right">{meta.source === "revenue" ? "Revenue" : "Count"}</span>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : buckets.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">No data yet.</div>
        ) : (
          <ul className="divide-y divide-border/40">
            {buckets.map((b, idx) => {
              const pct = (b.value / max) * 100;
              const ordinal = buckets.length - idx; // most recent has highest ordinal
              return (
                <li
                  key={b.key}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-3 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{b.label}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {meta.bucket === "day" ? "Day" : meta.bucket === "week" ? "Week" : "Month"} #{ordinal}
                    </p>
                  </div>
                  <div className="hidden sm:block w-40">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-gold-gradient"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-right font-serif text-base text-foreground tabular-nums">
                    {formatValue(b.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-serif text-2xl text-foreground">{value}</p>
    </div>
  );
}
