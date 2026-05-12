# OAuth initiate route notes

## Route location

The Google OAuth start route is implemented as a TanStack file route at:

- `src/routes/~oauth.initiate.ts` → `GET /~oauth/initiate`

## Required environment variables

Preferred server variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_OAUTH_REDIRECT_URI`

Supported fallbacks:

- `CLIENT_ID`
- `REDIRECT_URI`
- `OAUTH_REDIRECT_URI`

Client-only public variables used by the login UI:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `VITE_GOOGLE_CLIENT_ID`

## Deployment note (Vercel/serverless)

`/~oauth/initiate` is a server route and must be handled by a server runtime.
If deploying to Vercel, avoid SPA-only mode for OAuth routes. Use a server adapter/runtime
(for example Nitro as documented by TanStack Start) so requests to `/~oauth/initiate`
are executed server-side instead of returning a static fallback.
