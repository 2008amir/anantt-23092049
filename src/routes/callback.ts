import { createFileRoute } from "@tanstack/react-router";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function htmlMessage(title: string, details: string, status = 200) {
  const safeTitle = escapeHtml(title);
  const safeDetails = escapeHtml(details);
  const body = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;line-height:1.5">
    <h1 style="font-size:20px;margin:0 0 8px">${safeTitle}</h1>
    <p style="margin:0">${safeDetails}</p>
    <p style="margin-top:16px"><a href="/login">Return to login</a></p>
  </body>
</html>`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const oauthError = url.searchParams.get("error");
        const oauthErrorDescription = url.searchParams.get("error_description");
        const code = url.searchParams.get("code");

        if (oauthError) {
          const message = oauthErrorDescription?.trim() || oauthError;
          return htmlMessage("Google sign-in failed", message, 400);
        }
        if (!code) {
          return htmlMessage(
            "Google sign-in failed",
            "Missing OAuth code in callback request.",
            400,
          );
        }

        const clientId = process.env.GOOGLE_CLIENT_ID ?? process.env.CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? process.env.CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI ?? process.env.OAUTH_REDIRECT_URI;
        if (!clientId || !clientSecret || !redirectUri) {
          console.error("[oauth] missing OAuth environment variables");
          return htmlMessage(
            "Google sign-in failed",
            "OAuth is not configured on the server.",
            500,
          );
        }

        try {
          const body = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          });
          const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });
          const tokenJson = (await tokenResponse.json().catch((parseError) => {
            console.error("[oauth] token response parse error", parseError);
            return {};
          })) as {
            access_token?: string;
            id_token?: string;
            error?: string;
            error_description?: string;
          };

          if (!tokenResponse.ok || (!tokenJson.access_token && !tokenJson.id_token)) {
            console.error("[oauth] token exchange failed", {
              status: tokenResponse.status,
              error: tokenJson.error,
              errorDescription: tokenJson.error_description,
            });
            const message =
              tokenJson.error_description || tokenJson.error || "Token exchange failed.";
            return htmlMessage("Google sign-in failed", message, 400);
          }

          return htmlMessage(
            "Google sign-in callback received",
            "OAuth callback is configured and working. You can now return to the app.",
          );
        } catch (error) {
          console.error("[oauth] callback error", error);
          return htmlMessage(
            "Google sign-in failed",
            "Could not contact Google OAuth service. Please try again.",
            502,
          );
        }
      },
    },
  },
});
