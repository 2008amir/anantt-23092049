import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/lib/store";

/**
 * Pings the user's `profiles.updated_at` whenever they navigate or interact,
 * so the admin "active users" metrics reflect real activity.
 * Throttled to once every 60 seconds per session.
 */
export function useActivityHeartbeat() {
  const { user } = useStore();
  const { location } = useRouterState();
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    const now = Date.now();
    if (now - lastPingRef.current < 60_000) return;
    lastPingRef.current = now;
    void supabase
      .from("profiles")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", user.id);
  }, [user, location.pathname]);
}
