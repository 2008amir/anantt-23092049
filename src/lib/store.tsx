import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product } from "./products";

type CartItem = { productId: string; quantity: number };
type Order = {
  id: string;
  date: string;
  items: { productId: string; quantity: number; price: number; name: string; image: string }[];
  total: number;
  status: "Processing" | "Shipped" | "Delivered";
  shipping: { name: string; address: string; city: string; zip: string; country: string };
};
type User = { email: string; name: string };

type StoreState = {
  cart: CartItem[];
  wishlist: string[];
  orders: Order[];
  user: User | null;
  addToCart: (productId: string, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  placeOrder: (order: Omit<Order, "id" | "date" | "status">) => Order;
  login: (email: string, name?: string) => void;
  logout: () => void;
};

const StoreContext = createContext<StoreState | null>(null);

const KEY = "lux_store_v1";

function load() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const data = load();
    if (data) {
      setCart(data.cart ?? []);
      setWishlist(data.wishlist ?? []);
      setOrders(data.orders ?? []);
      setUser(data.user ?? null);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify({ cart, wishlist, orders, user }));
  }, [cart, wishlist, orders, user, hydrated]);

  const addToCart = (productId: string, quantity = 1) => {
    if (!user) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity + quantity } : i,
        );
      }
      return [...prev, { productId, quantity }];
    });
  };

  const removeFromCart = (productId: string) =>
    setCart((prev) => prev.filter((i) => i.productId !== productId));

  const updateCartQty = (productId: string, quantity: number) => {
    if (quantity <= 0) return removeFromCart(productId);
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  };

  const clearCart = () => setCart([]);

  const toggleWishlist = (productId: string) =>
    setWishlist((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId],
    );

  const placeOrder: StoreState["placeOrder"] = (order) => {
    const newOrder: Order = {
      ...order,
      id: `ORD-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString(),
      status: "Processing",
    };
    setOrders((prev) => [newOrder, ...prev]);
    setCart([]);
    return newOrder;
  };

  const login = (email: string, name?: string) =>
    setUser({ email, name: name ?? email.split("@")[0] });
  const logout = () => setUser(null);

  return (
    <StoreContext.Provider
      value={{
        cart,
        wishlist,
        orders,
        user,
        addToCart,
        removeFromCart,
        updateCartQty,
        clearCart,
        toggleWishlist,
        placeOrder,
        login,
        logout,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
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
      const p = products.find((p) => p.id === c.productId);
      return p ? { product: p, quantity: c.quantity } : null;
    })
    .filter(Boolean) as { product: Product; quantity: number }[];
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  const shipping = subtotal > 1000 || subtotal === 0 ? 0 : 35;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;
  return { items, subtotal, shipping, tax, total };
}
