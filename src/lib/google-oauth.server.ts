type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function envValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  return {
    clientId: envValue(
      "GOOGLE_CLIENT_ID",
      "CLIENT_ID",
      "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
      "VITE_GOOGLE_CLIENT_ID",
    ),
    clientSecret: envValue("CLIENT_SECRET", "GOOGLE_CLIENT_SECRET"),
    redirectUri: envValue(
      "GOOGLE_OAUTH_REDIRECT_URI",
      "REDIRECT_URI",
      "OAUTH_REDIRECT_URI",
      "NEXT_PUBLIC_GOOGLE_OAUTH_REDIRECT_URI",
      "VITE_GOOGLE_OAUTH_REDIRECT_URI",
    ),
  };
}

export function htmlMessage(title: string, details: string, status = 200) {
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

export function buildGoogleAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  state?: string;
}) {
  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", opts.clientId);
  oauthUrl.searchParams.set("redirect_uri", opts.redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", "openid email profile");
  oauthUrl.searchParams.set("access_type", "offline");
  oauthUrl.searchParams.set("prompt", "select_account");
  if (opts.state) oauthUrl.searchParams.set("state", opts.state);
  return oauthUrl;
}

export async function handleGoogleOAuthCallback(request: Request) {
  const url = new URL(request.url);
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

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

  const { clientId, clientSecret, redirectUri } = getGoogleOAuthConfig();
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

    if (tokenJson.id_token) {
      const loginUrl = new URL("/login", url.origin);
      const hashParams = new URLSearchParams();
      hashParams.set("id_token", tokenJson.id_token);
      hashParams.set("provider", "google");
      if (state) hashParams.set("state", state);
      loginUrl.hash = hashParams.toString();
      return new Response(null, {
        status: 302,
        headers: {
          Location: loginUrl.toString(),
          "Cache-Control": "no-store",
        },
      });
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
}
