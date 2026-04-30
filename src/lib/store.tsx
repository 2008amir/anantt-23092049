import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User as AuthUser } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchProductsByIds, type Product } from "./products";
import { enqueueMutation, flushQueue, setupQueueAutoFlush } from "./offline-cache";

export type Profile = { id: string; email: string | null; display_name: string | null };

export type Address = {
  id: string;
  user_id: string;
  country: string;
  first_name: string;
  last_name: string;
  phone: string;
  address_line: string;
  state: string;
  city: string;
  is_default: boolean;
};

export type Order = {
  id: string;
  total: number;
  subtotal: number;
  shipping: number;
  tax: number;
  status: string;
  shipping_address: Address;
  created_at: string;
  items: {
    product_id: string;
    product_name: string;
    product_image: string;
    price: number;
    quantity: number;
  }[];
};

export type CartVariant = { color?: string; size?: string } | null;
type CartRow = { product_id: string; quantity: number; variant?: CartVariant };

type StoreState = {
  loading: boolean;
  user: AuthUser | null;
  profile: Profile | null;
  cart: CartRow[];
  wishlist: string[];
  // mutations
  addToCart: (productId: string, quantity?: number, variant?: CartVariant) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateCartQty: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    extra?: {
      displayName?: string;
      firstName?: string;
      lastName?: string;
      country?: string;
      referralCode?: string;
    },
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cart, setCart] = useState<CartRow[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;

  const loadUserData = useCallback(async (uid: string) => {
    const [profileRes, cartRes, wlRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("cart_items").select("product_id, quantity, variant").eq("user_id", uid),
      supabase.from("wishlist").select("product_id").eq("user_id", uid),
    ]);
    setProfile((profileRes.data as Profile | null) ?? null);
    setCart((cartRes.data ?? []) as CartRow[]);
    setWishlist(((wlRes.data ?? []) as { product_id: string }[]).map((r) => r.product_id));
  }, []);

  // Auth bootstrap + offline queue auto-flush
  useEffect(() => {
    setupQueueAutoFlush();
    void flushQueue();
    let mounted = true;
    // First, set up the listener (do not await async in callback).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        // defer to avoid deadlocks
        setTimeout(() => {
          void loadUserData(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setCart([]);
        setWishlist([]);
      }
    });

    // Then fetch existing session
    void supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!mounted) return;
      setSession(existing);
      if (existing?.user) {
        void loadUserData(existing.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const refresh = useCallback(async () => {
    if (user) await loadUserData(user.id);
  }, [user, loadUserData]);

  const requireAuth = useCallback(() => {
    if (!user) {
      if (typeof window !== "undefined") window.location.href = "/login";
      return false;
    }
    return true;
  }, [user]);

  const isOffline = () => typeof navigator !== "undefined" && !navigator.onLine;

  const addToCart = useCallback(
    async (productId: string, quantity = 1, variant: CartVariant = null) => {
      if (!requireAuth() || !user) return;
      const existing = cart.find((c) => c.product_id === productId);
      const nextQty = (existing?.quantity ?? 0) + quantity;
      const nextVariant = variant ?? existing?.variant ?? null;
      // optimistic
      setCart((prev) => {
        const found = prev.find((c) => c.product_id === productId);
        if (found)
          return prev.map((c) =>
            c.product_id === productId ? { ...c, quantity: nextQty, variant: nextVariant } : c,
          );
        return [...prev, { product_id: productId, quantity, variant: nextVariant }];
      });
      if (isOffline()) {
        enqueueMutation({
          kind: "cart_upsert",
          user_id: user.id,
          product_id: productId,
          quantity: nextQty,
          variant: nextVariant,
        });
        return;
      }
      const { error } = await supabase
        .from("cart_items")
        .upsert(
          {
            user_id: user.id,
            product_id: productId,
            quantity: nextQty,
            variant: nextVariant,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,product_id" },
        );
      if (error) {
        // Network failure → queue for replay
        enqueueMutation({
          kind: "cart_upsert",
          user_id: user.id,
          product_id: productId,
          quantity: nextQty,
          variant: nextVariant,
        });
      }
    },
    [user, cart, requireAuth],
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      if (!user) return;
      setCart((prev) => prev.filter((c) => c.product_id !== productId));
      if (isOffline()) {
        enqueueMutation({ kind: "cart_delete", user_id: user.id, product_id: productId });
        return;
      }
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);
      if (error) {
        enqueueMutation({ kind: "cart_delete", user_id: user.id, product_id: productId });
      }
    },
    [user],
  );

  const updateCartQty = useCallback(
    async (productId: string, quantity: number) => {
      if (!user) return;
      if (quantity <= 0) return removeFromCart(productId);
      const row = cart.find((c) => c.product_id === productId);
      const variant = row?.variant ?? null;
      setCart((prev) => prev.map((c) => (c.product_id === productId ? { ...c, quantity } : c)));
      if (isOffline()) {
        enqueueMutation({
          kind: "cart_upsert",
          user_id: user.id,
          product_id: productId,
          quantity,
          variant,
        });
        return;
      }
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity, updated_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("product_id", productId);
      if (error) {
        enqueueMutation({
          kind: "cart_upsert",
          user_id: user.id,
          product_id: productId,
          quantity,
          variant,
        });
      }
    },
    [user, cart, removeFromCart],
  );

  const clearCart = useCallback(async () => {
    if (!user) return;
    setCart([]);
    if (isOffline()) return;
    const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);
    if (error) console.error(error);
  }, [user]);

  const toggleWishlist = useCallback(
    async (productId: string) => {
      if (!requireAuth() || !user) return;
      const liked = wishlist.includes(productId);
      setWishlist((prev) => (liked ? prev.filter((id) => id !== productId) : [...prev, productId]));
      if (isOffline()) {
        enqueueMutation({
          kind: liked ? "wishlist_delete" : "wishlist_add",
          user_id: user.id,
          product_id: productId,
        });
        return;
      }
      if (liked) {
        const { error } = await supabase
          .from("wishlist")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);
        if (error) {
          enqueueMutation({ kind: "wishlist_delete", user_id: user.id, product_id: productId });
        }
      } else {
        const { error } = await supabase
          .from("wishlist")
          .insert({ user_id: user.id, product_id: productId });
        if (error) {
          enqueueMutation({ kind: "wishlist_add", user_id: user.id, product_id: productId });
        }
      }
    },
    [user, wishlist, requireAuth],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    // 1. Validate password first (without leaving a session if device is new).
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // 2. Check whether this device is already trusted for this account.
    try {
      const { collectDeviceSignals } = await import("./device-fingerprint");
      const device = await collectDeviceSignals();
      const { checkDeviceTrust, sendDeviceVerificationLink, markCurrentDeviceTrusted } =
        await import("./device-trust.functions");

      const result = await checkDeviceTrust({
        data: { email, fingerprint: device.fingerprint },
      });

      if (result.trusted) {
        // Refresh last_seen and ensure this browser stays recorded.
        const { data: who } = await supabase.auth.getUser();
        if (who.user?.id) {
          await markCurrentDeviceTrusted({
            data: { userId: who.user.id, fingerprint: device.fingerprint },
          });
        }
        return;
      }

      // Untrusted device: sign out, email a verification link, surface error.
      await supabase.auth.signOut();
      await sendDeviceVerificationLink({ data: { email } });
      throw new Error(
        "New device detected. We've emailed you a verification link — open it on this device to finish signing in.",
      );
    } catch (err) {
      // Re-throw our own message; swallow trust-check infra errors and allow login.
      if (err instanceof Error && err.message.startsWith("New device detected")) throw err;
      console.error("Device trust check failed (allowing sign-in):", err);
    }
  }, []);

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      extra?: {
        displayName?: string;
        firstName?: string;
        lastName?: string;
        country?: string;
        referralCode?: string;
      },
    ) => {
      const redirectUrl =
        typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

      // Referral code: prefer form input, fall back to captured ?ref=
      let ref: string | null = extra?.referralCode?.trim() || null;
      if (!ref && typeof window !== "undefined") {
        try {
          ref = localStorage.getItem("ml_ref_code");
        } catch {
          // ignore
        }
      }

      // Device fingerprint — collect before signup so trigger can dedupe
      const { collectDeviceSignals } = await import("./device-fingerprint");
      const device = await collectDeviceSignals();

      const meta: Record<string, string> = {};
      if (extra?.displayName) meta.display_name = extra.displayName;
      if (extra?.firstName) meta.first_name = extra.firstName;
      if (extra?.lastName) meta.last_name = extra.lastName;
      if (extra?.country) meta.country = extra.country;
      if (ref) meta.ref = ref;
      meta.device_fp = device.fingerprint;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: meta,
        },
      });
      if (error) throw error;

      // Register device fingerprint (best-effort). RLS allows owner insert.
      if (data.user?.id) {
        try {
          await (supabase.from("referral_devices") as unknown as {
            insert: (row: Record<string, unknown>) => Promise<unknown>;
          }).insert({
            fingerprint: device.fingerprint,
            user_id: data.user.id,
            ip: device.ip,
            user_agent: device.user_agent,
            platform: device.platform,
            hardware: device.hardware,
          });
        } catch {
          // duplicate fingerprint is expected on repeat signups — ignore
        }
      }

      // Clear captured referral code after successful signup attempt
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("ml_ref_code");
        } catch {
          // ignore
        }
      }

      // Send our branded Brevo verification email (Supabase default email is disabled)
      try {
        const { sendDeviceVerificationLink } = await import("./device-trust.functions");
        await sendDeviceVerificationLink({ data: { email } });
      } catch (e) {
        console.error("verification email send failed", e);
      }

      // Do NOT auto-login — user must confirm via the email link first.
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<StoreState>(
    () => ({
      loading,
      user,
      profile,
      cart,
      wishlist,
      addToCart,
      removeFromCart,
      updateCartQty,
      clearCart,
      toggleWishlist,
      signIn,
      signUp,
      signOut,
      refresh,
    }),
    [
      loading,
      user,
      profile,
      cart,
      wishlist,
      addToCart,
      removeFromCart,
      updateCartQty,
      clearCart,
      toggleWishlist,
      signIn,
      signUp,
      signOut,
      refresh,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useCartTotal(products: Product[]) {
  const { cart } = useStore();
  const items = cart
    .map((c) => {
      const p = products.find((p) => p.id === c.product_id);
      return p ? { product: p, quantity: c.quantity, variant: c.variant ?? null } : null;
    })
    .filter(Boolean) as { product: Product; quantity: number; variant: CartVariant }[];
  const subtotal = items.reduce((sum, i) => {
    const unit = i.product.discountPrice && i.product.discountPrice > 0 && i.product.discountPrice < i.product.price
      ? i.product.discountPrice
      : i.product.price;
    return sum + unit * i.quantity;
  }, 0);
  const shipping = subtotal > 1000 || subtotal === 0 ? 0 : 35;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;
  return { items, subtotal, shipping, tax, total };
}

// Hook to subscribe to all products (lightweight cache)
export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    import("./products").then(({ fetchProducts }) =>
      fetchProducts()
        .then((p) => {
          if (!cancelled) setProducts(p);
        })
        .catch((e) => console.error(e))
        .finally(() => {
          if (!cancelled) setLoading(false);
        }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading };
}

export function useProductsByIds(ids: string[]) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const key = ids.join(",");

  useEffect(() => {
    let cancelled = false;
    if (ids.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchProductsByIds(ids)
      .then((p) => {
        if (!cancelled) setProducts(p);
      })
      .catch((e) => console.error(e))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { products, loading };
}
