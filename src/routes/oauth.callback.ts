import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const target = new URL("/callback", url.origin);
        target.search = url.search;
        return new Response(null, {
          status: 302,
          headers: {
            Location: target.toString(),
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
