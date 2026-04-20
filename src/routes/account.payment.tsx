import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/account/payment")({
  component: () => (
    <div>
      <h2 className="font-serif text-3xl">Payment Methods</h2>
      <p className="mt-2 text-sm text-muted-foreground">Cards and methods saved for faster checkout.</p>
      <div className="mt-8 border border-dashed border-border p-12 text-center">
        <p className="text-muted-foreground">No payment methods saved.</p>
        <button type="button" className="mt-4 bg-gold-gradient px-6 py-3 text-xs uppercase tracking-[0.25em] text-primary-foreground">
          Add Payment Method
        </button>
      </div>
    </div>
  ),
});
