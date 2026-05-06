import { supabase } from "@/integrations/supabase/client";

export const REFERRAL_DOMAIN = "https://luxesparkles.codebreakers.uk";
export const REFERRAL_STORAGE_KEY = "ml_ref_code";

export type RewardTask = {
  id: string;
  title: string;
  description: string;
  image: string | null;
  task_type: "referral" | "purchase" | "legacy";
  referral_goal: number | null;
  expires_hours: number | null;
  reward_price: number | null;
  product_amount: number | null;
  require_purchase: boolean;
  purchase_percent: number | null;
  is_active: boolean;
  created_at: string;
};

export type Enrollment = {
  id: string;
  user_id: string;
  reward_id: string;
  referral_code: string;
  status: "active" | "completed" | "expired";
  started_at: string;
  expires_at: string | null;
  completed_at: string | null;
  claimed_product_id: string | null;
  claimed_order_id: string | null;
};

export type Referral = {
  id: string;
  enrollment_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  has_purchased: boolean;
  created_at: string;
};

export function generateReferralCode(): string {
  // Human-ish 8-char alphanumeric
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function referralLink(code: string): string {
  return `${REFERRAL_DOMAIN}/?ref=${encodeURIComponent(code)}`;
}

export async function fetchActiveTasks(): Promise<RewardTask[]> {
  const { data, error } = await supabase
    .from("rewards")
    .select("*")
    .in("task_type", ["referral", "purchase"])
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RewardTask[];
}

export async function fetchTaskProducts(rewardId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("reward_task_products")
    .select("product_id")
    .eq("reward_id", rewardId);
  if (error) throw error;
  return ((data ?? []) as { product_id: string }[]).map((r) => r.product_id);
}

export async function fetchEnrollments(userId: string): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from("reward_enrollments")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Enrollment[];
}

export async function fetchReferrals(userId: string): Promise<Referral[]> {
  const { data, error } = await supabase
    .from("referrals")
    .select("*")
    .eq("referrer_user_id", userId);
  if (error) throw error;
  return (data ?? []) as Referral[];
}

export async function enrollInTask(
  userId: string,
  reward: RewardTask,
): Promise<Enrollment> {
  const code = generateReferralCode();
  const expiresAt = reward.expires_hours
    ? new Date(Date.now() + reward.expires_hours * 3600 * 1000).toISOString()
    : null;
  const { data, error } = await supabase
    .from("reward_enrollments")
    .insert({
      user_id: userId,
      reward_id: reward.id,
      referral_code: code,
      expires_at: expiresAt,
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data as Enrollment;
}

// Progress bar curve per spec (capped at 99.1% until goal reached)
export function progressPercent(count: number, goal: number): number {
  if (goal <= 0) return 0;
  if (count >= goal) return 100;
  const table = [0, 50, 70, 80, 85, 89, 93, 95, 98, 99, 99.1];
  if (count < table.length) return table[count];
  return 99.1;
}

export function timeRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "No expiry";
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

export function isTaskCompleted(
  reward: RewardTask,
  referrals: Referral[],
): boolean {
  if (reward.task_type !== "referral") return false;
  const goal = reward.referral_goal ?? 0;
  if (referrals.length < goal) return false;
  if (reward.require_purchase) {
    const needed = Math.ceil((goal * (reward.purchase_percent ?? 100)) / 100);
    const purchased = referrals.filter((r) => r.has_purchased).length;
    return purchased >= needed;
  }
  return true;
}
