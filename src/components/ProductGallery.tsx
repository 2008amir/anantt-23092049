import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, forwardRef } from "react";

type Props = {
  images: string[];
  alt: string;
};

export const ProductGallery = forwardRef<HTMLImageElement, Props>(function ProductGallery(
  { images, alt },
  forwardedRef,
) {
  const list = images.length > 0 ? images : [""];
  const [index, setIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const isProgrammaticScroll = useRef(false);

  // Sync the visible image based on horizontal scroll position.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (isProgrammaticScroll.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth;
        if (w === 0) return;
        const i = Math.round(el.scrollLeft / w);
        setIndex((prev) => (prev === i ? prev : Math.max(0, Math.min(list.length - 1, i))));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [list.length]);

  const goTo = (i: number) => {
    if (i < 0 || i > list.length - 1) return; // hard stop at edges, no looping
    setIndex(i);
    const el = scrollerRef.current;
    if (!el) return;
    isProgrammaticScroll.current = true;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    window.setTimeout(() => {
      isProgrammaticScroll.current = false;
    }, 400);
  };

  const hasMany = list.length > 1;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex aspect-[4/5] snap-x snap-mandatory overflow-x-auto overflow-y-hidden bg-card shadow-luxury scrollbar-none"
        style={{ scrollbarWidth: "none", touchAction: "pan-x pan-y" }}
      >
        {list.map((src, i) => (
          <div key={`${src}-${i}`} className="relative h-full w-full shrink-0 snap-center">
            <img
              ref={i === 0 ? forwardedRef : undefined}
              src={src}
              alt={`${alt} — view ${i + 1}`}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {hasMany && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur transition-smooth hover:bg-background disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={index === list.length - 1}
            aria-label="Next image"
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-md backdrop-blur transition-smooth hover:bg-background disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs tracking-[0.2em] text-foreground backdrop-blur">
            {index + 1}/{list.length}
          </div>
        </>
      )}
    </div>
  );
});
