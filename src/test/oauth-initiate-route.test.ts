import { beforeEach, describe, expect, it, vi } from "vitest";

type RouteConfig = {
  server?: {
    handlers?: {
      GET?: (ctx: { request: Request }) => Promise<Response> | Response;
    };
  };
};

let capturedRouteConfig: RouteConfig | undefined;

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: RouteConfig) => {
    capturedRouteConfig = config;
    return {};
  },
}));

describe("/~oauth/initiate route", () => {
  beforeEach(() => {
    capturedRouteConfig = undefined;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns a 302 redirect to Google OAuth for provider=google", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "example-google-client-id");
    vi.stubEnv("GOOGLE_OAUTH_REDIRECT_URI", "https://app.example.com/oauth/callback");

    await import("../routes/~oauth.initiate");
    const handler = capturedRouteConfig?.server?.handlers?.GET;
    expect(handler).toBeTypeOf("function");

    const response = await handler!({
      request: new Request(
        "https://app.example.com/~oauth/initiate?provider=google&state=test-state",
      ),
    });

    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toBeTruthy();
    const oauthUrl = new URL(location!);
    expect(oauthUrl.origin).toBe("https://accounts.google.com");
    expect(oauthUrl.pathname).toBe("/o/oauth2/v2/auth");
    expect(oauthUrl.searchParams.get("client_id")).toBe("example-google-client-id");
    expect(oauthUrl.searchParams.get("redirect_uri")).toBe(
      "https://app.example.com/oauth/callback",
    );
    expect(oauthUrl.searchParams.get("state")).toBe("test-state");
  });
});
