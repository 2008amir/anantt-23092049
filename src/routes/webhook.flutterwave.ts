import { createFileRoute, redirect } from "@tanstack/react-router";

// Friendly alias so you can configure Flutterwave with the cleaner URL:
//   https://luxesparkles.codebreakers.uk/webhook/flutterwave
// It forwards (308 — preserves POST + body) to the real handler at
// /api/public/flutterwave-webhook.
export const Route = createFileRoute("/webhook/flutterwave")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const target = `${url.origin}/api/public/flutterwave-webhook`;
        return new Response(null, {
          status: 308,
          headers: { Location: target },
        });
      },
      GET: async () => {
        throw redirect({ to: "/" });
      },
    },
  },
});
