import { createServerFn } from "@tanstack/react-start";

type MatchResult = {
  matches: Array<{ id: string; reason: string; score: number }>;
  description: string;
};

const PRODUCT_CATALOG = [
  { id: "p1", name: "Noir Chronograph", category: "Timepieces", brand: "Maison Aurelle", colors: "rose gold, black", function: "watch, timekeeping" },
  { id: "p2", name: "Cognac Tote", category: "Leather Goods", brand: "Atelier Vence", colors: "cognac brown, brass", function: "bag, carry" },
  { id: "p3", name: "Ambre Royale", category: "Fragrance", brand: "Parfums Voltaire", colors: "amber, gold", function: "perfume, scent" },
  { id: "p4", name: "Onyx Studio Headphones", category: "Audio", brand: "Sonore Lab", colors: "black, silver", function: "headphones, audio, music" },
  { id: "p5", name: "Crystal Decanter Set", category: "Home", brand: "Verrerie Lyon", colors: "clear crystal", function: "decanter, drink, bar" },
  { id: "p6", name: "Cashmere Throw", category: "Home", brand: "Maison Laine", colors: "cream, beige", function: "blanket, throw, warmth" },
  { id: "p7", name: "Onyx Fountain Pen", category: "Accessories", brand: "Plume & Or", colors: "black, gold", function: "pen, writing" },
  { id: "p8", name: "Gilded Aviators", category: "Accessories", brand: "Solène", colors: "gold, dark lens", function: "sunglasses, eyewear" },
];

export const visualSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl: string }) => {
    if (!input?.imageDataUrl || typeof input.imageDataUrl !== "string") {
      throw new Error("imageDataUrl required");
    }
    if (input.imageDataUrl.length > 8_000_000) {
      throw new Error("Image too large");
    }
    return input;
  })
  .handler(async ({ data }): Promise<MatchResult> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const catalogText = PRODUCT_CATALOG.map(
      (p) => `- ${p.id}: ${p.name} (${p.brand}) — category: ${p.category}, colors: ${p.colors}, function: ${p.function}`,
    ).join("\n");

    const systemPrompt = `You are a visual product matcher for Maison Luxe. The user gives you an image. Match it to products in this catalog by visual resemblance, function/purpose, OR dominant color. Always return at least 1 match if any product is even loosely related; rank best first. Use the match_products tool.

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
          {
            role: "user",
            content: [
              { type: "text", text: "Match this image to products in the catalog. Consider visual look, function, and color." },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "match_products",
              description: "Return ranked product matches",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string", description: "Brief one-sentence description of what's in the image" },
                  matches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Product id from catalog (e.g. p1)" },
                        reason: { type: "string", description: "Short reason for match" },
                        score: { type: "number", description: "0 to 1 confidence" },
                      },
                      required: ["id", "reason", "score"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["description", "matches"],
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
      throw new Error("Visual search failed");
    }

    const json = await res.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return { matches: [], description: "Could not analyze image" };
    }
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      const validIds = new Set(PRODUCT_CATALOG.map((p) => p.id));
      return {
        description: parsed.description ?? "",
        matches: (parsed.matches ?? [])
          .filter((m: { id: string }) => validIds.has(m.id))
          .slice(0, 8),
      };
    } catch (e) {
      console.error("Parse error", e);
      return { matches: [], description: "" };
    }
  });
