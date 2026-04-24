import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Stars } from "@/components/Stars";
import { fetchProduct, type Product } from "@/lib/products";

export const Route = createFileRoute("/product_/$id/reviews")({
  loader: async ({ params }): Promise<{ product: Product }> => {
    const product = await fetchProduct(params.id);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product.name} — Reviews` },
          { name: "description", content: `All reviews for ${loaderData.product.name}` },
        ]
      : [],
  }),
  notFoundComponent: () => (
    <div className="container mx-auto px-6 py-24 text-center">
      <h1 className="font-serif text-4xl">Piece not found</h1>
      <Link to="/shop" className="mt-6 inline-block text-primary underline">Return to shop</Link>
    </div>
  ),
  errorComponent: ({ error }: { error: Error }) => (
    <div className="container mx-auto px-6 py-24 text-center">
      <h1 className="font-serif text-4xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  component: AllReviewsPage,
});

function AllReviewsPage() {
  const { product } = Route.useLoaderData() as { product: Product };
  return (
    <div className="container mx-auto px-6 py-12">
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to product
      </Link>

      <div className="mt-6 flex items-end justify-between border-b border-border pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Reviews</p>
          <h1 className="mt-2 font-serif text-3xl">{product.name}</h1>
        </div>
        <div className="text-right">
          <div className="font-serif text-4xl text-gold-gradient">{product.rating}</div>
          <Stars rating={product.rating} />
          <p className="mt-1 text-xs text-muted-foreground">{product.reviewCount} reviews</p>
        </div>
      </div>

      {product.reviews.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No reviews yet.</p>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {product.reviews.map((r) => (
            <article key={r.id} className="border border-border bg-card/50 p-6">
              <div className="flex items-center justify-between">
                <Stars rating={r.rating} />
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{r.date}</span>
              </div>
              <h3 className="mt-3 font-serif text-xl">{r.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-primary">— {r.author}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
