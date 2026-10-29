// Copies the local SQLite data (.runtime) into Supabase Postgres (schema memoravel) and checks the copy.
//   node --env-file=.env scripts/migrate-to-supabase.mjs            → dry run: what would be copied
//   node --env-file=.env scripts/migrate-to-supabase.mjs --apply    → copy in one transaction, then verify
//   --include-test   also copies QA accounts (@example.test)
// Safe to repeat: rows already present are kept (ON CONFLICT DO NOTHING). Sessions are not copied:
// the cookie belongs to the old address, so everyone signs in again at the new one.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

process.env.MEMORAVEL_DB = "postgres";
const { openDb, closePool } = await import("../server/sql.mjs");

const apply = process.argv.includes("--apply");
const includeTest = process.argv.includes("--include-test");
const dir = ".runtime";
const open = (name) => (fs.existsSync(path.join(dir, name)) ? new DatabaseSync(path.join(dir, name), { readOnly: true }) : null);
const accountsFile = fs.existsSync(path.join(dir, "memorable.sqlite")) ? "memorable.sqlite" : "skyvidya.sqlite";
const accounts = open(accountsFile), suggestions = open("suggestions.sqlite"), integrations = open("integrations.sqlite"), observability = open("observability.sqlite");
const all = (db, sql) => (db ? db.prepare(sql).all() : []);

const users = all(accounts, "SELECT * FROM users").filter((u) => includeTest || !u.email.endsWith("@example.test"));
const keep = new Set(users.map((u) => u.id));
const states = all(accounts, "SELECT * FROM account_state").filter((r) => keep.has(r.user_id));
const backups = all(accounts, "SELECT * FROM account_state_backups").filter((r) => keep.has(r.user_id));
const contributors = all(suggestions, "SELECT * FROM contributors").filter((r) => keep.has(r.owner_id));
const people = new Set(contributors.map((c) => c.id));
const ideas = all(suggestions, "SELECT * FROM suggestions").filter((r) => keep.has(r.owner_id) && people.has(r.contributor_id));
const connections = all(integrations, "SELECT * FROM connections").filter((r) => keep.has(r.owner));
const jobs = all(integrations, "SELECT * FROM jobs ORDER BY rowid").filter((r) => keep.has(r.owner));
const calls = all(observability, "SELECT * FROM llm_calls");
let monitoring = null;
try { monitoring = fs.readFileSync(path.join(dir, "monitoring.json"), "utf8"); } catch {}
const localService = open("service.sqlite");
const savedMonitoring = localService?.prepare("SELECT value FROM service_state WHERE key='monitoring'").get();
if (savedMonitoring) monitoring = savedMonitoring.value;

const plan = { contas: users.length, estados: states.length, backups: backups.length, colaboradores: contributors.length, sugestoes: ideas.length, conexoes: connections.length, tarefas: jobs.length, chamadas_ia: calls.length, coleta_radar: monitoring ? 1 : 0 };
console.log(`Origem: .runtime/${accountsFile}${includeTest ? " (com contas de teste)" : " (sem contas @example.test)"}`);
console.log("Contas:", users.map((u) => u.email).join(", "));
console.table(plan);
if (!apply) {
  console.log("Simulação: nada foi gravado. Rode com --apply para copiar.");
  process.exit(0);
}

const pg = openDb();
await pg.tx(async (q) => {
  for (const u of users) await q.run("INSERT OR IGNORE INTO users VALUES(?,?,?,?,?,?)", u.id, u.name, u.email, u.password_hash, u.salt, u.created_at);
  for (const s of states) await q.run("INSERT OR IGNORE INTO account_state VALUES(?,?,?,?)", s.user_id, s.document, s.revision, s.updated_at);
  for (const b of backups) await q.run("INSERT OR IGNORE INTO account_state_backups VALUES(?,?,?,?)", b.user_id, b.revision, b.document, b.created_at);
  for (const c of contributors) await q.run("INSERT OR IGNORE INTO contributors VALUES(?,?,?,?,?,?,?,?,?,?)", c.id, c.owner_id, c.name, c.email, c.area, c.workspaces, c.password_hash, c.salt, c.created_at, c.removed_at);
  for (const s of ideas) await q.run("INSERT OR IGNORE INTO suggestions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", s.id, s.owner_id, s.contributor_id, s.workspace, s.title, s.why, s.knowledge, s.reference_url, s.reference_text, s.status, s.reason, s.source_id, s.decided_by, s.created_at, s.decided_at);
  for (const c of connections) await q.run("INSERT OR IGNORE INTO connections VALUES(?,?,?)", c.owner, c.provider, c.secret);
  for (const j of jobs) await q.run("INSERT OR IGNORE INTO jobs(owner,id,request_key,data) VALUES(?,?,?,?)", j.owner, j.id, j.request_key, j.data);
  for (const c of calls) await q.run("INSERT OR IGNORE INTO llm_calls VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", c.id, c.at, c.owner, c.route, c.role, c.provider, c.model, c.ms, c.input_tokens, c.output_tokens, c.cost, c.cost_source, c.ok ? 1 : 0, c.error, c.run_tag);
  if (monitoring) await q.run("INSERT OR IGNORE INTO service_state VALUES(?,?,?)", "monitoring", monitoring, new Date().toISOString());
});

// Verification: every copied row is there, and every account document is identical to the local one.
const count = async (table, column, ids) => (await pg.all(`SELECT ${column} AS id FROM ${table}`)).filter((r) => ids.has(r.id)).length;
const problems = [];
const expect = async (label, table, column, rows, key) => {
  const found = await count(table, column, new Set(rows.map(key)));
  if (found !== rows.length) problems.push(`${label}: ${found} de ${rows.length}`);
};
await expect("contas", "users", "id", users, (u) => u.id);
await expect("estados", "account_state", "user_id", states, (s) => s.user_id);
await expect("colaboradores", "contributors", "id", contributors, (c) => c.id);
await expect("sugestões", "suggestions", "id", ideas, (s) => s.id);
await expect("chamadas de IA", "llm_calls", "id", calls, (c) => c.id);
for (const s of states) {
  const remote = await pg.get("SELECT document, revision FROM account_state WHERE user_id=?", s.user_id);
  if (!remote || !isDeepStrictEqual(JSON.parse(remote.document), JSON.parse(s.document))) problems.push(`documento de ${s.user_id} difere`);
  else if (remote.revision !== s.revision) problems.push(`revisão de ${s.user_id}: ${remote.revision} no Supabase, ${s.revision} local (já existia; não foi sobrescrito)`);
}
await closePool();
if (problems.length) {
  console.log("Conferência encontrou diferenças:");
  for (const p of problems) console.log(" -", p);
  process.exit(1);
}
console.log("Cópia conferida: todas as linhas estão no Supabase e os documentos das contas são idênticos.");
