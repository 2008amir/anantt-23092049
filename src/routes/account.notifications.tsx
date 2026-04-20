import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/account/notifications")({
  component: Notifications,
});

function Notifications() {
  const [prefs, setPrefs] = useState({ orders: true, drops: true, editorial: false, sms: false });
  return (
    <div>
      <h2 className="font-serif text-3xl">Notifications</h2>
      <p className="mt-2 text-sm text-muted-foreground">Choose what you'd like to hear about.</p>
      <div className="mt-8 divide-y divide-border border-y border-border">
        {[
          { key: "orders", label: "Order Updates", desc: "Confirmations, shipping, delivery." },
          { key: "drops", label: "New Drops", desc: "Be the first to know about new arrivals." },
          { key: "editorial", label: "Editorial", desc: "Stories, interviews, the journal." },
          { key: "sms", label: "SMS Alerts", desc: "Critical order updates via text." },
        ].map((p) => (
          <label key={p.key} className="flex items-start justify-between py-4">
            <div>
              <p className="text-sm text-foreground">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </div>
            <input
              type="checkbox"
              checked={prefs[p.key as keyof typeof prefs]}
              onChange={(e) => setPrefs({ ...prefs, [p.key]: e.target.checked })}
              className="mt-1 h-5 w-5 accent-[oklch(0.82_0.11_85)]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}
