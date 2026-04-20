import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account/addresses")({
  component: () => (
    <div>
      <h2 className="font-serif text-3xl">Addresses</h2>
      <p className="mt-2 text-sm text-muted-foreground">Saved shipping and billing addresses.</p>
      <div className="mt-8 border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">No saved addresses yet.</p>
        <button type="button" className="mt-4 bg-gold-gradient px-6 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground">
          Add Address
        </button>
      </div>
    </div>
  ),
});
