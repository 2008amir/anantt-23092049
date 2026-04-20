import { createServerFn } from "@tanstack/react-start";

export type AICategory = {
  name: string;
  productIds: string[];
};

const PRODUCT_CATALOG = [
  { id: "p1", name: "Noir Chronograph", brand: "Maison Aurelle", description: "Automatic chronograph wristwatch in rose gold and black." },
  { id: "p2", name: "Cognac Tote", brand: "Atelier Vence", description: "Full-grain leather tote handbag." },
  { id: "p3", name: "Ambre Royale", brand: "Parfums Voltaire", description: "Eau de parfum with bergamot, rose, and oud." },
  { id: "p4", name: "Onyx Studio Headphones", brand: "Sonore Lab", description: "Over-ear noise cancelling headphones." },
  { id: "p5", name: "Crystal Decanter Set", brand: "Verrerie Lyon", description: "Crystal whisky decanter with tumblers." },
  { id: "p6", name: "Cashmere Throw", brand: "Maison Laine", description: "Mongolian cashmere blanket throw." },
  { id: "p7", name: "Onyx Fountain Pen", brand: "Plume & Or", description: "Fountain pen with 18k gold nib." },
  { id: "p8", name: "Gilded Aviators", brand: "Solène", description: "Polarized aviator sunglasses with gold frames." },
];

export const generateCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ categories: AICategory[] }> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const catalogText = PRODUCT_CATALOG.map(
      (p) => `- ${p.id}: ${p.name} by ${p.brand} — ${p.description}`,
    ).join("\n");

    const systemPrompt = `You organize a luxury catalog into shoppable business categories. Read the products and propose 4-7 concise category names (1-2 words each, Title Case) that group them naturally — derive these names from the actual products, do not invent unrelated ones. Assign every product id to exactly one category. Use the build_categories tool.

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
          { role: "user", content: "Group these products into business categories." },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "build_categories",
              description: "Return AI-generated categories with assigned product ids",
              parameters: {
                type: "object",
                properties: {
                  categories: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        productIds: { type: "array", items: { type: "string" } },
                      },
                      required: ["name", "productIds"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["categories"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "build_categories" } },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      if (res.status === 429) throw new Error("Rate limit reached.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("Category generation failed");
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return { categories: [] };

    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      const validIds = new Set(PRODUCT_CATALOG.map((p) => p.id));
      const categories: AICategory[] = (parsed.categories ?? [])
        .map((c: { name: string; productIds: string[] }) => ({
          name: String(c.name).trim(),
          productIds: (c.productIds ?? []).filter((id) => validIds.has(id)),
        }))
        .filter((c: AICategory) => c.name && c.productIds.length > 0);
      return { categories };
    } catch (e) {
      console.error("Parse error", e);
      return { categories: [] };
    }
  },
);
