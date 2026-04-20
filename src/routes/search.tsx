import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Search as SearchIcon, Camera, Upload, X, ImagePlus, Sparkles } from "lucide-react";
import { textSearch, visualSearch, logInterest } from "@/lib/ai.functions";
import { fetchProductsByIds, type Product } from "@/lib/products";
import { Recommend } from "@/components/Recommend";
import { useStore } from "@/lib/store";

type ShopSearch = { q?: string; tab?: "text" | "image" };

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    q: (search.q as string) || undefined,
    tab: (search.tab === "image" ? "image" : "text") as "text" | "image",
  }),
  head: () => ({
    meta: [
      { title: "Search — Maison Luxe" },
      { name: "description", content: "Search the atelier by text or image with AI." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q, tab } = Route.useSearch();
  const { user } = useStore();
  const [activeTab, setActiveTab] = useState<"text" | "image">(tab ?? "text");
  const [query, setQuery] = useState(q ?? "");
  const [textResults, setTextResults] = useState<Product[]>([]);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  // Image state
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageResults, setImageResults] = useState<Product[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Auto-run text search if q is in URL
  useEffect(() => {
    if (q) void runTextSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const runTextSearch = async (text: string) => {
    if (!text.trim()) return;
    setTextLoading(true);
    setTextError(null);
    try {
      const { ids } = await textSearch({ data: { query: text } });
      const items = ids.length ? await fetchProductsByIds(ids) : [];
      setTextResults(items);
      // Log interest (only if signed in)
      if (user) void logInterest({ data: { kind: "search", query: text } }).catch(() => undefined);
    } catch (e) {
      console.error(e);
      setTextError(e instanceof Error ? e.message : "Search failed");
      setTextResults([]);
    } finally {
      setTextLoading(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async () => {
    setCameraOpen(true);
    setImageError(null);
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
      setImageError("Camera unavailable. Please upload an image instead.");
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
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setImageError("Image must be under 6MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageDataUrl(dataUrl);
      void runImageSearch(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runImageSearch = async (dataUrl: string) => {
    setImageLoading(true);
    setImageError(null);
    setImageResults([]);
    try {
      const res = await visualSearch({ data: { imageDataUrl: dataUrl } });
      const ids = res.matches.map((m) => m.id);
      const items = ids.length ? await fetchProductsByIds(ids) : [];
      setImageResults(items);
      if (user) void logInterest({ data: { kind: "search", query: res.description || "image search" } }).catch(() => undefined);
    } catch (e) {
      console.error(e);
      setImageError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setImageLoading(false);
    }
  };

  useEffect(() => () => stopCamera(), []);

  return (
    <div className="bg-background pb-12">
      <div className="mx-auto max-w-5xl px-3 pt-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-border/60">
          {(["text", "image"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={`flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-[0.2em] transition-smooth ${
                activeTab === t
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "text" ? <SearchIcon className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {t === "text" ? "Text" : "Image"}
            </button>
          ))}
        </div>

        {/* TEXT TAB */}
        {activeTab === "text" && (
          <div className="py-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runTextSearch(query);
              }}
              className="flex w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-luxury"
            >
              <SearchIcon className="h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, brand, type…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="flex h-8 items-center justify-center rounded-full bg-gold-gradient px-4 text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                Search
              </button>
            </form>

            <div className="mt-6">
              {textLoading ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Searching…</p>
                </div>
              ) : textError ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{textError}</p>
              ) : textResults.length === 0 && query ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No pieces match your search.</p>
              ) : (
                <ProductGrid products={textResults} />
              )}
            </div>
          </div>
        )}

        {/* IMAGE TAB */}
        {activeTab === "image" && (
          <div className="py-4">
            {!imageDataUrl && !cameraOpen && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex flex-col items-center gap-2 rounded-lg border border-primary/40 bg-card p-6 transition-smooth hover:border-primary"
                >
                  <Camera className="h-7 w-7 text-primary" />
                  <span className="text-xs font-medium text-foreground">Take photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-2 rounded-lg border border-primary/40 bg-card p-6 transition-smooth hover:border-primary"
                >
                  <Upload className="h-7 w-7 text-primary" />
                  <span className="text-xs font-medium text-foreground">Upload image</span>
                </button>
              </div>
            )}

            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />

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

            {imageDataUrl && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <img src={imageDataUrl} alt="Search" className="h-16 w-16 rounded object-cover" />
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => { setImageDataUrl(null); setImageResults([]); setImageError(null); }}
                  className="rounded-full border border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:border-primary hover:text-primary"
                >
                  New image
                </button>
              </div>
            )}

            {imageError && (
              <p className="mt-4 text-center text-sm text-muted-foreground">{imageError}</p>
            )}

            <div className="mt-6">
              {imageLoading ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Analyzing image…</p>
                </div>
              ) : imageResults.length === 0 && imageDataUrl && !imageLoading ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No matches found. Try a clearer photo.</p>
              ) : (
                <ProductGrid products={imageResults} />
              )}
            </div>
          </div>
        )}
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
        const original = Math.round(p.price * 1.4);
        return (
          <Link
            key={p.id}
            to="/product/$id"
            params={{ id: p.id }}
            className="group block border border-border bg-card transition-smooth hover:border-primary"
          >
            <div className="aspect-square overflow-hidden">
              <img src={p.image} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-smooth group-hover:scale-105" />
            </div>
            <div className="space-y-1 p-2">
              <p className="line-clamp-2 text-[11px] leading-tight text-foreground">{p.name}</p>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-sm text-gold-gradient">${p.price.toLocaleString()}</span>
                <span className="text-[9px] text-muted-foreground line-through">${original.toLocaleString()}</span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
