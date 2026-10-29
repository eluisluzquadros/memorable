// Applies the brand's other names to the saved brand check of EXP-308 rounds 2–4 (free, no model call).
// Only Esfera Legal: its own site writes "Esfera.Legal" and the brand calls itself "Esfera". The rule is the
// platform's own (editorialIssues): in a video script only the spoken lines count, so a brand that appears
// only in the visual direction still fails. Re-running it is safe: every text is recomputed from its body.
//   node --env-file=.env scripts/lab-recheck-aliases.mjs
process.env.MEMORAVEL_DB = "postgres";
const { createLabStore } = await import("../server/lab.mjs");
const { closePool } = await import("../server/sql.mjs");
const { editorialIssues } = await import("../src/editorial-quality.mjs");
const store = createLabStore();
const ESFERA = { name: "Esfera Legal", aliases: ["Esfera", "Esfera.Legal"] };
const BRIEFS = ["conecta", "6x1", "car-esfera", "reels-conecta", "reels-6x1", "art-6x1", "news-esfera", "leg-conecta", "rv-6x1"];
const BRAND = "A mensagem não conecta o tema à marca que está produzindo o conteúdo. A fonte é referência, não o anunciante.";
let changed = 0;
for (const run of ["EXP-308-r2", "EXP-308-r3", "EXP-308-r4"]) {
  for (const i of await store.items(run)) {
    if (i.role !== "redator" || i.status !== "done" || !BRIEFS.includes(i.brief_id) || !i.checks) continue;
    const body = i.output?.body || "";
    const missing = editorialIssues({ body, brief: { brandName: ESFERA.name }, brand: ESFERA }).some((x) => x.code === "brand");
    const issues = [...(i.checks.issues || []).filter((x) => x !== BRAND), ...(missing ? [BRAND] : [])];
    const ok = i.checks.sourcesOk !== false && !issues.length && (i.checks.facts == null || i.checks.factsVerbatim === i.checks.facts);
    if (ok === i.checks.ok && issues.length === (i.checks.issues || []).length) continue;
    await store.saveItem({ ...i, checks: { ...i.checks, issues, ok, aliases: ESFERA.aliases } });
    changed++;
    console.log(`${run} ${i.brief_id.padEnd(14)} ${i.model.split("/")[1].padEnd(24)} ${i.checks.ok ? "ok" : "falha"} → ${ok ? "ok" : "falha: " + issues.join(" | ").slice(0, 90)}`);
  }
}
console.log(`\n${changed} textos com a checagem de marca corrigida.`);
await closePool();
