// src/routes/~oauth/initiate.ts
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/~oauth/initiate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const provider = url.searchParams.get("provider");
        const state = url.searchParams.get("state") || "";
        // If your app uses a different env prefix (VITE_, NEXT_PUBLIC_), update below
        const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
        const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI;

        if (!GOOGLE_CLIENT_ID || !GOOGLE_OAUTH_REDIRECT_URI) {
          return new Response("Google OAuth environment variable(s) not set", { status: 500 });
        }

        if (provider !== "google") {
          return new Response("Provider not supported", { status: 400 });
        }

        // Construct Google OAuth URL
        const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        oauthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
        oauthUrl.searchParams.set("redirect_uri", GOOGLE_OAUTH_REDIRECT_URI);
        oauthUrl.searchParams.set("response_type", "code");
        oauthUrl.searchParams.set("scope", "openid email profile");
        oauthUrl.searchParams.set("state", state);

        return Response.redirect(oauthUrl.toString(), 302);
      }
    }
  }
});
