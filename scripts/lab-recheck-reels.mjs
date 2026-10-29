// Recomputes the mechanical check of saved Reels scripts (EXP-308 round 3) the way the platform does:
// timing and pace flagged by the platform, plus the editorial check of the format. The caveats a model
// declares about itself ("the source does not give the date", "invite-only event") are good behavior and
// no longer count as failures. Free: no model is called.
process.env.MEMORAVEL_DB = "postgres";
const { createLabStore } = await import("../server/lab.mjs");
const { closePool } = await import("../server/sql.mjs");
const { editorialIssues } = await import("../src/editorial-quality.mjs");
const { productionSettings } = await import("../src/production.mjs");
const store = createLabStore();
const BRANDS = { "reels-conecta": "Esfera Legal", "reels-6x1": "Esfera Legal", "reels-vendas": "Podcast do grupo" };
const PLATFORM = /^(As cenas somam|As falas têm)/;
let changed = 0;
for (const i of await store.items("EXP-308-r3")) {
  if (i.role !== "redator" || !BRANDS[i.brief_id] || i.status !== "done") continue;
  const brief = { format: "Reels", durationSeconds: 30, scriptMode: "spoken", brandName: BRANDS[i.brief_id] };
  const body = i.output?.body || "";
  const timing = (i.output?.warnings || []).filter((w) => PLATFORM.test(w));
  const editorial = editorialIssues({ body, format: "Reels", brief: { ...brief, ...productionSettings(brief) }, brand: { name: BRANDS[i.brief_id] }, sources: [] }).map((x) => x.message);
  const issues = [...timing, ...editorial];
  const checks = { ...i.checks, ok: i.checks.sourcesOk && !issues.length, issues, declaredCaveats: (i.output?.warnings || []).filter((w) => !PLATFORM.test(w)).length, recheckedAt: new Date().toISOString() };
  await store.saveItem({ ...i, checks });
  changed++;
  console.log(`${i.brief_id.padEnd(14)} ${i.model.split("/")[1].padEnd(24)} ${checks.ok ? "ok" : "falhou: " + issues.join(" | ").slice(0, 140)} · avisos declarados: ${checks.declaredCaveats}`);
}
console.log(`\n${changed} roteiros rechecados.`);
await closePool();
