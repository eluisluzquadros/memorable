// Resets the generated content of the customers' accounts in production (Supabase), so each account starts
// from zero while the platform's own benchmark and cost ledger stay intact.
//   node --env-file=.env scripts/reset-customer-accounts.mjs --cloud                    → dry run: what would change
//   node --env-file=.env scripts/reset-customer-accounts.mjs --cloud --apply            → back up, then reset
//   --keep a@x.com,b@y.com        accounts to leave alone (platform administrators are always left alone)
//   --delete-test-users           also delete QA accounts (@example.test) with everything they own
// What is cleared: pieces (so the Kanban), executions, campaigns, and what hangs from the pieces (the activity log,
// outcomes, radar runs and items, cases), plus leftover per-account model choices (the platform decides models now).
// What stays: brands, brand DNA and voices, sources, the writing queue of ideas, budgets, radar and monitor
// settings, onboarding, team config.
// The cost ledger (llm_calls) is never touched: it is the company's books and the only way to reconcile with
// the provider's bill. The account's usage view restarts at the moment of the reset (platform.usageSince).
// Before any change, each document is saved in .runtime/backups/reset-<time>/ and in account_state_backups.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (!args.includes("--cloud")) throw new Error("Este script age na produção: rode com --cloud.");
process.env.MEMORAVEL_DB = "postgres";
const apply = args.includes("--apply");
const keep = new Set((args[args.indexOf("--keep") + 1] || "").split(",").map((e) => e.trim().toLowerCase()).filter((e) => e && args.includes("--keep")));
const { openDb, closePool } = await import("../server/sql.mjs");
const { createPlatform } = await import("../server/platform.mjs");

const CLEARED = ["pieces", "executions", "campaigns", "events", "outcomes", "radarRuns", "radarItems", "cases"];
const DROPPED = ["modelRoles", "aiBudget"];
const db = openDb();
const platform = createPlatform(db, { ttlMs: 0 });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = path.join(".runtime", "backups", `reset-${stamp}`);

try {
  const users = await db.all("SELECT id, name, email FROM users ORDER BY created_at");
  const admins = new Set(await platform.admins());
  const test = users.filter((u) => u.email.endsWith("@example.test"));
  const customers = users.filter((u) => !u.email.endsWith("@example.test") && !admins.has(u.email.toLowerCase()) && !keep.has(u.email.toLowerCase()));
  console.log(`Administradores da plataforma (não são resetados): ${[...admins].join(", ") || "(nenhum)"}`);
  console.log(`${apply ? "APLICANDO" : "Simulação"} · ${customers.length} conta(s) de cliente\n`);

  const plans = [];
  for (const u of customers) {
    const row = await db.get("SELECT document, revision FROM account_state WHERE user_id = ?", u.id);
    if (!row) { console.log(`${u.email}: sem documento, ignorada.`); continue; }
    const doc = JSON.parse(row.document);
    const next = { ...doc };
    const removed = [];
    for (const key of CLEARED) if (Array.isArray(doc[key]) && doc[key].length) { removed.push(`${key}=${doc[key].length}`); next[key] = []; }
    for (const key of DROPPED) if (key in doc) { removed.push(`${key} (obsoleto)`); delete next[key]; }
    console.log(`${u.email} · ${u.name} · rev ${row.revision}`);
    console.log(`  apaga: ${removed.join(", ") || "nada"}`);
    console.log(`  mantém: ${(doc.workspaces || []).length} marcas, ${(doc.sources || []).length} fontes, DNA e vozes`);
    plans.push({ user: u, row, next });
  }
  if (args.includes("--delete-test-users")) console.log(`\nUsuários de teste a apagar: ${test.map((u) => u.email).join(", ") || "nenhum"}`);

  if (!apply) {
    console.log("\nSimulação: nada foi gravado. Rode com --apply para aplicar.");
  } else {
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date().toISOString();
    for (const { user, row, next } of plans) {
      fs.writeFileSync(path.join(dir, `${user.email.replace(/[^a-z0-9@.-]/gi, "_")}.json`), row.document);
      await db.tx(async (q) => {
        await q.run("INSERT OR IGNORE INTO account_state_backups VALUES(?,?,?,?)", user.id, row.revision, row.document, now);
        await q.run("UPDATE account_state SET document=?, revision=?, updated_at=? WHERE user_id=? AND revision=?", JSON.stringify(next), row.revision + 1, now, user.id, row.revision);
      });
      await platform.setUsageSince(user.id, now);
      console.log(`Resetada: ${user.email} (rev ${row.revision} → ${row.revision + 1}); uso do plano recomeça em ${now}`);
    }
    if (args.includes("--delete-test-users")) {
      for (const u of test) {
        await db.tx(async (q) => {
          for (const table of ["sessions", "account_state_backups", "account_state"]) await q.run(`DELETE FROM ${table} WHERE user_id=?`, u.id);
          for (const table of ["connections", "jobs"]) await q.run(`DELETE FROM ${table} WHERE owner=?`, u.id);
          await q.run("DELETE FROM users WHERE id=?", u.id);
        });
        console.log(`Usuário de teste apagado: ${u.email}`);
      }
    }
    console.log(`\nCópias de segurança: ${dir} e account_state_backups (revisão anterior de cada conta).`);
  }
} finally {
  await closePool();
}
