// Brings EXP-308 round 1 (run before the lab existed) into bench_runs/bench_items as history.
// It stays out of the totals: round 2 judges the same texts again with judges outside every family.
import fs from "node:fs";
process.env.MEMORAVEL_DB = "postgres";
const { createLabStore } = await import("../server/lab.mjs");
const { closePool } = await import("../server/sql.mjs");
const r1 = JSON.parse(fs.readFileSync("docs/benchmarks/exp-308-redator-r1.json", "utf8"));
const store = createLabStore();
const id = "EXP-308-r1";
await store.saveRun({ id, experiment: "EXP-308", title: "Redator · Opus × GPT-6.1 Sol × GPT-6.1 Terra (piloto)", task: "redator", status: "done", budget_usd: 0.9, spent_usd: r1.spent, created_at: r1.at, config: { summary: false, writers: r1.writers, judges: [r1.judge], planner: r1.planner, briefs: r1.briefs.map(({ id, title, workspace, format }) => ({ id, title, workspace, format })), supersededBy: "EXP-308-r2" }, notes: "Piloto com um juiz (Gemini 4 Argon). Reavaliado com a fonte inteira; notas da 1ª avaliação no JSON. Substituído pela rodada 2 nos totais." });
let n = 0;
for (const b of r1.briefs) {
  for (const v of b.versions) {
    await store.saveItem({ key: `${id}|${b.id}|redator|${v.writer}`, run_id: id, brief_id: b.id, role: "redator", model: v.writer, output: { title: v.title, body: v.body }, checks: { ok: v.sourcesOk && !v.issues.length, sourcesOk: v.sourcesOk, issues: v.issues, facts: v.facts, factsVerbatim: v.factsVerbatim, words: v.words }, scores: { [r1.judge]: v.scores }, mean: v.mean, cost_usd: v.cost, seconds: v.seconds, input_tokens: v.inputTokens, output_tokens: v.outputTokens, created_at: r1.at });
    n++;
  }
}
console.log(`${n} saídas da rodada 1 registradas em ${id} (fora dos totais).`);
await closePool();
