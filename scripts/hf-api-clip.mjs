// Generates one clip through the Higgsfield platform API (api.higgsfield.ai), waits for it and saves the mp4.
// The key (HF_API_KEY_ID / HF_API_KEY_SECRET in .env) is read from the environment and never printed.
//   node --env-file=.env scripts/hf-api-clip.mjs <endpoint> <out.mp4> <prompt-file> [--duration 5] [--aspect 9:16] [--resolution 720p]
//   --poll <request_id>   only waits for a request already sent (no new charge) and saves the result
//   endpoint example: alibaba/happy-horse/v1.1/text-to-video
// Prints: request id, seconds waited and the fields the status answer carries, so a cost field would show up.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const [endpoint, out, promptFile] = args;
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
if (!endpoint || !out || !promptFile) throw new Error("Uso: hf-api-clip.mjs <endpoint> <saida.mp4> <arquivo-do-prompt>");
const id = process.env.HF_API_KEY_ID, secret = process.env.HF_API_KEY_SECRET;
if (!id || !secret) throw new Error("HF_API_KEY_ID e HF_API_KEY_SECRET ausentes no .env.");
// The secret variable may already hold the whole "ID:SECRET" pair (the platform accepts both layouts).
const key = secret.includes(":") ? secret : `${id}:${secret}`;
const headers = { Authorization: `Key ${key}`, "Content-Type": "application/json" };
const body = { prompt: fs.readFileSync(promptFile, "utf8").trim(), duration: Number(opt("duration", 5)), aspect_ratio: opt("aspect", "9:16") };
if (opt("resolution", "")) body.resolution = opt("resolution", "");

const submitted = Date.now();
const polling = opt("poll", "");
const response = polling ? { ok: true, status: 200, json: async () => ({ request_id: polling }) } : await fetch(`https://api.higgsfield.ai/${endpoint}`, { method: "POST", headers: { ...headers, "Idempotency-Key": randomUUID() }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) });
const first = await response.json().catch(() => ({}));
console.log("envio:", response.status, JSON.stringify({ ...first, prompt: undefined }).slice(0, 400));
if (!response.ok || !first.request_id) process.exit(2);
let status;
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 4000));
  status = await (await fetch(first.status_url || `https://api.higgsfield.ai/requests/${first.request_id}/status`, { headers })).json();
  if (["completed", "failed", "nsfw", "canceled"].includes(status.status)) break;
}
const seconds = Math.round((Date.now() - submitted) / 1000);
console.log(`estado final: ${status?.status} após ${seconds}s · campos: ${Object.keys(status || {}).join(", ")}`);
const costFields = Object.entries(status || {}).filter(([k]) => /cost|credit|price|usage/i.test(k));
if (costFields.length) console.log("custo informado:", JSON.stringify(costFields));
const url = status?.video?.url;
if (status?.status === "completed" && url) {
  const data = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, data);
  console.log(`salvo: ${out} (${(data.length / 1024).toFixed(0)} KB) · tempo total ${seconds}s`);
} else {
  console.log("sem vídeo:", JSON.stringify(status).slice(0, 300));
  process.exit(3);
}
