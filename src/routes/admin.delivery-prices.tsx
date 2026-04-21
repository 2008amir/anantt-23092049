import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NIGERIA_STATE_NAMES, NIGERIA_STATES } from "@/lib/nigeria-states";
import { ChevronDown, ChevronRight, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/delivery-prices")({
  component: DeliveryPricesPage,
});

type PriceRow = { id?: string; state: string; lga: string; price: number };

function DeliveryPricesPage() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [openState, setOpenState] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const keyOf = (state: string, lga: string) => `${state}::${lga}`;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("lga_delivery_prices").select("*");
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: PriceRow) => {
        map[keyOf(r.state, r.lga)] = Number(r.price);
      });
      setPrices(map);
      setLoading(false);
    })();
  }, []);

  const save = async (state: string, lga: string) => {
    const k = keyOf(state, lga);
    setSavingKey(k);
    const price = prices[k] ?? 0;
    await supabase
      .from("lga_delivery_prices")
      .upsert({ state, lga, price, updated_at: new Date().toISOString() }, { onConflict: "state,lga" });
    setSavingKey(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Delivery prices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set delivery price per LGA. Applied per order at checkout.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border/40 bg-card">
          {NIGERIA_STATE_NAMES.map((state) => {
            const isOpen = openState === state;
            const lgas = NIGERIA_STATES[state];
            return (
              <div key={state} className="border-b border-border/40 last:border-0">
                <button
                  onClick={() => setOpenState(isOpen ? null : state)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/50"
                >
                  <span className="font-medium">{state}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <div className="bg-muted/30 px-5 py-4">
                    <div className="space-y-2">
                      {lgas.map((lga) => {
                        const k = keyOf(state, lga);
                        const isSaving = savingKey === k;
                        return (
                          <div key={lga} className="flex items-center gap-3">
                            <span className="flex-1 text-sm">{lga}</span>
                            <span className="text-xs text-muted-foreground">₦</span>
                            <input
                              type="number"
                              min={0}
                              value={prices[k] ?? ""}
                              onChange={(e) =>
                                setPrices((p) => ({ ...p, [k]: Number(e.target.value) }))
                              }
                              className="w-28 rounded-md border border-border/40 bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                              placeholder="0"
                            />
                            <button
                              onClick={() => void save(state, lga)}
                              disabled={isSaving}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs",
                                isSaving
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-primary text-primary-foreground hover:opacity-90",
                              )}
                            >
                              <Save className="h-3 w-3" />
                              {isSaving ? "…" : "Save"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
