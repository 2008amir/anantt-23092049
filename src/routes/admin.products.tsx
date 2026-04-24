import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, RefreshCw, Plus, Image as ImageIcon, Loader2, Sparkles, X, ChevronDown, Check, Search } from "lucide-react";
import { generateProductReviews } from "@/lib/admin-ai.functions";
import { ALL_COUNTRIES } from "@/lib/countries";

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
});

type Review = { id: string; author: string; rating: number; date: string; title: string; body: string };

type ProductRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: number;
  discount_price: number | null;
  delivery_price: number;
  image: string;
  images: string[];
  stock: number;
  rating: number;
  review_count: number;
  reviews: Review[];
  colors: string[];
  sizes: string[];
  is_active: boolean;
};

type Tab = "current" | "finished" | "add";

function ProductsPage() {
  const [tab, setTab] = useState<Tab>("current");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    const rows = ((data ?? []) as unknown as ProductRow[]).map((p) => ({
      ...p,
      images: Array.isArray(p.images) ? p.images : [],
      colors: Array.isArray(p.colors) ? p.colors : [],
      sizes: Array.isArray(p.sizes) ? p.sizes : [],
      reviews: Array.isArray(p.reviews) ? p.reviews : [],
    }));
    setProducts(rows);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const current = products.filter((p) => p.stock > 0 && p.is_active);
  const finished = products.filter((p) => p.stock <= 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">{products.length} total.</p>
      </div>

      <div className="flex gap-2 border-b border-border/40">
        {(["current", "finished", "add"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm capitalize transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "current" && `Current (${current.length})`}
            {t === "finished" && `Finished (${finished.length})`}
            {t === "add" && "Add product"}
          </button>
        ))}
      </div>

      {loading && tab !== "add" ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tab === "current" ? (
        <CurrentList products={current} onChange={reload} />
      ) : tab === "finished" ? (
        <FinishedList products={finished} onChange={reload} />
      ) : (
        <AddProductForm onCreated={() => { void reload(); setTab("current"); }} />
      )}
    </div>
  );
}

