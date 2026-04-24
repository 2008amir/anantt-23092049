import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

function todayDateString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function pingUserActivity(userId: string) {
  const nowIso = new Date().toISOString();
  // Update last-seen on profile (used elsewhere)
  await supabase.from("profiles").update({ updated_at: nowIso }).eq("id", userId);
  // Record this calendar day so historical day counts are preserved
  await supabase
    .from("user_activity_days")
    .upsert(
      { user_id: userId, activity_date: todayDateString(), last_seen: nowIso },
      { onConflict: "user_id,activity_date" },
    );
}

/**
 * Pings the user's activity whenever they navigate or interact, so the admin
 * "active users" metrics reflect real activity. Each calendar day is recorded
 * separately, so a user active yesterday AND today is counted on both days.
 */
export function useActivityHeartbeat() {
  const { user } = useStore();
  const { location } = useRouterState();
  const lastPingRef = useRef<number>(0);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    void pingActivity();
  }, [userId, location.pathname]);

  useEffect(() => {
    if (!userId) return;

    const handleActivity = () => {
      void pingActivity();
    };

    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity);

    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [userId]);

  async function pingActivity() {
    if (!userId) return;
    const now = Date.now();
    if (now - lastPingRef.current < 5_000) return;
    lastPingRef.current = now;
    await pingUserActivity(userId);
  }
}
