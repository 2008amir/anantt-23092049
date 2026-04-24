import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Camera, Upload, X, Loader2, ImagePlus } from "lucide-react";
import { visualSearch } from "@/lib/ai.functions";
import { fetchProductsByIds, type Product } from "@/lib/products";
import { effectivePrice, hasDiscount, formatNaira } from "@/lib/price";

type Stage = "choose" | "camera" | "loading" | "results" | "error";

type Match = { id: string; reason: string; score: number };

export function VisualSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stage, setStage] = useState<Stage>("choose");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const reset = () => {
    stopCamera();
    setStage("choose");
    setImageDataUrl(null);
    setMatches([]);
    setProducts([]);
    setDescription("");
    setErrorMsg("");
  };

  useEffect(() => {
    if (!open) reset();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startCamera = async () => {
    setStage("camera");
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      // wait one tick for the video element to mount
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch (e) {
      console.error(e);
      setErrorMsg("Camera unavailable. Please allow camera access or upload an image.");
      setStage("error");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const w = video.videoWidth || 720;
    const h = video.videoHeight || 720;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopCamera();
    setImageDataUrl(dataUrl);
    void runSearch(dataUrl);
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setErrorMsg("Image must be under 6MB.");
      setStage("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImageDataUrl(dataUrl);
      void runSearch(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runSearch = async (dataUrl?: string) => {
    const img = dataUrl ?? imageDataUrl;
    if (!img) return;
    setStage("loading");
    try {
      const res = await visualSearch({ data: { imageDataUrl: img } });
      setMatches(res.matches);
      setDescription(res.description);
      const ids = res.matches.map((m) => m.id);
      const fetched = ids.length ? await fetchProductsByIds(ids) : [];
      setProducts(fetched);
      setStage("results");
    } catch (e) {
      console.error(e);
      setErrorMsg(e instanceof Error ? e.message : "Search failed");
      setStage("error");
    }
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const matchedProducts = matches
    .map((m) => ({ ...m, product: products.find((p: Product) => p.id === m.id) }))
    .filter((m) => m.product);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <p className="font-serif text-sm text-foreground">Search</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {stage === "choose" && (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
            <h2 className="font-serif text-xl text-foreground">Search by image</h2>
            <div className="grid w-full grid-cols-2 gap-3">
              <button
                type="button"
                onClick={startCamera}
                className="flex flex-col items-center gap-2 rounded-lg border border-primary/40 bg-card p-5 transition-smooth hover:border-primary"
              >
                <Camera className="h-7 w-7 text-primary" />
                <span className="text-xs font-medium text-foreground">Take image</span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border border-primary/40 bg-card p-5 transition-smooth hover:border-primary"
              >
                <Upload className="h-7 w-7 text-primary" />
                <span className="text-xs font-medium text-foreground">Upload image</span>
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onUpload}
            />
          </div>
        )}

        {stage === "camera" && (
          <div className="relative flex h-full flex-col bg-background">
            <div className="relative flex-1 overflow-hidden bg-background">
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover"
              />
              {/* Frame overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-64 w-64 rounded-lg border-2 border-primary/60 shadow-luxury" />
              </div>
            </div>
            <div className="border-t border-border/60 bg-background px-6 py-6">
              <p className="mb-4 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Center the object in the frame
              </p>
              <div className="flex items-center justify-center gap-8">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Upload instead"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={capture}
                  aria-label="Capture"
                  className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-primary bg-gold-gradient transition-smooth active:scale-95"
                >
                  <span className="h-12 w-12 rounded-full bg-background" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setStage("choose");
                  }}
                  aria-label="Cancel"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onUpload}
            />
          </div>
        )}

        {stage === "loading" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="font-serif text-sm text-foreground">Searching…</p>
          </div>
        )}

        {stage === "results" && (
          <div className="mx-auto max-w-3xl px-3 py-4">
            {imageDataUrl && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <img src={imageDataUrl} alt="Your image" className="h-14 w-14 rounded object-cover" />
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-full border border-border px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:border-primary hover:text-primary"
                >
                  New search
                </button>
              </div>
            )}

            <h3 className="mb-3 font-serif text-base text-foreground">
              {matchedProducts.length > 0
                ? `${matchedProducts.length} matching ${matchedProducts.length === 1 ? "piece" : "pieces"}`
                : "No matches"}
            </h3>

            {matchedProducts.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                We couldn't find resembling pieces. Try a clearer shot or different angle.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {matchedProducts.map((m) => {
                  const p = m.product!;
                  const showDiscount = hasDiscount(p);
                  return (
                    <Link
                      key={p.id}
                      to="/product/$id"
                      params={{ id: p.id }}
                      onClick={onClose}
                      className="group block border border-border bg-card transition-smooth hover:border-primary"
                    >
                      <div className="relative aspect-square overflow-hidden">
                        <img src={p.image} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-smooth group-hover:scale-105" />
                      </div>
                      <div className="space-y-1 p-2">
                        <p className="line-clamp-2 text-[11px] leading-tight text-foreground">{p.name}</p>
                        <div className="flex items-baseline gap-1 pt-0.5">
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
            )}
          </div>
        )}

        {stage === "error" && (
          <div className="mx-auto flex max-w-sm flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="font-serif text-base text-foreground">Something went wrong</p>
            <p className="text-xs text-muted-foreground">{errorMsg}</p>
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-gold-gradient px-5 py-2 text-xs font-medium text-primary-foreground"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
