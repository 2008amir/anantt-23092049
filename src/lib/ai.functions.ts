import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";


type AICategory = { name: string; productIds: string[] };
type SimilarResult = { ids: string[] };
type RecommendResult = { ids: string[]; theme: string };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const sb = adminClient();
    const { data } = await sb
      .from("ai_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() < Date.now()) return null;
    return data.payload as T;
  } catch (e) {
    console.error("cache read", e);
    return null;
  }
}

async function writeCache<T>(key: string, payload: T, ttlMs: number) {
  try {
    const sb = adminClient();
    await sb
      .from("ai_cache")
      .upsert({
        cache_key: key,
        payload: payload as unknown as object,
        expires_at: new Date(Date.now() + ttlMs).toISOString(),
      });
  } catch (e) {
    console.error("cache write", e);
  }
}

async function loadCatalog() {
  const sb = adminClient();
  const { data, error } = await sb
    .from("products")
    .select("id, name, brand, category, description, price");
  if (error) throw error;
  return data ?? [];
}

async function callAI(systemPrompt: string, userPrompt: string, toolName: string, schema: object) {
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
    const txt = await res.text();
    console.error("AI gateway error", res.status, txt);
    if (res.status === 429) throw new Error("Rate limit reached.");
    if (res.status === 402) throw new Error("AI credits exhausted.");
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

// ─── Categories ─────────────────────────────────────────────────────
export const generateCategories = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ categories: AICategory[] }> => {
    const cacheKey = "categories:v2";
    const cached = await readCache<{ categories: AICategory[] }>(cacheKey);
    if (cached) return cached;

    const catalog = await loadCatalog();
    const text = catalog
      .map((p) => `- ${p.id}: ${p.name} by ${p.brand} (${p.category}) — ${p.description}`)
      .join("\n");
    const systemPrompt = `Organize a luxury catalog into 4-7 concise business categories (1-2 word Title Case names) derived from actual products. Assign every product id to exactly one category.

CATALOG:
${text}`;
    const parsed = await callAI(systemPrompt, "Group these products.", "build_categories", {
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
    });
    const validIds = new Set(catalog.map((p) => p.id));
    const categories: AICategory[] = ((parsed?.categories ?? []) as AICategory[])
      .map((c) => ({
        name: String(c.name).trim(),
        productIds: (c.productIds ?? []).filter((id) => validIds.has(id)),
      }))
      .filter((c) => c.name && c.productIds.length > 0);
    const out = { categories };
    await writeCache(cacheKey, out, ONE_WEEK_MS);
    return out;
  },
);

// ─── Text search ────────────────────────────────────────────────────
export const textSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string }) => {
    if (!input?.query || typeof input.query !== "string") throw new Error("query required");
    if (input.query.length > 200) throw new Error("query too long");
    return input;
  })
  .handler(async ({ data }): Promise<{ ids: string[] }> => {
    const catalog = await loadCatalog();
    const text = catalog
      .map((p) => `- ${p.id}: ${p.name} by ${p.brand} (${p.category}) — ${p.description}`)
      .join("\n");
    const systemPrompt = `You match a user's text query to products in a luxury catalog. The query may be a generic name, synonym, brand, category, or description in any language. Return ALL products of the same TYPE/FUNCTION as what the user asks for. If nothing matches, return [].

CATALOG:
${text}`;
    const parsed = await callAI(systemPrompt, `Query: ${data.query}`, "match_products", {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" } } },
      required: ["ids"],
      additionalProperties: false,
    });
    const validIds = new Set(catalog.map((p) => p.id));
    return { ids: ((parsed?.ids ?? []) as string[]).filter((id) => validIds.has(id)) };
  });

