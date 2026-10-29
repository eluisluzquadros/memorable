// Applies the brand's other names to the saved checks of EXP-308 rounds 2 and 3 (free, no model call).
// Only Esfera Legal: its own site writes "Esfera.Legal" and the brand calls itself "Esfera". The podcast
// brand keeps its literal rule until its real name is set in the account.
process.env.MEMORAVEL_DB = "postgres";
const { createLabStore } = await import("../server/lab.mjs");
const { closePool } = await import("../server/sql.mjs");
const store = createLabStore();
const ESFERA = ["conecta", "6x1", "car-esfera", "reels-conecta", "reels-6x1"];
const BRAND = "A mensagem não conecta o tema à marca que está produzindo o conteúdo. A fonte é referência, não o anunciante.";
const plain = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
let n = 0;
for (const run of ["EXP-308-r2", "EXP-308-r3"]) {
  for (const i of await store.items(run)) {
    if (i.role !== "redator" || i.status !== "done" || !ESFERA.includes(i.brief_id) || !i.checks?.issues?.includes(BRAND)) continue;
    if (!/\besfera\b/.test(plain(i.output?.body))) continue;
    const issues = i.checks.issues.filter((x) => x !== BRAND);
    const ok = i.checks.sourcesOk !== false && !issues.length && (i.checks.facts == null || i.checks.factsVerbatim === i.checks.facts);
    await store.saveItem({ ...i, checks: { ...i.checks, issues, ok, aliases: ["Esfera", "Esfera.Legal"] } });
    n++;
    console.log(`${run} ${i.brief_id.padEnd(14)} ${i.model.split("/")[1].padEnd(24)} → ${ok ? "ok" : "ainda falha: " + issues.join(" | ").slice(0, 100)}`);
  }
}
console.log(`\n${n} textos rechecados com os outros nomes da Esfera.`);
await closePool();
