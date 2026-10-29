// Copies named variables from the local .env to the Render service, one key at a time, without ever
// printing their values. It never replaces the whole list (the Render "set all" call would wipe the
// keys left out). Values that are not secrets can also be given inline as KEY=value.
//   node --env-file=.env scripts/render-env.mjs SUPABASE_DB_URL MEMORABLE_AI_KEY
//   node --env-file=.env scripts/render-env.mjs --from-file MEMORAVEL_CREDENTIALS_KEY=.runtime/credentials.key
//   node --env-file=.env scripts/render-env.mjs --deploy SUPABASE_DB_URL      → also redeploys
import fs from "node:fs";

const SERVICE = process.env.RENDER_SERVICE_ID || "srv-dbhc7uo473hc739iuv6g";
const token = process.env.RENDER_API_KEY;
if (!token) throw new Error("RENDER_API_KEY ausente no .env.");
const args = process.argv.slice(2);
const deploy = args.includes("--deploy");
const fromFile = args.includes("--from-file");
const names = args.filter((a) => !a.startsWith("--"));
if (!names.length) throw new Error("Informe ao menos uma variável.");

const api = (path, init = {}) =>
  fetch(`https://api.render.com/v1/services/${SERVICE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
  });

for (const item of names) {
  const [key, inline] = item.split(/=(.*)/s);
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error(`Nome inválido: ${key}`);
  if (key.startsWith("RENDER_")) throw new Error("A chave do próprio Render não vai para o serviço.");
  // --from-file KEY=path: a 32-byte binary key file, sent as hex (MEMORAVEL_CREDENTIALS_KEY).
  const value = fromFile && inline ? fs.readFileSync(inline).toString("hex") : inline ?? process.env[key];
  if (!value?.trim()) throw new Error(`${key} está vazia no .env.`);
  const response = await api(`/env-vars/${key}`, { method: "PUT", body: JSON.stringify({ value: value.trim() }) });
  console.log(`${key.padEnd(28)} ${response.ok ? "atualizada no Render" : `falhou (HTTP ${response.status})`}`);
  if (!response.ok) process.exitCode = 1;
}

if (deploy && !process.exitCode) {
  const response = await api("/deploys", { method: "POST", body: JSON.stringify({ clearCache: "do_not_clear" }) });
  const body = await response.json().catch(() => ({}));
  console.log(response.ok ? `Deploy iniciado: ${body.id}` : `Deploy não iniciou (HTTP ${response.status}).`);
}
