import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Users, ShoppingBag, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export const Route = createFileRoute("/admin/")({
  component: OverviewPage,
});

type DailyBucket = { date: string; count: number };
type ActivityRow = { user_id: string; created_at: string };
type ProfileActivityRow = { id: string; created_at: string };

const chartConfig = {
  users: {
    label: "Users",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

function OverviewPage() {
  const [stats, setStats] = useState({ total: 0, daily: 0, weekly: 0, monthly: 0, orders: 0, revenue: 0 });
  const [chart, setChart] = useState<DailyBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

      const [
        totalRes,
        dailyRes,
        weeklyRes,
        monthlyRes,
        ordersRes,
        profilesRes,
        searchHistoryRes,
        interestsRes,
        wishlistRes,
        messagesRes,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", monthAgo),
        supabase.from("orders").select("id, total, payment_status").gte("created_at", weekAgo),
        supabase.from("profiles").select("id, created_at").gte("created_at", weekAgo),
        supabase.from("search_history").select("user_id, created_at").gte("created_at", weekAgo),
        supabase.from("user_interests").select("user_id, created_at").gte("created_at", weekAgo),
        supabase.from("wishlist").select("user_id, created_at").gte("created_at", weekAgo),
        supabase.from("messages").select("user_id, created_at").gte("created_at", weekAgo),
      ]);

      if (cancelled) return;

      const bucketSets: Record<string, Set<string>> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
        bucketSets[d.toISOString().slice(0, 10)] = new Set();
      }

      const addActivity = (userId: string | null | undefined, createdAt: string | null | undefined) => {
        if (!userId || !createdAt) return;
        const key = createdAt.slice(0, 10);
        if (key in bucketSets) bucketSets[key].add(userId);
      };

      ((profilesRes.data ?? []) as ProfileActivityRow[]).forEach((row) => addActivity(row.id, row.created_at));
      [searchHistoryRes.data, interestsRes.data, wishlistRes.data, messagesRes.data].forEach((rows) => {
        ((rows ?? []) as ActivityRow[]).forEach((row) => addActivity(row.user_id, row.created_at));
      });

      const orders = (ordersRes.data ?? []) as { id: string; total: number | string; payment_status: string }[];
      const paidOrders = orders.filter((o) => o.payment_status === "paid");
      const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);

      setStats({
        total: totalRes.count ?? 0,
        daily: dailyRes.count ?? 0,
        weekly: weeklyRes.count ?? 0,
        monthly: monthlyRes.count ?? 0,
        orders: paidOrders.length,
        revenue,
      });

      const rankedBuckets = Object.entries(bucketSets)
        .map(([date, users]) => ({ date, count: users.size }))
        .sort((a, b) => b.count - a.count || a.date.localeCompare(b.date));

      setChart(rankedBuckets);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const maxCount = useMemo(() => Math.max(1, ...chart.map((bucket) => bucket.count)), [chart]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Activity at a glance.</p>
      </div>

      <div className="rounded-lg border border-border/40 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium uppercase tracking-wider">Unique users — last 7 days</h2>
        </div>

        <ChartContainer config={chartConfig} className="h-56 w-full aspect-auto">
          <BarChart data={chart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              minTickGap={12}
              tickFormatter={(value: string) =>
                new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { weekday: "short" })
              }
            />
            <YAxis hide allowDecimals={false} domain={[0, maxCount]} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const raw = payload?.[0]?.payload?.date;
                    return raw
                      ? new Date(`${raw}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "";
                  }}
                  formatter={(value) => <span>{value} users</span>}
                />
              }
            />
            <Bar dataKey="count" fill="var(--color-users)" radius={[6, 6, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ChartContainer>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Total users" value={stats.total} icon={Users} loading={loading} />
        <MetricCard label="Daily users" value={stats.daily} icon={Users} loading={loading} />
        <MetricCard label="Weekly users" value={stats.weekly} icon={Users} loading={loading} />
        <MetricCard label="Monthly users" value={stats.monthly} icon={Users} loading={loading} />
        <MetricCard label="Weekly verified orders" value={stats.orders} icon={ShoppingBag} loading={loading} />
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
