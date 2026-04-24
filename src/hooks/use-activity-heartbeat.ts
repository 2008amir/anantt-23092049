import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

export async function pingUserActivity(userId: string) {
  await supabase
    .from("profiles")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", userId);
}

/**
 * Pings the user's `profiles.updated_at` whenever they navigate or interact,
 * so the admin "active users" metrics reflect real activity.
 * Throttled to once every 60 seconds per session.
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
