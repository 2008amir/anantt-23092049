import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, ShoppingBag, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/")({
  component: OverviewPage,
});

type DailyBucket = { date: string; count: number };

function OverviewPage() {
  const [stats, setStats] = useState({ daily: 0, weekly: 0, monthly: 0, orders: 0, revenue: 0 });
  const [chart, setChart] = useState<DailyBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

      const [dailyRes, weeklyRes, monthlyRes, ordersRes, profilesRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", monthAgo),
        supabase.from("orders").select("id, total, created_at").gte("created_at", weekAgo),
        supabase.from("profiles").select("created_at").gte("created_at", weekAgo),
      ]);

      if (cancelled) return;

      // Bucket by day for last 7 days
      const buckets: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
        buckets[d.toISOString().slice(0, 10)] = 0;
      }
      (profilesRes.data ?? []).forEach((row: { created_at: string }) => {
        const key = row.created_at.slice(0, 10);
        if (key in buckets) buckets[key]++;
      });

      const orders = ordersRes.data ?? [];
      const revenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);

      setStats({
        daily: dailyRes.count ?? 0,
        weekly: weeklyRes.count ?? 0,
        monthly: monthlyRes.count ?? 0,
        orders: orders.length,
        revenue,
      });
      // Sort: most active day first → least
      const sorted = Object.entries(buckets)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.count - a.count);
      setChart(sorted);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxCount = Math.max(1, ...chart.map((b) => b.count));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Activity at a glance.</p>
      </div>

      {/* 7-day bar chart */}
      <div className="rounded-lg border border-border/40 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium uppercase tracking-wider">New users — last 7 days</h2>
        </div>
        <div className="flex h-48 items-end gap-2">
          {chart.map((b) => (
            <div key={b.date} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-gold-gradient transition-all"
                  style={{ height: `${(b.count / maxCount) * 100}%`, minHeight: "2px" }}
                  title={`${b.count} users`}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(b.date).toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="text-xs font-medium">{b.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Daily users" value={stats.daily} icon={Users} loading={loading} />
        <MetricCard label="Weekly users" value={stats.weekly} icon={Users} loading={loading} />
        <MetricCard label="Monthly users" value={stats.monthly} icon={Users} loading={loading} />
        <MetricCard label="Weekly orders" value={stats.orders} icon={ShoppingBag} loading={loading} />
        <MetricCard
          label="Weekly revenue"
          value={`₦${stats.revenue.toLocaleString()}`}
          icon={TrendingUp}
          loading={loading}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 font-serif text-3xl text-foreground">{loading ? "—" : value}</p>
    </div>
  );
}
