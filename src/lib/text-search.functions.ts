import { createServerFn } from "@tanstack/react-start";

type SearchResult = {
  ids: string[];
};

const PRODUCT_CATALOG = [
  { id: "p1", name: "Noir Chronograph", brand: "Maison Aurelle", category: "Timepieces", keywords: "watch, wristwatch, chronograph, timepiece, automatic, rose gold, black" },
  { id: "p2", name: "Cognac Tote", brand: "Atelier Vence", category: "Leather Goods", keywords: "bag, tote, handbag, leather, brown, cognac, purse, shoulder bag" },
  { id: "p3", name: "Ambre Royale", brand: "Parfums Voltaire", category: "Fragrance", keywords: "perfume, fragrance, cologne, scent, eau de parfum, oud, amber, rose" },
  { id: "p4", name: "Onyx Studio Headphones", brand: "Sonore Lab", category: "Audio", keywords: "headphones, audio, music, noise cancelling, over ear, wireless, black" },
  { id: "p5", name: "Crystal Decanter Set", brand: "Verrerie Lyon", category: "Home", keywords: "decanter, whisky, crystal, glassware, bar, tumblers, drinkware" },
  { id: "p6", name: "Cashmere Throw", brand: "Maison Laine", category: "Home", keywords: "blanket, throw, cashmere, wool, cream, beige, cozy, bedding" },
  { id: "p7", name: "Onyx Fountain Pen", brand: "Plume & Or", category: "Accessories", keywords: "pen, fountain pen, writing, ink, gold nib, stationery, black" },
  { id: "p8", name: "Gilded Aviators", brand: "Solène", category: "Accessories", keywords: "sunglasses, shades, aviators, eyewear, gold, polarized" },
];

export const textSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => {
    if (!input?.query || typeof input.query !== "string") throw new Error("query required");
    if (input.query.length > 200) throw new Error("query too long");
    return input;
  })
  .handler(async ({ data }): Promise<SearchResult> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const catalogText = PRODUCT_CATALOG.map(
      (p) => `- ${p.id}: ${p.name} by ${p.brand} (${p.category}) — keywords: ${p.keywords}`,
    ).join("\n");

    const systemPrompt = `You match a user's text query to products in a luxury catalog. The query may be a generic product name, synonym, brand, category, or description in any language (e.g. "watch", "reloj", "headphones", "perfume", "bag for work"). Return ALL products that are the same TYPE/FUNCTION as what the user is asking for. Color, brand, and exact name may differ. If the query clearly doesn't match any product type in the catalog, return an empty array. Use the match_products tool.

CATALOG:
${catalogText}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Query: ${data.query}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "match_products",
              description: "Return matching product ids",
              parameters: {
                type: "object",
                properties: {
                  ids: {
                    type: "array",
                    items: { type: "string", description: "Product id (e.g. p1)" },
                  },
                },
                required: ["ids"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "match_products" } },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      throw new Error("Search failed");
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return { ids: [] };

    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      const validIds = new Set(PRODUCT_CATALOG.map((p) => p.id));
      return {
        ids: (parsed.ids ?? []).filter((id: string) => validIds.has(id)),
      };
    } catch (e) {
      console.error("Parse error", e);
      return { ids: [] };
    }
  });
