import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAIL = "fatimamustaphaabdu@gmail.com";

/**
 * Returns whether the current user is the admin.
 * Auto-grants the admin role to ADMIN_EMAIL on first sign-in.
 */
export function useIsAdmin() {
  const { user, loading } = useStore();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }

    (async () => {
      // Check if role exists
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (cancelled) return;

      if (roleRow) {
        setIsAdmin(true);
        setChecking(false);
        return;
      }

      // If this is the designated admin email, self-grant
      if (user.email?.toLowerCase() === ADMIN_EMAIL) {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role: "admin" });
        if (!cancelled) {
          setIsAdmin(!error);
          setChecking(false);
        }
        return;
      }

      setIsAdmin(false);
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { isAdmin, checking: checking || loading };
}

export { ADMIN_EMAIL };
