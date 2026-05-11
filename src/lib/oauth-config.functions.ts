import { createServerFn } from "@tanstack/react-start";

export const getOAuthRedirectUri = createServerFn({ method: "GET" }).handler(async () => {
  return {
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI ?? process.env.OAUTH_REDIRECT_URI ?? "",
  };
});
