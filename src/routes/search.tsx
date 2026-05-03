import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search as SearchIcon, Camera, Upload, X, ImagePlus, Clock, Trash2 } from "lucide-react";
import { textSearch, visualSearch, logInterest } from "@/lib/ai.functions";
import { fetchProducts, fetchProductsByIds, type Product } from "@/lib/products";
import { Recommend } from "@/components/Recommend";
import { useStore } from "@/lib/store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { effectivePrice, hasDiscount, formatNaira } from "@/lib/price";

function localTextMatch(catalog: Product[], q: string): Product[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const tokens = needle.split(/\s+/).filter(Boolean);
  return catalog.filter((p) => {
    const hay = `${p.name} ${p.brand} ${p.category} ${p.description}`.toLowerCase();
    return tokens.some((t) => hay.includes(t));
  });
}

type ShopSearch = { q?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: (search.q as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Search — Luxe Sparkles" },
      { name: "description", content: "Search the atelier by text or image with AI." },
    ],
  }),
  component: SearchPage,
});

const HISTORY_KEY = "lux_search_history_v1";
const HISTORY_MAX = 12;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function saveHistory(items: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch {
    // ignore quota errors
  }
}

function SearchPage() {
  const { q } = Route.useSearch();
  const { user } = useStore();
  const [query, setQuery] = useState(q ?? "");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "text" | "image">("idle");
  const [history, setHistory] = useState<string[]>([]);

  // Image state
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Load history on mount: merge localStorage with DB
  useEffect(() => {
    const local = loadHistory();
    setHistory(local);
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("search_history")
        .select("query, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(HISTORY_MAX * 2);
      if (cancelled) return;
      const remote = (data ?? []).map((r) => r.query as string);
      const merged: string[] = [];
      const seen = new Set<string>();
      for (const q of [...local, ...remote]) {
        const key = q.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(q);
        if (merged.length >= HISTORY_MAX) break;
      }
      setHistory(merged);
      saveHistory(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Auto-run text search if q is in URL
  useEffect(() => {
    if (q) void runTextSearch(q, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pushHistory = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      const next = [trimmed, ...prev.filter((h) => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, HISTORY_MAX);
      saveHistory(next);
      return next;
    });
    if (user) {
      void supabase
        .from("search_history")
        .insert({ user_id: user.id, query: trimmed })
        .then(({ error }) => {
          if (error) console.error("save search history", error);
        });
    }
  };

  const removeHistoryItem = (text: string) => {
    setHistory((prev) => {
      const next = prev.filter((h) => h !== text);
      saveHistory(next);
      return next;
    });
    if (user) {
      void supabase
        .from("search_history")
        .delete()
        .eq("user_id", user.id)
        .eq("query", text);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
    if (user) {
      void supabase.from("search_history").delete().eq("user_id", user.id);
    }
  };

  const runTextSearch = async (text: string, addToHistory = true) => {
    if (!text.trim()) return;
    setMode("text");
    setLoading(true);
    setError(null);
    setImageDataUrl(null);
    let items: Product[] = [];
    try {
      const { ids } = await textSearch({ data: { query: text } });
      items = ids.length ? await fetchProductsByIds(ids) : [];
    } catch (e) {
      console.error("AI text search failed, falling back to local match", e);
    }
    // Fallback: if AI returned nothing (or failed), do a simple local match
    // across the full catalog so users always see relevant pieces when any
    // exist for their query.
    if (items.length === 0) {
      try {
        const all = await fetchProducts();
        items = localTextMatch(all, text).slice(0, 24);
      } catch (e) {
        console.error("local fallback failed", e);
        setError(e instanceof Error ? e.message : "Search failed");
      }
    }
    setResults(items);
    if (addToHistory) pushHistory(text);
    if (user) void logInterest({ data: { kind: "search", query: text } }).catch(() => undefined);
    setLoading(false);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setPopoverOpen(false);
    setCameraOpen(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (e) {
      console.error(e);
      setError("Camera unavailable. Please upload an image instead.");
      setCameraOpen(false);
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    setCameraOpen(false);
    setImageDataUrl(dataUrl);
    void runImageSearch(dataUrl);
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPopoverOpen(false);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setError("Image must be under 6MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageDataUrl(dataUrl);
      void runImageSearch(dataUrl);
    };
    reader.readAsDataURL(file);
    // reset so same file can be picked again
    e.target.value = "";
  };

  const runImageSearch = async (dataUrl: string) => {
    setMode("image");
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const res = await visualSearch({ data: { imageDataUrl: dataUrl } });
      const ids = res.matches.map((m) => m.id);
      const items = ids.length ? await fetchProductsByIds(ids) : [];
      setResults(items);
      if (user) void logInterest({ data: { kind: "search", query: res.description || "image search" } }).catch(() => undefined);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => stopCamera(), []);

  const showHistory = mode === "idle" && !loading && !imageDataUrl && !cameraOpen;

  return (
    <div className="bg-background pb-12">
      <div className="mx-auto max-w-5xl px-3 pt-4">
        {/* Unified search bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runTextSearch(query);
            inputRef.current?.blur();
          }}
          className="flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-luxury"
        >
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (mode !== "idle") setMode("idle");
            }}
            placeholder="Search Luxe Sparkles…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Visual search options"
                className="text-muted-foreground transition-smooth hover:text-primary"
              >
                <Camera className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={10}
              className="flex w-24 flex-col gap-1 p-1.5"
              style={{ height: "6rem" }}
            >
              <button
                type="button"
                onClick={startCamera}
                className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] uppercase tracking-wider text-foreground hover:bg-muted"
              >
                <Camera className="h-4 w-4 text-primary" />
                Capture
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] uppercase tracking-wider text-foreground hover:bg-muted"
              >
                <Upload className="h-4 w-4 text-primary" />
                Upload
              </button>
            </PopoverContent>
          </Popover>
          <button
            type="submit"
            aria-label="Search"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-gradient text-primary-foreground"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        </form>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />

        {/* History below search input */}
        {showHistory && history.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Recent searches</p>
              <button
                type="button"
                onClick={clearHistory}
                className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60 bg-card">
              {history.map((h) => (
                <li key={h} className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(h);
                      void runTextSearch(h);
                    }}
                    className="flex flex-1 items-center gap-2 text-left text-sm text-foreground hover:text-primary"
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="line-clamp-1">{h}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${h}`}
                    onClick={() => removeHistoryItem(h)}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Camera viewport */}
        {cameraOpen && (
          <div className="mt-4">
            <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-background">
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-48 w-48 rounded-lg border-2 border-primary/60" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={capture}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary bg-gold-gradient transition-smooth active:scale-95"
              >
                <span className="h-12 w-12 rounded-full bg-background" />
              </button>
              <button
                type="button"
                onClick={() => { stopCamera(); setCameraOpen(false); }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Selected image preview */}
        {imageDataUrl && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
            <img src={imageDataUrl} alt="Search" className="h-16 w-16 rounded object-cover" />
            <div className="flex-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Visual search</p>
              <p className="text-xs text-foreground">Looking for similar pieces…</p>
            </div>
            <button
              type="button"
              onClick={() => { setImageDataUrl(null); setResults([]); setError(null); setMode("idle"); }}
              className="rounded-full border border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:border-primary hover:text-primary"
            >
              New image
            </button>
          </div>
        )}

        {/* Error / Loading / Results */}
        {error && <p className="mt-4 text-center text-sm text-muted-foreground">{error}</p>}

        <div className="mt-6">
          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">
                {mode === "image" ? "Analyzing image…" : "Searching…"}
              </p>
            </div>
          ) : results.length === 0 && mode !== "idle" && !error ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {mode === "image" ? "No matches found. Try a clearer photo." : "No pieces match your search."}
            </p>
          ) : (
            <ProductGrid products={results} />
          )}
        </div>
      </div>

      <Recommend />
    </div>
  );
}

function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {products.map((p) => {
        const showDiscount = hasDiscount(p);
        return (
          <Link
            key={p.id}
            to="/product/$id"
            params={{ id: p.id }}
            className="group block border border-border bg-card transition-smooth hover:border-primary"
          >
            <div className="aspect-square overflow-hidden">
              <img src={p.image} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-smooth group-hover:scale-105" />
            </div>
            <div className="space-y-1 p-2">
              <p className="line-clamp-2 text-[11px] leading-tight text-foreground">{p.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-sm text-gold-gradient">{formatNaira(effectivePrice(p))}</span>
                {showDiscount && (
                  <span className="text-[9px] text-muted-foreground line-through">{formatNaira(p.price)}</span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
