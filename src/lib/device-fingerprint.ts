// Best-effort browser device fingerprint. A browser cannot access true hardware
// identifiers (IMEI, serial, MAC), so we combine stable signals:
// user-agent, platform, hardware concurrency, device memory, screen geometry,
// timezone, language, and a persisted random token. The resulting hash is
// stored server-side; repeat signups from the same device are detected.

export type DeviceSignals = {
  fingerprint: string;
  ip: string | null;
  user_agent: string;
  platform: string;
  hardware: Record<string, unknown>;
};

const LOCAL_TOKEN_KEY = "ml_dev_tkn";

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getPersistentToken(): string {
  try {
    let tok = localStorage.getItem(LOCAL_TOKEN_KEY);
    if (!tok) {
      tok = crypto.randomUUID();
      localStorage.setItem(LOCAL_TOKEN_KEY, tok);
    }
    return tok;
  } catch {
    return "no-storage";
  }
}

async function fetchIP(): Promise<string | null> {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    if (!r.ok) return null;
    const j = (await r.json()) as { ip?: string };
    return j.ip ?? null;
  } catch {
    return null;
  }
}

export async function collectDeviceSignals(): Promise<DeviceSignals> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      fingerprint: "ssr",
      ip: null,
      user_agent: "",
      platform: "",
      hardware: {},
    };
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    userAgentData?: { platform?: string; brands?: { brand: string; version: string }[]; mobile?: boolean };
  };
  const ip = await fetchIP();

  const hardware: Record<string, unknown> = {
    cores: nav.hardwareConcurrency ?? null,
    memory: nav.deviceMemory ?? null,
    screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    pixelRatio: window.devicePixelRatio ?? null,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: nav.language,
    uaData: nav.userAgentData ?? null,
  };

  // Combine signals. IP gives a network component (harder to spoof together
  // with hardware). Persistent token helps when two identical devices share
  // an IP — it stays across signups on the same browser profile.
  const parts = [
    ip ?? "no-ip",
    nav.userAgent,
    nav.platform,
    String(hardware.cores),
    String(hardware.memory),
    String(hardware.screen),
    String(hardware.pixelRatio),
    String(hardware.tz),
    String(hardware.lang),
    JSON.stringify(hardware.uaData ?? {}),
    getPersistentToken(),
  ];
  const fingerprint = await sha256(parts.join("|"));

  return {
    fingerprint,
    ip,
    user_agent: nav.userAgent,
    platform: nav.platform,
    hardware,
  };
}
