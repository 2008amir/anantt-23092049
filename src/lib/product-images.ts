import watch from "@/assets/p-watch.jpg";
import bag from "@/assets/p-bag.jpg";
import perfume from "@/assets/p-perfume.jpg";
import headphones from "@/assets/p-headphones.jpg";
import decanter from "@/assets/p-decanter.jpg";
import throwBlanket from "@/assets/p-throw.jpg";
import pen from "@/assets/p-pen.jpg";
import sunglasses from "@/assets/p-sunglasses.jpg";

// Map DB product ids → bundled image assets so images survive build.
export const PRODUCT_IMAGES: Record<string, string> = {
  p1: watch,
  p2: bag,
  p3: perfume,
  p4: headphones,
  p5: decanter,
  p6: throwBlanket,
  p7: pen,
  p8: sunglasses,
};

export function imageFor(id: string, fallback?: string): string {
  return PRODUCT_IMAGES[id] ?? fallback ?? "";
}
