import { createFileRoute, Link } from "@tanstack/react-router";
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

type DailyBucket = { date: string; weekday: string; count: number };
type ActivityDayRow = { user_id: string; activity_date: string };

const chartConfig = {
  users: {
    label: "Users",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function OverviewPage() {
  const [stats, setStats] = useState({ total: 0, daily: 0, weekly: 0, monthly: 0, orders: 0, revenue: 0 });
  const [chart, setChart] = useState<DailyBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchOverview = async () => {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const todayStr = `${startOfToday.getFullYear()}-${String(startOfToday.getMonth() + 1).padStart(2, "0")}-${String(startOfToday.getDate()).padStart(2, "0")}`;
      const weekStart = new Date(startOfToday.getTime() - 6 * 24 * 3600 * 1000);
      const monthStart = new Date(startOfToday.getTime() - 29 * 24 * 3600 * 1000);
      const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
      const monthStartStr = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}-${String(monthStart.getDate()).padStart(2, "0")}`;
      const startOfWeekWindow = weekStart.toISOString();

      const [
        totalRes,
        ordersRes,
        weekActivityRes,
        monthActivityRes,
      ] = await Promise.all([
        // Total registered users
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id, total, payment_status").gte("created_at", startOfWeekWindow),
        // Per-day activity for the weekly chart + DAU/WAU
        supabase
          .from("user_activity_days")
          .select("user_id, activity_date")
          .gte("activity_date", weekStartStr),
        // For monthly active users
        supabase
          .from("user_activity_days")
          .select("user_id, activity_date")
          .gte("activity_date", monthStartStr),
      ]);

      if (cancelled) return;

      // Build 7 buckets from 6 days ago up to today, in calendar order
      const bucketSets: { date: string; weekday: string; users: Set<string> }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        bucketSets.push({
          date: dateKey,
          weekday: WEEKDAY_LABELS[d.getDay()],
          users: new Set(),
        });
      }

      const weekRows = (weekActivityRes.data ?? []) as ActivityDayRow[];
      const dailyUsers = new Set<string>();
      const weeklyUsers = new Set<string>();
      weekRows.forEach((row) => {
        const key = row.activity_date;
        const bucket = bucketSets.find((b) => b.date === key);
        if (bucket) bucket.users.add(row.user_id);
        weeklyUsers.add(row.user_id);
        if (key === todayStr) dailyUsers.add(row.user_id);
      });

      const monthlyUsers = new Set<string>();
      ((monthActivityRes.data ?? []) as ActivityDayRow[]).forEach((row) => {
        monthlyUsers.add(row.user_id);
      });

      const orders = (ordersRes.data ?? []) as { id: string; total: number | string; payment_status: string }[];
      const paidOrders = orders.filter((o) => o.payment_status === "paid");
      const revenue = paidOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);

      setStats({
        total: totalRes.count ?? 0,
        daily: dailyUsers.size,
        weekly: weeklyUsers.size,
        monthly: monthlyUsers.size,
        orders: paidOrders.length,
        revenue,
      });

      setChart(
        bucketSets.map((b) => ({
          date: b.date,
          weekday: b.weekday,
          count: b.users.size,
        })),
      );
      setLoading(false);
    };

    void fetchOverview();
    const interval = window.setInterval(() => {
      void fetchOverview();
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
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
          <h2 className="text-sm font-medium uppercase tracking-wider">Active users — last 7 days</h2>
        </div>

        <ChartContainer config={chartConfig} className="h-56 w-full aspect-auto">
          <BarChart data={chart} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="weekday"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              interval={0}
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
        <MetricCard label="Daily active" value={stats.daily} icon={Users} loading={loading} to="/admin/active/$period" period="daily" />
        <MetricCard label="Weekly active" value={stats.weekly} icon={Users} loading={loading} to="/admin/active/$period" period="weekly" />
        <MetricCard label="Monthly active" value={stats.monthly} icon={Users} loading={loading} to="/admin/active/$period" period="monthly" />
        <MetricCard label="Weekly verified orders" value={stats.orders} icon={ShoppingBag} loading={loading} to="/admin/active/$period" period="orders" />
        <MetricCard
          label="Weekly revenue"
          value={`₦${stats.revenue.toLocaleString()}`}
          icon={TrendingUp}
          loading={loading}
          to="/admin/active/$period"
          period="revenue"
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
  to,
  period,
}: {
  label: string;
  value: number | string;
  icon: typeof Users;
  loading: boolean;
  to?: string;
  period?: string;
}) {
  const inner = (
    <div className={`rounded-lg border border-border/40 bg-card p-6 ${to ? "transition-colors hover:border-primary/50" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 font-serif text-3xl text-foreground">{loading ? "—" : value}</p>
    </div>
  );
  if (to && period) {
    return (
      <Link to="/admin/active/$period" params={{ period }} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}