// ───────────── Current ─────────────
function CurrentList({ products, onChange }: { products: ProductRow[]; onChange: () => void }) {
  const [editing, setEditing] = useState<ProductRow | null>(null);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this product? It will be removed from the shop.")) return;
    // Try a hard delete first.
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      // Foreign-key violations (e.g. existing order_items) — fall back to a
      // soft delete so the product disappears from the shop & admin lists.
      const isFk = error.code === "23503" || /foreign key/i.test(error.message);
      if (isFk) {
        const { error: softErr } = await supabase
          .from("products")
          .update({ is_active: false, stock: 0 })
          .eq("id", id);
        if (softErr) {
          alert(`Could not delete product: ${softErr.message}`);
          return;
        }
      } else {
        alert(`Could not delete product: ${error.message}`);
        return;
      }
    }
    onChange();
  };

  if (products.length === 0) {
    return <Empty hint="No products in stock." />;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-lg border border-border/40 bg-card">
            <div className="aspect-square overflow-hidden bg-muted">
              {p.image ? (
                <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="line-clamp-1 font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.brand}</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="flex items-baseline gap-1.5">
                  {p.discount_price && Number(p.discount_price) > 0 && Number(p.discount_price) < Number(p.price) ? (
                    <>
                      <span className="font-serif text-base">₦{Number(p.discount_price).toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground line-through">₦{Number(p.price).toLocaleString()}</span>
                    </>
                  ) : (
                    <span className="font-serif text-base">₦{Number(p.price).toLocaleString()}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">Stock: {p.stock}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setEditing(p)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border/40 px-2 py-1.5 text-xs hover:border-primary"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => void remove(p.id)}
                  className="flex items-center justify-center gap-1 rounded-md border border-destructive/40 px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {editing && (
        <EditModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </>
  );
}

function EditModal({
  product,
  onClose,
  onSaved,
}: {
  product: ProductRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [price, setPrice] = useState(String(product.price));
  const [discount, setDiscount] = useState(product.discount_price?.toString() ?? "");
  const [stock, setStock] = useState(String(product.stock));
  const [images, setImages] = useState<string[]>(product.images?.length ? product.images : product.image ? [product.image] : []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (images.length + files.length > 20) {
      alert("Max 20 images per product");
      return;
    }
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${product.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (!error) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
    }
    setImages((prev) => [...prev, ...urls]);
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    await supabase
      .from("products")
      .update({
        price: Number(price) || 0,
        discount_price: discount ? Number(discount) : null,
        stock: Number(stock) || 0,
        images: images,
        image: images[0] ?? product.image,
      })
      .eq("id", product.id);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border/40 bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Edit {product.name}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Old price ₦ (strike-through)" value={price} onChange={setPrice} />
          <NumberField label="Discount price ₦ (what customer pays)" value={discount} onChange={setDiscount} />
          <NumberField label="Stock" value={stock} onChange={setStock} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Leave discount empty to sell at the regular price. Savings shown to shoppers = old − discount.
        </p>

        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Images ({images.length}/20)</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {images.map((url, i) => (
              <div key={url + i} className="group relative aspect-square overflow-hidden rounded border border-border/40">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute right-1 top-1 rounded-full bg-destructive/90 p-0.5 text-white opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {images.length < 20 && (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-border/40 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void upload(e.target.files)}
                />
              </label>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border/40 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────── Finished ─────────────
function FinishedList({ products, onChange }: { products: ProductRow[]; onChange: () => void }) {
  const [renewing, setRenewing] = useState<string | null>(null);
  const [qty, setQty] = useState("");

  const renew = async (id: string) => {
    const n = Number(qty);
    if (!Number.isFinite(n) || n <= 0) return;
    await supabase.from("products").update({ stock: n }).eq("id", id);
    setRenewing(null);
    setQty("");
    onChange();
  };

  if (products.length === 0) return <Empty hint="No finished products." />;

  return (
    <div className="space-y-2">
      {products.map((p) => (
        <div key={p.id} className="flex items-center gap-4 rounded-lg border border-border/40 bg-card p-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-muted">
            {p.image && <img src={p.image} alt={p.name} className="h-full w-full object-cover" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.brand} · ₦{Number(p.price).toLocaleString()}</p>
          </div>
          {renewing === p.id ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Qty"
                className="w-24 rounded-md border border-border/40 bg-background px-2 py-1.5 text-sm"
                autoFocus
              />
              <button
                onClick={() => void renew(p.id)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:opacity-90"
              >
                Confirm
              </button>
              <button
                onClick={() => { setRenewing(null); setQty(""); }}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRenewing(p.id)}
              className="inline-flex items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
            >
              <RefreshCw className="h-3 w-3" /> Renew
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ───────────── Add product ─────────────
function AddProductForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [stock, setStock] = useState("");
  const [rating, setRating] = useState("0");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const [hasColor, setHasColor] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [colorDraft, setColorDraft] = useState("");

  const [hasSize, setHasSize] = useState(false);
  const [sizes, setSizes] = useState<string[]>([]);
  const [sizeDraft, setSizeDraft] = useState("");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiCountries, setAiCountries] = useState<string[]>([]);
  const [aiMessages, setAiMessages] = useState("4");
  const [aiLoading, setAiLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (images.length + files.length > 20) {
      alert("Max 20 images per product");
      return;
    }
    setUploading(true);
    const tempId = `staging-${Date.now()}`;
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${tempId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: e } = await supabase.storage.from("product-images").upload(path, file);
      if (!e) {
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setImages((p) => [...p, ...urls]);
    setUploading(false);
  };

  const generateReviews = async () => {
    if (!name) {
      alert("Enter the product name first");
      return;
    }
    if (aiCountries.length === 0) {
      alert("Pick at least one country");
      return;
    }
    setAiLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        alert("Please sign in again.");
        return;
      }

      const res = await generateProductReviews({
        data: {
          productName: name,
          productDescription: description,
          countries: aiCountries.slice(0, 60),
          messages: Math.max(1, Math.min(50, Number(aiMessages) || 1)),
          accessToken,
        },
      });
      if (res?.error) {
        alert(res.error);
      } else {
        setReviews(Array.isArray(res?.reviews) ? res.reviews : []);
        if (res?.rating && res.rating > 0) setRating(String(res.rating));
        setAiOpen(false);
      }
    } catch (e) {
      let msg = "Failed to generate reviews";
      if (e instanceof Response) {
        try { msg = (await e.text()) || msg; } catch { /* ignore */ }
      } else if (e instanceof Error) {
        msg = e.message;
      }
      alert(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!name || !brand || !category || !price) {
      setError("Name, brand, category and price are required.");
      return;
    }
    setSaving(true);
    const id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
    const { error: e } = await supabase.from("products").insert({
      id,
      name,
      brand,
      category,
      description,
      price: Number(price) || 0,
      discount_price: discount ? Number(discount) : null,
      stock: Number(stock) || 0,
      rating: Number(rating) || 0,
      review_count: reviews.length,
      reviews,
      image: images[0] ?? "",
      images,
      colors: hasColor ? colors : [],
      sizes: hasSize ? sizes : [],
      details: [],
      is_active: true,
    });
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    onCreated();
  };

  return (
    <div className="rounded-lg border border-border/40 bg-card p-6">
      <h2 className="font-serif text-2xl">Add product</h2>

      {/* Images */}
      <div className="mt-6">
        <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Images ({images.length}/20)</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {images.map((url, i) => (
            <div key={url + i} className="group relative aspect-square overflow-hidden rounded border border-border/40">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                className="absolute right-1 top-1 rounded-full bg-destructive/90 p-0.5 text-white opacity-0 group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {images.length < 20 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded border border-dashed border-border/40 text-xs text-muted-foreground hover:border-primary hover:text-primary">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>Upload</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void upload(e.target.files)}
              />
            </label>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <TextField label="Name *" value={name} onChange={setName} />
        <TextField label="Brand *" value={brand} onChange={setBrand} />
        <TextField label="Category *" value={category} onChange={setCategory} />
        <NumberField label="Stock quantity *" value={stock} onChange={setStock} />
        <NumberField label="Old price ₦ (strike-through) *" value={price} onChange={setPrice} />
        <NumberField label="Discount price ₦ (what customer pays)" value={discount} onChange={setDiscount} />
        <NumberField label="Rating (0–5)" value={rating} onChange={setRating} />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Leave the discount blank to sell at the regular price. When set, shoppers see the discount as the live price, the old price with a line through it, and a “Save ₦X” badge. Delivery is set per LGA in <span className="text-primary">Delivery Prices</span>.
      </p>

      <div className="mt-4">
        <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Description</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {/* Variants */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <VariantBlock
          label="Color variants"
          enabled={hasColor}
          onToggle={setHasColor}
          values={colors}
          onAdd={(v) => setColors((c) => [...c, v])}
          onRemove={(i) => setColors((c) => c.filter((_, idx) => idx !== i))}
          draft={colorDraft}
          setDraft={setColorDraft}
          placeholder="e.g. Gold"
        />
        <VariantBlock
          label="Size variants"
          enabled={hasSize}
          onToggle={setHasSize}
          values={sizes}
          onAdd={(v) => setSizes((c) => [...c, v])}
          onRemove={(i) => setSizes((c) => c.filter((_, idx) => idx !== i))}
          draft={sizeDraft}
          setDraft={setSizeDraft}
          placeholder="e.g. M"
        />
      </div>

      {/* Reviews */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Reviews ({reviews.length})</p>
          <button
            onClick={() => setAiOpen((o) => !o)}
            className="inline-flex items-center gap-1 rounded-md border border-primary px-3 py-1.5 text-xs text-primary hover:bg-primary/10"
          >
            <Sparkles className="h-3 w-3" /> AI
          </button>
        </div>
        {aiOpen && (
          <div className="mt-2 grid gap-3 rounded-md border border-border/40 bg-muted/30 p-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <CountryMultiSelect value={aiCountries} onChange={setAiCountries} />
            </div>
            <NumberField label="Messages per country" value={aiMessages} onChange={setAiMessages} />
            <div className="flex items-end sm:col-span-3">
              <button
                onClick={() => void generateReviews()}
                disabled={aiLoading}
                className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Generate {aiCountries.length > 0 ? `${aiCountries.length * (Number(aiMessages) || 0)} reviews` : ""}
              </button>
            </div>
          </div>
        )}
        {reviews.length > 0 && (
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-md border border-border/40 bg-muted/30 p-3">
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} className="text-xs">
                <p className="font-medium">{r.author} · {r.rating}★ · <span className="text-muted-foreground">{r.title}</span></p>
                <p className="text-muted-foreground">{r.body}</p>
              </div>
            ))}
            {reviews.length > 6 && <p className="text-[10px] text-muted-foreground">+ {reviews.length - 6} more</p>}
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => void submit()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-gold-gradient px-6 py-2.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create product
        </button>
      </div>
    </div>
  );
}

function VariantBlock({
  label,
  enabled,
  onToggle,
  values,
  onAdd,
  onRemove,
  draft,
  setDraft,
  placeholder,
}: {
  label: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  values: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  draft: string;
  setDraft: (v: string) => void;
  placeholder: string;
}) {
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  };
  return (
    <div className="rounded-md border border-border/40 p-3">
      <label className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-muted",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
              enabled ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </button>
      </label>
      {enabled && (
        <div className="mt-3">
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
              placeholder={placeholder}
              className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={add}
              className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground"
            >
              Add
            </button>
          </div>
          {values.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {values.map((v, i) => (
                <span key={v + i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {v}
                  <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────── shared ─────────────
function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-border/40 bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
    </label>
  );
}

function Empty({ hint }: { hint: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/40 bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function CountryMultiSelect({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_COUNTRIES;
    return ALL_COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  const selected = new Set(value);
  const toggle = (c: string) => {
    const next = new Set(selected);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    onChange(Array.from(next));
  };

  return (
    <div ref={containerRef} className="relative">
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Countries</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-1.5 flex w-full items-center justify-between rounded-md border border-border/40 bg-background px-3 py-2 text-left text-sm focus:border-primary focus:outline-none"
      >
        <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
          {value.length === 0 ? "Pick countries…" : value.length === 1 ? value[0] : `${value.length} countries selected`}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {value.slice(0, 8).map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              {c}
              <button type="button" onClick={() => toggle(c)} className="hover:text-destructive">
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {value.length > 8 && (
            <span className="text-[11px] text-muted-foreground">+{value.length - 8} more</span>
          )}
        </div>
      )}

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border/40 bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search countries…"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-destructive"
              >
                Clear
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</p>
            ) : (
              filtered.map((c) => {
                const checked = selected.has(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggle(c)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-border/60",
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{c}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
