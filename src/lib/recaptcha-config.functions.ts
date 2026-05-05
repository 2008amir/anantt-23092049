import { createServerFn } from "@tanstack/react-start";

export const getRecaptchaSiteKey = createServerFn({ method: "GET" }).handler(async () => {
  return { siteKey: process.env.RECAPTCHA_V2_SITE_KEY ?? "" };
});
