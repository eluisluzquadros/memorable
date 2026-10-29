// Where the service runs. Locally nothing needs to be set; in the cloud (Render) the platform sets PORT
// and we set MEMORAVEL_PUBLIC_URL (https://app.memoravel.org) and MEMORAVEL_CREDENTIALS_KEY.
const publicUrl = (process.env.MEMORAVEL_PUBLIC_URL || "").replace(/\/+$/, "");

export const PORT = Number(process.env.PORT) || 5174;
// A cloud host must listen on every interface; on a laptop the service stays private to the machine.
export const HOST = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
// The address people open: the Vite dev server locally, the public domain in the cloud.
export const APP_ORIGIN = publicUrl || "http://localhost:5173";
// The address of this service as seen from outside (OAuth callbacks land here).
export const SERVICE_ORIGIN = publicUrl || `http://localhost:${PORT}`;
export const ALLOWED_ORIGINS = publicUrl
  ? [publicUrl]
  : ["http://localhost:5173", "http://127.0.0.1:5173", `http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
// Browsers drop cookies without Secure on https sites behind a proxy only when asked to; set it whenever public.
export const SECURE_COOKIES = APP_ORIGIN.startsWith("https://");

// Behind Cloudflare and Render the socket address is the proxy's, so login throttling would lump every
// visitor together. In the cloud, trust the visitor address the proxies forward.
export function clientAddress(req) {
  if (!process.env.PORT) return req.socket.remoteAddress;
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
  return req.headers["cf-connecting-ip"] || forwarded[0] || req.socket.remoteAddress;
}

export const cookie = (name, token) =>
  `${name}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? 604800 : 0}${SECURE_COOKIES ? "; Secure" : ""}`;

// The key that encrypts saved provider credentials: 32 bytes as hex or base64. Without it, the local file is used.
export function credentialsKey() {
  const raw = process.env.MEMORAVEL_CREDENTIALS_KEY?.trim();
  if (!raw) return null;
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("MEMORAVEL_CREDENTIALS_KEY deve ter 32 bytes (64 caracteres hex ou base64).");
  return key;
}
