import { createFileRoute } from "@tanstack/react-router";
import {
  buildGoogleAuthorizeUrl,
  getGoogleOAuthConfig,
  htmlMessage,
} from "@/lib/google-oauth.server";

export const Route = createFileRoute("/~oauth/initiate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const provider = url.searchParams.get("provider") ?? "google";
        const state = url.searchParams.get("state") ?? "";
        if (provider !== "google") {
          return htmlMessage("Sign-in failed", "Unsupported OAuth provider.", 400);
        }

        const { clientId, redirectUri } = getGoogleOAuthConfig();
        if (!clientId || !redirectUri) {
          return htmlMessage(
            "Google sign-in unavailable",
            "OAuth is not configured on the server.",
            500,
          );
        }

        const oauthUrl = buildGoogleAuthorizeUrl({ clientId, redirectUri, state });
        return Response.redirect(oauthUrl.toString(), 302);
      },
    },
  },
});
