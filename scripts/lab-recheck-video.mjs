// Recomputes the saved editorial check of every video script in EXP-308 rounds 2–5 with the platform's own
// function (free, no model call). Needed after the speech parser fix: "com a fala: …" inside a visual
// direction used to be read as a spoken line (false repetition). Timing flags are kept as they were.
// Safe to run again: every text is recomputed from its body.
//   node --env-file=.env scripts/lab-recheck-video.mjs
process.env.MEMORAVEL_DB = "postgres";
const { createLabStore } = await import("../server/lab.mjs");
const { closePool } = await import("../server/sql.mjs");
const { editorialIssues } = await import("../src/editorial-quality.mjs");
const { productionSettings } = await import("../src/production.mjs");
const BRANDS = {
  esfera: { name: "Esfera Legal", aliases: ["Esfera", "Esfera.Legal"] },
  podcast: { name: "Podcast Bastidores", aliases: ["Bastidores", "@podcast.bastidores"] },
  skyvidya: { name: "Skyvidya", aliases: [] },
};
const brandOf = (briefId) => (/bastidores/.test(briefId) ? BRANDS.podcast : /skyvidya/.test(briefId) ? BRANDS.skyvidya : BRANDS.esfera);
const store = createLabStore();
let changed = 0, seen = 0;
for (const runId of ["EXP-308-r2", "EXP-308-r3", "EXP-308-r4", "EXP-308-r5"]) {
  const run = await store.run(runId);
  const format = Object.fromEntries((run.config.briefs || []).map((b) => [b.id, b.format]));
  // Pieces out of the totals keep their history as recorded (some belong to another brand).
  const out = new Set([...(run.config.excludedBriefs || []), ...(run.config.flaggedBriefs || [])].map((e) => e.id));
  for (const i of await store.items(runId)) {
    const fmt = format[i.brief_id];
    if (i.role !== "redator" || i.status !== "done" || !i.checks || out.has(i.brief_id) || !["Reels", "Roteiro de vídeo"].includes(fmt)) continue;
    seen++;
    const brand = brandOf(i.brief_id);
    const brief = { ...productionSettings({ format: fmt, durationSeconds: fmt === "Reels" ? 30 : 60 }), format: fmt, brandName: brand.name };
    const timing = (i.output?.warnings || []).filter((w) => /^(As cenas somam|As falas têm)/.test(w));
    const issues = [...timing, ...editorialIssues({ body: i.output?.body || "", format: fmt, brief, brand, sources: [] }).map((x) => x.message)];
    const ok = i.checks.sourcesOk !== false && !issues.length && (i.checks.facts == null || i.checks.factsVerbatim === i.checks.facts);
    if (ok === i.checks.ok && JSON.stringify(issues) === JSON.stringify(i.checks.issues || [])) continue;
    await store.saveItem({ ...i, checks: { ...i.checks, issues, ok, recheckedWith: "speech-parser-v2" } });
    changed++;
    console.log(`${runId} ${i.brief_id.padEnd(16)} ${i.model.split("/")[1].padEnd(22)} ${i.checks.ok ? "ok" : "falha"} → ${ok ? "ok" : "falha: " + issues.join(" | ").slice(0, 110)}`);
  }
}
console.log(`\n${seen} roteiros conferidos · ${changed} com a checagem alterada.`);
await closePool();
