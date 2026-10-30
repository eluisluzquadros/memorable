// Brings the cloud (Supabase, the source of truth since the move to Render) back into the local SQLite
// (.runtime), so the local app shows the same brands, contents and AI spend as memoravel.org.
//   node --env-file=.env scripts/pull-from-supabase.mjs            → dry run: what differs, nothing written
//   node --env-file=.env scripts/pull-from-supabase.mjs --apply    → copy (local files backed up first)
// Accounts and their documents are replaced by the cloud copy; AI calls are added (never removed).
// Local QA accounts (@example.test) and anything that exists only locally are kept. Restart the local
// app afterwards so it reads the new data.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

process.env.MEMORAVEL_DB = "postgres";
const { openDb, closePool } = await import("../server/sql.mjs");

const apply = process.argv.includes("--apply");
const dir = ".runtime";
const accountsFile = path.join(dir, fs.existsSync(path.join(dir, "memorable.sqlite")) ? "memorable.sqlite" : "skyvidya.sqlite");
const observabilityFile = path.join(dir, "observability.sqlite");

const iso = (v) => (v instanceof Date ? v.toISOString() : v);
const pg = openDb();
const users = (await pg.all("SELECT * FROM users")).filter((u) => !u.email.endsWith("@example.test"));
const states = await pg.all("SELECT * FROM account_state");
const calls = await pg.all("SELECT * FROM llm_calls WHERE owner IS NOT NULL");
await closePool();

const local = new DatabaseSync(accountsFile, { readOnly: !apply });
const localState = new Map(local.prepare("SELECT user_id, document, revision, updated_at FROM account_state").all().map((r) => [r.user_id, r]));
const summary = (doc) => {
  const d = JSON.parse(doc || "{}");
  return `${(d.workspaces || []).filter((w) => !w.archived).map((w) => w.name).join(", ") || "sem marcas"} · ${(d.pieces || []).length} conteúdos`;
};
console.log(`Destino: ${accountsFile}`);
for (const u of users) {
  const cloud = states.find((s) => s.user_id === u.id), mine = localState.get(u.id);
  console.log(`\n${u.email}`);
  console.log(`  nuvem: rev ${cloud?.revision ?? "—"} · ${cloud ? summary(cloud.document) : "sem documento"}`);
  console.log(`  local: rev ${mine?.revision ?? "—"} · ${mine ? summary(mine.document) : "não existe"}`);
}
const obs = fs.existsSync(observabilityFile) ? new DatabaseSync(observabilityFile, { readOnly: !apply }) : null;
const knownCalls = new Set(obs ? obs.prepare("SELECT id FROM llm_calls").all().map((r) => r.id) : []);
const newCalls = calls.filter((c) => !knownCalls.has(c.id));
console.log(`\nChamadas de IA das contas: ${calls.length} na nuvem, ${newCalls.length} ainda não estão no local.`);
if (!apply) {
  console.log("Simulação: nada foi gravado. Rode com --apply para copiar.");
  process.exit(0);
}

// A copy of each local file before anything changes.
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.mkdirSync(path.join(dir, "backups"), { recursive: true });
for (const [db, file] of [[local, accountsFile], [obs, observabilityFile]]) {
  if (!db) continue;
  const target = path.join(dir, "backups", `${path.basename(file, ".sqlite")}-${stamp}.sqlite`);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  console.log(`Cópia de segurança: ${target}`);
}
local.exec("BEGIN");
for (const u of users) local.prepare("INSERT OR REPLACE INTO users (id, name, email, password_hash, salt, created_at) VALUES (?,?,?,?,?,?)").run(u.id, u.name, u.email, u.password_hash, u.salt, iso(u.created_at));
for (const s of states.filter((s) => users.some((u) => u.id === s.user_id)))
  local.prepare("INSERT OR REPLACE INTO account_state (user_id, document, revision, updated_at) VALUES (?,?,?,?)").run(s.user_id, s.document, s.revision, iso(s.updated_at));
local.exec("COMMIT");
if (obs) {
  const columns = obs.prepare("PRAGMA table_info(llm_calls)").all().map((c) => c.name);
  const insert = obs.prepare(`INSERT OR IGNORE INTO llm_calls (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`);
  obs.exec("BEGIN");
  for (const c of newCalls) insert.run(...columns.map((k) => (c[k] instanceof Date ? iso(c[k]) : typeof c[k] === "boolean" ? Number(c[k]) : c[k] ?? null)));
  obs.exec("COMMIT");
}
console.log(`Copiado: ${users.length} contas, seus documentos e ${newCalls.length} chamadas de IA. Reinicie o app local.`);
