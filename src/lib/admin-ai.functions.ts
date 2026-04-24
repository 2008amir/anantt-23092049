import { createServerFn } from "@tanstack/react-start";
import { getFlutterwaveAuthContext } from "./flutterwave-auth.server";

type Review = {
  id: string;
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
};

async function callGateway(systemPrompt: string, userPrompt: string, toolName: string, schema: object) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{ type: "function", function: { name: toolName, description: "Return result", parameters: schema } }],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    const txt = await res.text();
    console.error("AI gateway error", res.status, txt);
    throw new Error("AI call failed");
  }
  const json = await res.json();
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    return JSON.parse(args);
  } catch (e) {
    console.error("parse error", e);
    return null;
  }
}

// Generate realistic product reviews from a list of countries × M messages each
export const generateProductReviews = createServerFn({ method: "POST" })
  .inputValidator((input: { productName: string; productDescription?: string; countries: string[]; messages: number; accessToken?: string }) => {
    if (!input?.productName || typeof input.productName !== "string") throw new Error("productName required");
    if (!Array.isArray(input.countries) || input.countries.length < 1 || input.countries.length > 60) {
      throw new Error("Pick between 1 and 60 countries");
    }
    if (!Number.isFinite(input.messages) || input.messages < 1 || input.messages > 50) {
      throw new Error("messages must be between 1 and 50");
    }
    if (!input.accessToken) throw new Error("Please sign in again.");
    return input;
  })
  .handler(async ({ data }): Promise<{ reviews: Review[]; rating: number; error: string | null }> => {
    try {
      await getFlutterwaveAuthContext(data.accessToken);

      const countryList = data.countries.join(", ");
      const total = data.countries.length * data.messages;
      const systemPrompt = `You are generating realistic, varied customer reviews for a luxury e-commerce product. Generate exactly ${data.messages} reviews per country for these countries: ${countryList}. Use authentic first names typical of each country. Vary tone: most positive (4-5 stars), some neutral (3 stars), occasional minor critique. Short titles. 1-3 sentence bodies.`;

      const userPrompt = `Product: ${data.productName}
${data.productDescription ? `Description: ${data.productDescription}` : ""}

Generate exactly ${total} reviews — ${data.messages} per country across these ${data.countries.length} countries: ${countryList}.`;

      const parsed = await callGateway(systemPrompt, userPrompt, "make_reviews", {
        type: "object",
        properties: {
          reviews: {
            type: "array",
            items: {
              type: "object",
              properties: {
                author: { type: "string" },
                country: { type: "string" },
                rating: { type: "integer", minimum: 1, maximum: 5 },
                title: { type: "string" },
                body: { type: "string" },
              },
              required: ["author", "country", "rating", "title", "body"],
              additionalProperties: false,
            },
          },
        },
        required: ["reviews"],
        additionalProperties: false,
      });

      const raw = (parsed?.reviews ?? []) as Array<{ author: string; country: string; rating: number; title: string; body: string }>;

      // Shuffle so countries are interleaved instead of grouped
      const shuffled = [...raw];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const now = new Date();
      const reviews: Review[] = shuffled.slice(0, total).map((r, i) => {
        const daysAgo = Math.floor(Math.random() * 120);
        const d = new Date(now.getTime() - daysAgo * 86400000);
        return {
          id: `gen-${Date.now()}-${i}`,
          author: `${r.author} (${r.country})`,
          rating: Math.max(1, Math.min(5, Math.round(r.rating))),
          date: d.toISOString().slice(0, 10),
          title: r.title,
          body: r.body,
        };
      });

      const rating = reviews.length > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
        : 0;

      return { reviews, rating, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "AI generation failed";
      console.error("generateProductReviews error:", msg);
      return { reviews: [], rating: 0, error: msg };
    }
  });
