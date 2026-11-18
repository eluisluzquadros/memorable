// Removes markdown marks (**bold**, # headings) from the text of pieces already saved in an account, the same
// cleaning the writers now apply to new text. Simulation by default; the document is backed up before writing.
//   node --env-file=.env scripts/clean-piece-markup.mjs --cloud --email mktmemoravel@gmail.com [--apply]
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : ""; };
if (!args.includes("--cloud")) throw new Error("Este script age na produção: rode com --cloud.");
process.env.MEMORAVEL_DB = "postgres";
const email = opt("email").toLowerCase();
if (!email) throw new Error("Informe --email.");
const { openDb, closePool } = await import("../server/sql.mjs");
const { plainText } = await import("../server/editorial.mjs");
const db = openDb();
try {
  const user = await db.get("SELECT id FROM users WHERE email = ?", email);
  const row = await db.get("SELECT document, revision FROM account_state WHERE user_id = ?", user.id);
  const doc = JSON.parse(row.document);
  let changed = 0;
  const pieces = doc.pieces.map((p) => {
    const body = plainText(p.body);
    const delivery = p.delivery?.body ? { ...p.delivery, body: plainText(p.delivery.body) } : p.delivery;
    if (body !== p.body) { changed++; console.log(`  ${p.format} · ${p.title.slice(0, 50)} · ${p.body.length - body.length} caractere(s) de marcação`); }
    return body === p.body ? p : { ...p, body, delivery };
  });
  console.log(`${email}: ${changed} peça(s) com marcação.`);
  if (!apply()) console.log("Simulação: nada foi gravado. Rode com --apply para gravar.");
  else if (changed) {
    const now = new Date().toISOString(), dir = path.join(".runtime", "backups", `marcacao-${now.replace(/[:.]/g, "-")}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "antes.json"), row.document);
    await db.tx(async (q) => {
      await q.run("INSERT OR IGNORE INTO account_state_backups VALUES(?,?,?,?)", user.id, row.revision, row.document, now);
      const current = await q.get("SELECT revision FROM account_state WHERE user_id = ?", user.id);
      if (current.revision !== row.revision) throw new Error("A conta mudou durante a limpeza. Rode de novo.");
      await q.run("UPDATE account_state SET document=?, revision=?, updated_at=? WHERE user_id=?", JSON.stringify({ ...doc, pieces }), row.revision + 1, now, user.id);
    });
    console.log(`Gravado (rev ${row.revision} → ${row.revision + 1}). Backup: ${dir}`);
  }
} finally {
  await closePool();
}
function apply() { return args.includes("--apply"); }