// ─── Visual search ──────────────────────────────────────────────────
export const visualSearch = createServerFn({ method: "POST" })
  .inputValidator((input: { imageDataUrl: string }) => {
    if (!input?.imageDataUrl || typeof input.imageDataUrl !== "string") throw new Error("imageDataUrl required");
    if (input.imageDataUrl.length > 8_000_000) throw new Error("Image too large");
    return input;
  })
  .handler(async ({ data }): Promise<{ matches: { id: string; reason: string; score: number }[]; description: string }> => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const catalog = await loadCatalog();
    const text = catalog
      .map((p) => `- ${p.id}: ${p.name} by ${p.brand} (${p.category}) — ${p.description}`)
      .join("\n");

    const systemPrompt = `You are a strict product matcher. Given an image, return ONLY products from the catalog that are the SAME TYPE of object with the SAME FUNCTION as what's in the image. Color/size may differ. Return [] if nothing matches.

CATALOG:
${text}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Match this image to products in the catalog." },
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
                  description: { type: "string" },
                  matches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        reason: { type: "string" },
                        score: { type: "number" },
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
      if (res.status === 429) throw new Error("Rate limit reached.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error("Visual search failed");
    }
    const json = await res.json();
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { matches: [], description: "" };
    try {
      const parsed = JSON.parse(args);
      const validIds = new Set(catalog.map((p) => p.id));
      return {
        description: parsed.description ?? "",
        matches: (parsed.matches ?? [])
          .filter((m: { id: string }) => validIds.has(m.id))
          .slice(0, 8),
      };
    } catch (e) {
      console.error("parse error", e);
      return { matches: [], description: "" };
    }
  });

// ─── Similar products ───────────────────────────────────────────────
export const similarProducts = createServerFn({ method: "POST" })
  .inputValidator((input: { productId: string }) => {
    if (!input?.productId) throw new Error("productId required");
    return input;
  })
  .handler(async ({ data }): Promise<SimilarResult> => {
    const cacheKey = `similar:v1:${data.productId}`;
    const cached = await readCache<SimilarResult>(cacheKey);
    if (cached) return cached;

    const catalog = await loadCatalog();
    const target = catalog.find((p) => p.id === data.productId);
    if (!target) return { ids: [] };
    const others = catalog.filter((p) => p.id !== data.productId);
    const text = others
      .map((p) => `- ${p.id}: ${p.name} by ${p.brand} (${p.category}) — ${p.description}`)
      .join("\n");
    const systemPrompt = `Pick the 4 products most similar to the target. Same TYPE/FUNCTION first, then style, then category. Color and size may differ.

TARGET:
- ${target.id}: ${target.name} by ${target.brand} (${target.category}) — ${target.description}

OTHER PRODUCTS:
${text}`;
    const parsed = await callAI(systemPrompt, "Pick 4 similar products.", "pick_similar", {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" }, maxItems: 4 } },
      required: ["ids"],
      additionalProperties: false,
    });
    const validIds = new Set(others.map((p) => p.id));
    const result: SimilarResult = {
      ids: ((parsed?.ids ?? []) as string[]).filter((id) => validIds.has(id)).slice(0, 4),
    };
    await writeCache(cacheKey, result, ONE_WEEK_MS);
    return result;
  });

// ─── Daily recommendations ──────────────────────────────────────────
export const recommendations = createServerFn({ method: "GET" }).handler(
  async (): Promise<RecommendResult> => {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `recommend:v1:${today}`;
    const cached = await readCache<RecommendResult>(cacheKey);
    if (cached) return cached;

    const catalog = await loadCatalog();
    const text = catalog
      .map((p) => `- ${p.id}: ${p.name} by ${p.brand} (${p.category}) — ${p.description}`)
      .join("\n");
    const systemPrompt = `Curate a daily 'Recommended for You' set of 6 luxury products that work well together as a story. Choose a brief evocative theme (3-5 words). Mix categories.

CATALOG:
${text}`;
    const parsed = await callAI(systemPrompt, "Curate today's recommendations.", "recommend", {
      type: "object",
      properties: {
        theme: { type: "string" },
        ids: { type: "array", items: { type: "string" }, maxItems: 6 },
      },
      required: ["theme", "ids"],
      additionalProperties: false,
    });
    const validIds = new Set(catalog.map((p) => p.id));
    const result: RecommendResult = {
      theme: parsed?.theme ?? "Recommended for You",
      ids: ((parsed?.ids ?? []) as string[]).filter((id) => validIds.has(id)).slice(0, 6),
    };
    await writeCache(cacheKey, result, ONE_DAY_MS);
    return result;
  },
);

// ─── Log user interest (view / search) ─────────────────────────────
// No auth middleware: silently no-op when unauthenticated to avoid throwing
// Response objects that surface as "[object Response]" runtime errors.
export const logInterest = createServerFn({ method: "POST" })
  .inputValidator((input: { kind: "view" | "search"; productId?: string; query?: string }) => {
    if (input.kind !== "view" && input.kind !== "search") return { kind: "search" as const };
    if (input.query && input.query.length > 200) {
      return { ...input, query: input.query.slice(0, 200) };
    }
    return input;
  })
  .handler(async ({ data }) => {
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return { ok: false };

      const authHeader = (await import("@tanstack/react-start/server")).getRequestHeader("authorization");
      if (!authHeader?.startsWith("Bearer ")) return { ok: false };
      const token = authHeader.slice(7);

      const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: claims } = await sb.auth.getClaims(token);
      const userId = claims?.claims?.sub;
      if (!userId) return { ok: false };

      if (data.kind === "view" && !data.productId) return { ok: false };
      if (data.kind === "search" && !data.query) return { ok: false };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (sb as any).from("user_interests").insert({
        user_id: userId,
        kind: data.kind,
        product_id: data.productId ?? null,
        query: data.query ?? null,
      });
      return { ok: true };
    } catch (e) {
      console.error("logInterest error", e);
      return { ok: false };
    }
  });

// ─── Personalized feed: 40% biased toward user's interests ─────────
export const personalizedFeed = createServerFn({ method: "POST" })
  .inputValidator((input: { allIds: string[]; viewedIds?: string[]; queries?: string[] }) => {
    if (!Array.isArray(input?.allIds)) throw new Error("allIds required");
    return {
      allIds: input.allIds,
      viewedIds: Array.isArray(input.viewedIds) ? input.viewedIds.filter((id) => typeof id === "string") : [],
      queries: Array.isArray(input.queries) ? input.queries.filter((q) => typeof q === "string") : [],
    };
  })
  .handler(async ({ data }): Promise<{ orderedIds: string[]; biasedIds: string[] }> => {
    if (data.viewedIds.length === 0 && data.queries.length === 0) {
      return { orderedIds: shuffle(data.allIds), biasedIds: [] };
    }

    const catalog = await loadCatalog();
    const summary = catalog
      .filter((p) => data.allIds.includes(p.id))
      .map((p) => `- ${p.id}: ${p.name} (${p.category}) — ${p.description}`)
      .join("\n");

    const viewedSummary = catalog
      .filter((p) => data.viewedIds.includes(p.id))
      .map((p) => `- ${p.name} (${p.category})`)
      .join("\n");

    const systemPrompt = `Pick which products from the CATALOG best match a user's recent interests. Prefer products of the same TYPE/FUNCTION as ones they've viewed and matching their recent searches. Return up to 12 ids ranked by relevance.

USER VIEWED:
${viewedSummary || "(none)"}

USER SEARCHED:
${data.queries.join(", ") || "(none)"}

CATALOG:
${summary}`;

    const parsed = await callAI(systemPrompt, "Rank products for this user.", "rank_products", {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" } } },
      required: ["ids"],
      additionalProperties: false,
    });

    const validSet = new Set(data.allIds);
    const biasedIds = ((parsed?.ids ?? []) as string[]).filter((id) => validSet.has(id)).slice(0, 12);
    const biasedSet = new Set(biasedIds);
    const rest = shuffle(data.allIds.filter((id) => !biasedSet.has(id)));
    const total = data.allIds.length;
    const targetBiased = Math.min(biasedIds.length, Math.floor(total * 0.4));
    const ordered: string[] = [];
    let bi = 0;
    let ri = 0;

    for (let i = 0; i < total; i++) {
      const placeBiased = bi < targetBiased && (i % Math.max(1, Math.floor(total / Math.max(1, targetBiased))) === 0);
      if (placeBiased) ordered.push(biasedIds[bi++]);
      else if (ri < rest.length) ordered.push(rest[ri++]);
      else if (bi < biasedIds.length) ordered.push(biasedIds[bi++]);
    }

    while (ordered.length < total && bi < biasedIds.length) ordered.push(biasedIds[bi++]);
    while (ordered.length < total && ri < rest.length) ordered.push(rest[ri++]);

    return { orderedIds: ordered, biasedIds };
  });

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
