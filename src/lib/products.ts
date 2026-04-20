import watch from "@/assets/p-watch.jpg";
import bag from "@/assets/p-bag.jpg";
import perfume from "@/assets/p-perfume.jpg";
import headphones from "@/assets/p-headphones.jpg";
import decanter from "@/assets/p-decanter.jpg";
import throwBlanket from "@/assets/p-throw.jpg";
import pen from "@/assets/p-pen.jpg";
import sunglasses from "@/assets/p-sunglasses.jpg";

export type Category =
  | "Timepieces"
  | "Leather Goods"
  | "Fragrance"
  | "Audio"
  | "Home"
  | "Accessories";

export type Review = {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
};

export type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  category: Category;
  description: string;
  details: string[];
  rating: number;
  reviewCount: number;
  reviews: Review[];
  inStock: boolean;
};

export const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Noir Chronograph",
    brand: "Maison Aurelle",
    price: 4850,
    image: watch,
    category: "Timepieces",
    description:
      "A meticulously crafted automatic chronograph in rose gold and obsidian black. Sapphire crystal, 50m water resistance.",
    details: ["42mm rose gold case", "Swiss automatic movement", "Sapphire crystal", "Italian leather strap"],
    rating: 4.8,
    reviewCount: 142,
    inStock: true,
    reviews: [
      { id: "r1", author: "Adrien M.", rating: 5, date: "2 weeks ago", title: "Exceptional craftsmanship", body: "The dial is even more striking in person. Wears beautifully on a 7-inch wrist." },
      { id: "r2", author: "Sofia L.", rating: 5, date: "1 month ago", title: "Worth every dollar", body: "Gifted to my husband — packaging alone felt like a small ceremony." },
      { id: "r3", author: "Thomas R.", rating: 4, date: "2 months ago", title: "Stunning, slightly heavy", body: "Beautiful piece. Took a week to adjust to the weight, now I love it." },
    ],
  },
  {
    id: "p2",
    name: "Cognac Tote",
    brand: "Atelier Vence",
    price: 1290,
    image: bag,
    category: "Leather Goods",
    description: "Hand-finished full-grain leather tote with brass hardware. Roomy enough for daily carry, refined enough for the boardroom.",
    details: ["Full-grain Italian leather", "Cotton twill lining", "Brass hardware", "Made in Florence"],
    rating: 4.9,
    reviewCount: 89,
    inStock: true,
    reviews: [
      { id: "r1", author: "Eloise B.", rating: 5, date: "3 weeks ago", title: "A future heirloom", body: "Patina developing beautifully after a month of daily use." },
    ],
  },
  {
    id: "p3",
    name: "Ambre Royale",
    brand: "Parfums Voltaire",
    price: 285,
    image: perfume,
    category: "Fragrance",
    description: "An opulent oriental: top notes of bergamot, heart of Bulgarian rose, base of oud and amber. 100ml.",
    details: ["100ml eau de parfum", "Hand-blown glass", "Bergamot · Rose · Oud", "Crafted in Grasse"],
    rating: 4.7,
    reviewCount: 312,
    inStock: true,
    reviews: [
      { id: "r1", author: "Margot C.", rating: 5, date: "1 week ago", title: "My signature scent", body: "Lasts a full day on skin. Endless compliments." },
    ],
  },
  {
    id: "p4",
    name: "Onyx Studio Headphones",
    brand: "Sonore Lab",
    price: 695,
    image: headphones,
    category: "Audio",
    description: "Reference-grade over-ear headphones with active noise cancellation and 40-hour battery.",
    details: ["40h battery life", "Hybrid ANC", "Hi-Res certified", "Memory foam earcups"],
    rating: 4.6,
    reviewCount: 218,
    inStock: true,
    reviews: [],
  },
  {
    id: "p5",
    name: "Crystal Decanter Set",
    brand: "Verrerie Lyon",
    price: 540,
    image: decanter,
    category: "Home",
    description: "Hand-cut lead-free crystal decanter with two matching tumblers. A statement on any bar cart.",
    details: ["Lead-free crystal", "Hand-cut in France", "Includes 2 tumblers", "Gift-boxed"],
    rating: 4.9,
    reviewCount: 67,
    inStock: true,
    reviews: [],
  },
  {
    id: "p6",
    name: "Cashmere Throw",
    brand: "Maison Laine",
    price: 420,
    image: throwBlanket,
    category: "Home",
    description: "Pure Mongolian cashmere throw, woven on traditional looms. The softest hour of your day.",
    details: ["100% Mongolian cashmere", "130 × 180cm", "Hand-fringed edges", "Dry clean only"],
    rating: 4.8,
    reviewCount: 154,
    inStock: true,
    reviews: [],
  },
  {
    id: "p7",
    name: "Onyx Fountain Pen",
    brand: "Plume & Or",
    price: 380,
    image: pen,
    category: "Accessories",
    description: "Lacquered resin barrel with 18k gold nib. Comes with leather notebook.",
    details: ["18k gold nib", "Piston filler", "Leather notebook included", "Lifetime service"],
    rating: 4.7,
    reviewCount: 98,
    inStock: true,
    reviews: [],
  },
  {
    id: "p8",
    name: "Gilded Aviators",
    brand: "Solène",
    price: 320,
    image: sunglasses,
    category: "Accessories",
    description: "Polarized lenses set in 18k gold-plated titanium frames. Effortlessly timeless.",
    details: ["Polarized CR-39 lenses", "Gold-plated titanium", "UV400 protection", "Italian-made"],
    rating: 4.6,
    reviewCount: 124,
    inStock: true,
    reviews: [],
  },
];

export const CATEGORIES: Category[] = [
  "Timepieces",
  "Leather Goods",
  "Fragrance",
  "Audio",
  "Home",
  "Accessories",
];

export const getProduct = (id: string) => PRODUCTS.find((p) => p.id === id);
