// After a brand is cloned with a literal name swap ("Esfera Legal" → "Escritório de advocacia"), the Portuguese
// around the name can disagree in gender: "pela Escritório de advocacia". This patches article and pronoun
// agreement in the brand's DNA, voice and sources, in place (source ids stay, so pieces keep their references).
//   node --env-file=.env scripts/fix-brand-gender.mjs --cloud --email mktmemoravel@gmail.com --brand "Escritório de advocacia" \
//        --names "Escritório de advocacia,Escritório" [--apply]
// Simulation by default; the document is backed up before it is written.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ""; };
if (!args.includes("--cloud")) throw new Error("Este script age na produção: rode com --cloud.");
process.env.MEMORAVEL_DB = "postgres";
const apply = args.includes("--apply");
const [email, brand] = [opt("email"), opt("brand")];
const names = opt("names").split(",").map((n) => n.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
if (!email || !brand || !names.length) throw new Error("Informe --email, --brand e --names.");

// feminine → masculine, for a masculine brand name
const MAP = { pela: "pelo", pelas: "pelos", na: "no", nas: "nos", da: "do", das: "dos", à: "ao", às: "aos", a: "o", as: "os", essa: "esse", esta: "este", aquela: "aquele", uma: "um", nossa: "nosso", sua: "seu", dela: "dele", própria: "próprio", mesma: "mesmo" };
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// A lookbehind on letters instead of \b: "à" and "às" are not word characters for \b.
const pattern = new RegExp(`(?<![\\p{L}])(${Object.keys(MAP).join("|")})(\\s+)(${names.map(escape).join("|")})`, "giu");
let changes = 0;
// The old brand in capitals (a heading such as "O MODELO ESFERA") escaped the first, case-sensitive swap.
const CAPS = [[/ESFERA[. ]LEGAL/g, "ESCRITÓRIO DE ADVOCACIA"], [/ESFERA/g, "ESCRITÓRIO"]];
const capital = (text) => CAPS.reduce((t, [re, to]) => t.replace(re, () => { changes++; return to; }), text);
const fix = (text) => capital(text).replace(pattern, (m, article, space, name) => {
  changes++;
  const mapped = MAP[article.toLowerCase()];
  return (article[0] === article[0].toUpperCase() ? mapped[0].toUpperCase() + mapped.slice(1) : mapped) + space + name;
});
const KEEP = new Set(["url", "origin", "id", "workspace", "sourceIds"]);
const walk = (value, key = "") => {
  if (typeof value === "string") return KEEP.has(key) || /^(https?:\/\/|www\.)/i.test(value) ? value : fix(value);
  if (Array.isArray(value)) return value.map((v) => walk(v, key));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
  return value;
};

const { openDb, closePool } = await import("../server/sql.mjs");
const db = openDb();
try {
  const user = await db.get("SELECT id FROM users WHERE email = ?", email.toLowerCase());
  const row = await db.get("SELECT document, revision FROM account_state WHERE user_id = ?", user.id);
  const doc = JSON.parse(row.document);
  const ws = doc.workspaces.find((w) => w.name === brand);
  if (!ws) throw new Error(`Marca não encontrada: ${brand}`);
  const next = { ...doc };
  next.brandDNA = { ...doc.brandDNA, [ws.id]: walk(doc.brandDNA?.[ws.id]) };
  next.voices = { ...doc.voices, [ws.id]: walk(doc.voices?.[ws.id]) };
  next.sources = doc.sources.map((s) => (s.workspace === ws.id ? walk(s) : s));
  console.log(`${email} · ${brand} · rev ${row.revision} → ${changes} ajuste(s) de concordância.`);
  const sample = JSON.stringify({ dna: doc.brandDNA?.[ws.id], sources: doc.sources.filter((s) => s.workspace === ws.id) }).match(pattern) || [];
  console.log("Exemplos encontrados:", [...new Set(sample)].slice(0, 12).join(" | ") || "(nenhum)");
  if (!apply) console.log("Simulação: nada foi gravado. Rode com --apply para gravar.");
  else {
    const now = new Date().toISOString(), dir = path.join(".runtime", "backups", `genero-${now.replace(/[:.]/g, "-")}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "antes.json"), row.document);
    await db.tx(async (q) => {
      await q.run("INSERT OR IGNORE INTO account_state_backups VALUES(?,?,?,?)", user.id, row.revision, row.document, now);
      const current = await q.get("SELECT revision FROM account_state WHERE user_id = ?", user.id);
      if (current.revision !== row.revision) throw new Error("A conta mudou durante o ajuste. Rode de novo.");
      await q.run("UPDATE account_state SET document=?, revision=?, updated_at=? WHERE user_id=?", JSON.stringify(next), row.revision + 1, now, user.id);
    });
    console.log(`Gravado (rev ${row.revision} → ${row.revision + 1}). Backup: ${dir}`);
  }
} finally {
  await closePool();
}
