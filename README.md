# Frontend-only Google Sign-In

Google login now runs fully in the browser with `@react-oauth/google`.

## Required environment variable

Set one public client ID variable:

- `VITE_GOOGLE_CLIENT_ID` (preferred for Vite)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (fallback)

## Where it is implemented

- `src/components/GoogleSignInButton.tsx`
- `src/routes/login.tsx`

The login page uses Google Identity Services directly in the frontend and receives a Google ID token (JWT) in-browser. A sample usage is included in the UI:

- The JWT is displayed after successful Google sign-in.
- A console log stub is included to show where client-side handling happens.

No backend OAuth routes are used for Google login.
