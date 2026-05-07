import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether the current user has a deliverer role.
 */
export function useIsDeliverer() {
  const { user, loading } = useStore();
  const [isDeliverer, setIsDeliverer] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setIsDeliverer(false);
      setChecking(false);
      return;
    }

    (async () => {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "deliverer")
        .maybeSingle();

      if (cancelled) return;

      setIsDeliverer(!!roleRow);
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isDeliverer, checking: checking || loading };
}
