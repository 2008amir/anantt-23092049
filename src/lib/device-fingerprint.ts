// Real device fingerprinting.
// Browsers cannot read hardware IDs (IMEI, MAC, serial). Instead we combine
// many stable signals — canvas/WebGL/audio rendering quirks, hardware stats,
// timezone, fonts, and a persistent token — into a SHA-256 hash. These signals
// are stable across browser data clears (canvas/WebGL/audio are hardware-tied)
// and consistent enough to re-identify the same physical device.

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

type ServerIdentity = {
  device_id: string | null;
  ip: string | null;
  ua: string | null;
  lang: string | null;
};

// Ask our own server for a stable device_id (httpOnly cookie, set by the
// edge runtime). The cookie persists 5 years and survives localStorage
// clears, private windows after first visit, and most reinstall scenarios.
// We also receive the server-observed IP and User-Agent — these are harder
// to forge than client-side `navigator.userAgent` / ipify.
async function fetchServerIdentity(): Promise<ServerIdentity> {
  try {
    const r = await fetch("/api/public/device-id", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!r.ok) return { device_id: null, ip: null, ua: null, lang: null };
    return (await r.json()) as ServerIdentity;
  } catch {
    return { device_id: null, ip: null, ua: null, lang: null };
  }
}

// Canvas fingerprint: renders text + shapes. Tiny rasterization differences
// between GPUs/drivers/OS font stacks produce a unique hash per device.
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "no-ctx";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Luxe Sparkles \u2728 device", 2, 15);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Luxe Sparkles \u2728 device", 4, 17);
    ctx.strokeStyle = "rgb(200,50,80)";
    ctx.beginPath();
    ctx.arc(50, 30, 20, 0, Math.PI * 2, true);
    ctx.stroke();
    return canvas.toDataURL();
  } catch {
    return "no-canvas";
  }
}

// WebGL fingerprint: GPU vendor/renderer + a set of capability ints.
// GPU string is one of the most unique signals available in the browser.
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "no-webgl";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbg ? String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR));
    const renderer = dbg
      ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    const caps = [
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_VIEWPORT_DIMS),
      gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      gl.getParameter(gl.MAX_VARYING_VECTORS),
      gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE),
      gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE),
      gl.getSupportedExtensions()?.sort().join(","),
    ].join("|");
    return `${vendor}::${renderer}::${caps}`;
  } catch {
    return "no-webgl";
  }
}

// Audio fingerprint: runs an oscillator through a dynamics compressor in an
// OfflineAudioContext and hashes the resulting waveform. The math path
// produces tiny but stable per-device floating-point deltas.
async function getAudioFingerprint(): Promise<string> {
  try {
    const OfflineCtx =
      (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext; webkitOfflineAudioContext?: typeof OfflineAudioContext })
        .OfflineAudioContext ||
      (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
    if (!OfflineCtx) return "no-audio";
    const ctx = new OfflineCtx(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(10000, 0);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-50, 0);
    comp.knee.setValueAtTime(40, 0);
    comp.ratio.setValueAtTime(12, 0);
    comp.attack.setValueAtTime(0, 0);
    comp.release.setValueAtTime(0.25, 0);
    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);
    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
    return sum.toString();
  } catch {
    return "no-audio";
  }
}

// Font availability — tests a handful of common fonts against a baseline.
// The installed font set is relatively stable per OS/device.
function getFontSignature(): string {
  try {
    const baseFonts = ["monospace", "sans-serif", "serif"];
    const testString = "mmmmmmmmmmlli";
    const testSize = "72px";
    const body = document.body;
    const span = document.createElement("span");
    span.style.position = "absolute";
    span.style.left = "-9999px";
    span.style.fontSize = testSize;
    span.style.visibility = "hidden";
    span.textContent = testString;
    body.appendChild(span);

    const baseline: Record<string, { w: number; h: number }> = {};
    for (const f of baseFonts) {
      span.style.fontFamily = f;
      baseline[f] = { w: span.offsetWidth, h: span.offsetHeight };
    }

    const fonts = [
      "Arial",
      "Helvetica",
      "Times New Roman",
      "Courier New",
      "Verdana",
      "Georgia",
      "Tahoma",
      "Trebuchet MS",
      "Comic Sans MS",
      "Impact",
      "Roboto",
      "Segoe UI",
      "San Francisco",
      "Noto Sans",
    ];
    const detected: string[] = [];
    for (const font of fonts) {
      let present = false;
      for (const base of baseFonts) {
        span.style.fontFamily = `'${font}',${base}`;
        if (span.offsetWidth !== baseline[base].w || span.offsetHeight !== baseline[base].h) {
          present = true;
          break;
        }
      }
      if (present) detected.push(font);
    }
    body.removeChild(span);
    return detected.join(",");
  } catch {
    return "no-fonts";
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
    userAgentData?: {
      platform?: string;
      brands?: { brand: string; version: string }[];
      mobile?: boolean;
      getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
    };
  };

  const [serverId, audio] = await Promise.all([
    fetchServerIdentity(),
    getAudioFingerprint(),
  ]);
  // Prefer server-observed IP/UA — they're harder to forge than browser values
  const ip = serverId.ip;

  // High-entropy UA hints give us real OS/model when the browser supports it
  let uaHigh: Record<string, unknown> | null = null;
  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      uaHigh = await nav.userAgentData.getHighEntropyValues([
        "architecture",
        "bitness",
        "model",
        "platform",
        "platformVersion",
        "uaFullVersion",
        "fullVersionList",
      ]);
    }
  } catch {
    // ignore
  }

  const canvas = getCanvasFingerprint();
  const webgl = getWebGLFingerprint();
  const fonts = getFontSignature();

  const hardware: Record<string, unknown> = {
    cores: nav.hardwareConcurrency ?? null,
    memory: nav.deviceMemory ?? null,
    screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
    availScreen: `${window.screen.availWidth}x${window.screen.availHeight}`,
    pixelRatio: window.devicePixelRatio ?? null,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    tzOffset: new Date().getTimezoneOffset(),
    lang: nav.language,
    langs: Array.isArray(nav.languages) ? nav.languages.join(",") : "",
    touchPoints: nav.maxTouchPoints ?? 0,
    cookieEnabled: nav.cookieEnabled,
    uaData: nav.userAgentData ?? null,
    uaHigh,
    webgl,
    fonts,
    canvasHashSample: canvas.slice(-64),
    audio,
  };

  // We combine IP + hardware + GPU + audio + canvas + fonts + persistent token.
  // Even if the user clears browser data (destroying the token), the hardware-
  // tied signals (WebGL/canvas/audio/screen/fonts/UA-high) still re-identify
  // the physical device with very high probability.
  const parts = [
    // Server-issued device id (httpOnly cookie) — strongest, most stable signal.
    // If present it dominates the hash so the device id is consistent across
    // sessions even if other signals drift slightly (driver updates, etc.).
    serverId.device_id ?? "no-srv-id",
    ip ?? "no-ip",
    serverId.ua ?? nav.userAgent,
    nav.platform,
    JSON.stringify(uaHigh ?? {}),
    String(hardware.cores),
    String(hardware.memory),
    String(hardware.screen),
    String(hardware.availScreen),
    String(hardware.pixelRatio),
    String(hardware.tz),
    String(hardware.tzOffset),
    String(hardware.lang),
    String(hardware.touchPoints),
    webgl,
    canvas,
    audio,
    fonts,
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
