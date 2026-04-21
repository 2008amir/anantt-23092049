import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/products")({
  component: ProductsStub,
});

function ProductsStub() {
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl">Products</h1>
      <div className="rounded-lg border border-dashed border-border/40 bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Coming next: Current / Finished / Add Products tabs with image upload, AI reviews, and color/size variants.
        </p>
      </div>
    </div>
  );
}
