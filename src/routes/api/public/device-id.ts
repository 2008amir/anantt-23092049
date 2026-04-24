// Server-issued device identity. Sets a long-lived httpOnly cookie so the
// device id survives even if the user clears localStorage, and returns the
// real client IP + UA observed by the server (hard for the browser to forge).
import { createFileRoute } from "@tanstack/react-router";
import {
  getCookie,
  setCookie,
  getRequestIP,
  getRequestHeader,
} from "@tanstack/react-start/server";

const COOKIE = "ml_dev_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

function uuid(): string {
  // Web crypto is available on the Worker runtime
  return crypto.randomUUID();
}

export const Route = createFileRoute("/api/public/device-id")({
  server: {
    handlers: {
      GET: async () => {
        let id = getCookie(COOKIE);
        if (!id) {
          id = uuid();
          setCookie(COOKIE, id, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: ONE_YEAR * 5,
          });
        }
        const ip = getRequestIP({ xForwardedFor: true }) ?? null;
        const ua = getRequestHeader("user-agent") ?? null;
        const lang = getRequestHeader("accept-language") ?? null;
        return Response.json(
          { device_id: id, ip, ua, lang },
          {
            headers: {
              "Cache-Control": "private, no-store",
            },
          },
        );
      },
    },
  },
});
