import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCTS, CATEGORIES } from "@/lib/products";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison Luxe — A Curated Atelier of Considered Objects" },
      {
        name: "description",
        content:
          "A curated atelier of timepieces, leather goods, fragrance, and home objects from the world's finest houses.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const featured = PRODUCTS.slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative h-[85vh] min-h-[600px] overflow-hidden">
        <img
          src={hero}
          alt="Luxury still life"
          width={1920}
          height={1280}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="container relative mx-auto flex h-full items-center px-6">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.4em] text-primary">Autumn Collection</p>
            <h1 className="mt-6 font-serif text-5xl leading-[1.05] text-foreground md:text-7xl">
              Objects of <em className="text-gold-gradient">enduring</em> craft.
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">
              From the ateliers of Florence, Grasse, and beyond — a meticulously curated
              collection for those who measure value in decades, not seasons.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/shop"
                className="group inline-flex items-center gap-2 bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground shadow-gold transition-smooth hover:opacity-90"
              >
                Explore Collection
                <ArrowRight className="h-4 w-4 transition-smooth group-hover:translate-x-1" />
              </Link>
              <Link
                to="/shop"
                className="inline-flex items-center border border-border px-8 py-4 text-xs uppercase tracking-[0.25em] text-foreground transition-smooth hover:border-primary hover:text-primary"
              >
                Our Story
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-6 py-24">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">By Category</p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl">Explore the House</h2>
          </div>
          <Link
            to="/shop"
            className="hidden text-xs uppercase tracking-[0.25em] text-muted-foreground transition-smooth hover:text-primary md:inline"
          >
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              to="/shop"
              search={{ category: cat }}
              className="group relative aspect-square overflow-hidden border border-border bg-card transition-smooth hover:border-primary"
            >
              <div className="flex h-full items-center justify-center p-4 text-center">
                <span className="font-serif text-lg leading-tight text-foreground transition-smooth group-hover:text-primary">
                  {cat}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="container mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Featured</p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl">This Season's Edit</h2>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Editorial */}
      <section className="container mx-auto px-6 py-24">
        <div className="border border-border bg-card/50 p-12 text-center md:p-20">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">The Concierge</p>
          <h2 className="mx-auto mt-4 max-w-2xl font-serif text-3xl md:text-5xl">
            Personal sourcing, by appointment.
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-muted-foreground">
            Our private concierge will source rare and bespoke pieces on your behalf — from vintage
            timepieces to one-of-one commissions.
          </p>
          <Link
            to="/shop"
            className="mt-10 inline-flex bg-gold-gradient px-8 py-4 text-xs uppercase tracking-[0.25em] text-primary-foreground transition-smooth hover:opacity-90"
          >
            Begin a Conversation
          </Link>
        </div>
      </section>
    </>
  );
}
