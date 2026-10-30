// Copies a brand's context (brand DNA, voice, audience and sources) from one account's brand into another
// account's brand, renaming the brand in the text. It saves reading references and extracting the DNA again
// (paid model calls) when a test needs a realistic brand.
//   node --env-file=.env scripts/clone-brand.mjs --cloud --from-email a@x --from-brand "Esfera Legal" \
//        --to-email b@y --to-brand "Escritório de advocacia" --names "Esfera Legal,Esfera.Legal=Escritório de advocacia" \
//        --short "Esfera=Escritório" [--alias Escritório] [--apply]
// Simulation by default. The target brand's previous DNA, voice and sources are replaced; the destination
// account document is backed up (account_state_backups and .runtime/backups) before it is written.
// Names are replaced in text only: URLs and the origin of each source keep pointing where the text came from.
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name, fallback = "") => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
if (!args.includes("--cloud")) throw new Error("Este script age na produção: rode com --cloud.");
process.env.MEMORAVEL_DB = "postgres";
const apply = args.includes("--apply");
const [fromEmail, fromBrand, toEmail, toBrand] = ["from-email", "from-brand", "to-email", "to-brand"].map((n) => opt(n));
if (![fromEmail, fromBrand, toEmail, toBrand].every(Boolean)) throw new Error("Informe --from-email, --from-brand, --to-email e --to-brand.");
// "A,B=Novo" → every A and B becomes Novo; longer names first so "Esfera Legal" wins over "Esfera".
const rules = [];
for (const spec of [opt("names"), opt("short")].filter(Boolean)) {
  const [olds, news] = spec.split("=");
  for (const old of olds.split(",")) rules.push([old.trim(), news.trim()]);
}
rules.sort((a, b) => b[0].length - a[0].length);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = rules.length ? new RegExp(`(${rules.map(([o]) => escape(o)).join("|")})`, "g") : null;
const rename = (text) => (pattern ? text.replace(pattern, (m) => rules.find(([o]) => o === m)[1]) : text);
const KEEP_KEYS = new Set(["url", "origin", "id", "workspace", "channel", "sourceIds", "sourceKind", "method", "fileName"]);
const URLISH = /^(https?:\/\/|www\.)/i;
let replaced = 0;
function walk(value, key = "") {
  if (typeof value === "string") {
    if (KEEP_KEYS.has(key) || URLISH.test(value)) return value;
    const next = rename(value);
    if (next !== value) replaced++;
    return next;
  }
  if (Array.isArray(value)) return value.map((v) => walk(v, key));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
  return value;
}

const { openDb, closePool } = await import("../server/sql.mjs");
const db = openDb();
const load = async (email) => {
  const user = await db.get("SELECT id, email FROM users WHERE email = ?", email.toLowerCase());
  if (!user) throw new Error(`Conta não encontrada: ${email}`);
  const row = await db.get("SELECT document, revision FROM account_state WHERE user_id = ?", user.id);
  return { user, revision: row.revision, raw: row.document, doc: JSON.parse(row.document) };
};
try {
  const from = await load(fromEmail), to = await load(toEmail);
  const source = from.doc.workspaces.find((w) => w.name === fromBrand);
  const target = to.doc.workspaces.find((w) => w.name === toBrand);
  if (!source) throw new Error(`Marca de origem não encontrada: ${fromBrand}`);
  if (!target) throw new Error(`Marca de destino não encontrada: ${toBrand}`);

  const dna = walk(from.doc.brandDNA?.[source.id] ?? null);
  const voice = walk(from.doc.voices?.[source.id] ?? null);
  const sources = from.doc.sources.filter((s) => s.workspace === source.id).map((s) => ({ ...walk(s), id: randomUUID(), workspace: target.id, shared: false }));
  const leftovers = JSON.stringify({ dna, voice, sources: sources.map(({ url, origin, ...rest }) => rest) });
  const left = Object.fromEntries(rules.map(([old]) => [old, (leftovers.match(new RegExp(escape(old), "g")) || []).length]));
  console.log(`De: ${fromEmail} · ${source.name}  →  Para: ${toEmail} · ${target.name} (rev ${to.revision})`);
  console.log(`Copia: DNA (${JSON.stringify(dna).length} bytes), voz, público, ${sources.length} fonte(s): ${sources.map((s) => s.title.slice(0, 40)).join(" | ")}`);
  console.log(`Trechos de texto renomeados: ${replaced}. Nomes antigos que sobraram no texto copiado:`, JSON.stringify(left));
  console.log(`Substitui no destino: DNA, voz e ${to.doc.sources.filter((s) => s.workspace === target.id).length} fonte(s) atuais.`);

  if (!apply) {
    console.log("\nSimulação: nada foi gravado. Rode com --apply para gravar.");
  } else {
    const alias = opt("alias");
    const next = { ...to.doc };
    next.brandDNA = { ...(to.doc.brandDNA || {}), [target.id]: dna };
    next.voices = { ...(to.doc.voices || {}), [target.id]: voice };
    next.sources = [...to.doc.sources.filter((s) => s.workspace !== target.id), ...sources];
    next.workspaces = to.doc.workspaces.map((w) => (w.id === target.id ? { ...w, audience: rename(source.audience || w.audience || ""), voice: rename(source.voice || w.voice), ...(alias ? { aliases: alias.split(",").map((a) => a.trim()) } : {}) } : w));
    const stamp = new Date().toISOString().replace(/[:.]/g, "-"), now = new Date().toISOString();
    const dir = path.join(".runtime", "backups", `clone-${stamp}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "destino-antes.json"), to.raw);
    await db.tx(async (q) => {
      await q.run("INSERT OR IGNORE INTO account_state_backups VALUES(?,?,?,?)", to.user.id, to.revision, to.raw, now);
      const current = await q.get("SELECT revision FROM account_state WHERE user_id = ?", to.user.id);
      if (current.revision !== to.revision) throw new Error("A conta de destino mudou durante a cópia. Rode de novo.");
      await q.run("UPDATE account_state SET document=?, revision=?, updated_at=? WHERE user_id=?", JSON.stringify(next), to.revision + 1, now, to.user.id);
    });
    console.log(`\nGravado (rev ${to.revision} → ${to.revision + 1}). Cópia de segurança do destino: ${dir}`);
    console.log("Se a conta de destino estiver aberta no navegador, recarregue a página antes de continuar.");
  }
} finally {
  await closePool();
}
