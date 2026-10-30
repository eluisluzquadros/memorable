// Manages the platform's own settings: who administers it and which models every account uses.
// Local database by default; --cloud works on Supabase (the production data).
//   node --env-file=.env scripts/platform.mjs admins                       → list administrators
//   node --env-file=.env scripts/platform.mjs add-admin <email> [--cloud]
//   node --env-file=.env scripts/platform.mjs remove-admin <email> [--cloud]
//   node --env-file=.env scripts/platform.mjs policy [--cloud]             → show the model policy
//   node --env-file=.env scripts/platform.mjs policy-from-lab <essencial|equilibrado|excelencia> [--cloud] [--apply]
//        builds the policy from the lab (the chosen profile for each content type, general writer = the best
//        qualified overall) and shows it; it is saved only with --apply. Reviewer and judge are left as they are.
import path from "node:path";

const args = process.argv.slice(2);
if (args.includes("--cloud")) process.env.MEMORAVEL_DB = "postgres";
const [command, value] = args.filter((a) => !a.startsWith("--"));
const { openDb, closePool } = await import("../server/sql.mjs");
const { createPlatform } = await import("../server/platform.mjs");
const { LLM_CATALOG } = await import("../src/llm-catalog.mjs");
const SCHEMA = "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS service_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);";
const db = openDb(path.join(".runtime", "service.sqlite"), SCHEMA);
const platform = createPlatform(db, { ttlMs: 0 });
const known = (id) => LLM_CATALOG.some((m) => m.id === id);
const show = (policy) => {
  console.log("  Redator geral:", policy.writer || "(padrão do serviço)");
  console.log("  Revisor      :", policy.reviewer || "(padrão do serviço)");
  console.log("  Juiz cego    :", policy.judge || "(padrão do serviço)");
  for (const [format, model] of Object.entries(policy.writerByFormat || {})) console.log(`  ${format.padEnd(18)}`, model);
};

try {
  console.log(`Banco: ${args.includes("--cloud") ? "Supabase (nuvem)" : "SQLite local"}`);
  if (command === "admins") console.log((await platform.admins()).join("\n") || "(nenhum administrador)");
  else if (command === "add-admin") console.log("Administrador adicionado:", await platform.addAdmin(value));
  else if (command === "remove-admin") { await platform.removeAdmin(value); console.log("Administrador removido:", value); }
  else if (command === "policy") show(await platform.modelPolicy());
  else if (command === "policy-from-lab") {
    const profile = value;
    if (!["essencial", "equilibrado", "excelencia"].includes(profile)) throw new Error("Informe o perfil: essencial, equilibrado ou excelencia.");
    const { createLabStore, labSummary } = await import("../server/lab.mjs");
    const { profileWriters } = await import("../src/model-roles.mjs");
    const lab = createLabStore();
    const summary = labSummary(await lab.allItems(), await lab.runs());
    const available = (id) => known(id) && LLM_CATALOG.find((m) => m.id === id)?.available !== false;
    const current = await platform.modelPolicy();
    const writer = summary.profiles?.redator?.[profile];
    const next = { ...current, ...(writer && available(writer) ? { writer } : {}), writerByFormat: profileWriters(summary.byFormat, profile, available) };
    console.log(`Política proposta (perfil ${profile}):`);
    show(next);
    if (args.includes("--apply")) { await platform.setModelPolicy(next, known); console.log("Política gravada."); }
    else console.log("Simulação: nada foi gravado. Rode com --apply para gravar.");
  } else throw new Error("Comandos: admins, add-admin <email>, remove-admin <email>, policy, policy-from-lab <perfil> [--apply].");
} finally {
  await closePool();
}
