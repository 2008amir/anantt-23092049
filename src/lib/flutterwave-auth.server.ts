import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function getFlutterwaveAuthContext(accessToken?: string) {
  if (!accessToken) throw new Error("Please sign in again.");

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Backend auth is not configured.");
  }

  const supabase = createClient<Database>(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  return {
    supabase,
    userId: data.claims.sub,
  };
}
