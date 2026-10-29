// EXP-308 round 2 — cheaper writers against the round-1 baseline (Opus, GPT-6.1 Sol/Terra).
// Same briefs, same saved plan, same Writer prompt; round-1 texts are reused, not regenerated.
// Two blind judges from families outside every writer; the score is their mean.
//   node --env-file=.env scripts/bench-writer-r2.mjs [--budget 0.5]
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { contextPacket } from "../src/operations.mjs";
import { editorialIssues } from "../src/editorial-quality.mjs";
import { COPY_METHOD, formatGuide } from "../src/playbooks.mjs";
import { BRAND_WRITING } from "../server/editorial.mjs";
import { benchmarkModel } from "../server/ai.mjs";

const WRITERS = ["anthropic/claude-sonnet-5.5", "google/gemini-3.8-flash", "google/gemini-3.5-flash-lite", "openai/gpt-5.4-mini", "openai/gpt-4.1-mini", "deepseek/deepseek-v4-pro-0813", "deepseek/deepseek-v4.1-flash"];
// Qwen 3.8 Max timed out (>5 min of reasoning) in the first attempt; Mistral is outside every writer family too.
const JUDGES = ["x-ai/grok-4.7", "mistralai/mistral-large-4-0"];
const budget = Number(process.argv[process.argv.indexOf("--budget") + 1]) || 0.5;
const r1 = JSON.parse(fs.readFileSync("docs/benchmarks/exp-308-redator-r1.json", "utf8"));
const doc = JSON.parse(new DatabaseSync(".runtime/skyvidya.sqlite", { readOnly: true }).prepare("SELECT document FROM account_state WHERE user_id=?").get("593efd79-f6a5-422c-9080-9422455c5241").document);

// Every answer is saved as it arrives, so a crash or timeout never throws away paid work: a rerun
// reuses what is in the checkpoint and only calls what is missing.
const CHECKPOINT = "docs/benchmarks/exp-308-redator-r2.progress.json";
const saved = fs.existsSync(CHECKPOINT) ? JSON.parse(fs.readFileSync(CHECKPOINT, "utf8")) : {};
let spent = 0;
const ledger = [];
async function call(modelName, role, system, data, key) {
  if (key && saved[key]) { console.log(`  ${role.padEnd(7)} ${modelName.padEnd(31)} (do checkpoint)`); ledger.push(saved[key].entry); return saved[key]; }
  if (spent >= budget) throw new Error(`Teto de US$ ${budget} atingido; parei antes de ${role} (${modelName}).`);
  let usage = {};
  const started = performance.now();
  const result = await benchmarkModel(modelName)(system, data, (u) => { usage = { ...usage, ...u }; });
  const entry = { model: modelName, role, seconds: Math.round((performance.now() - started) / 100) / 10, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cost: usage.cost ?? null };
  spent += entry.cost || 0;
  ledger.push(entry);
  console.log(`  ${role.padEnd(7)} ${modelName.padEnd(31)} ${String(entry.seconds).padStart(5)} s  ${String(entry.inputTokens).padStart(6)}→${String(entry.outputTokens).padStart(5)} tok  US$ ${(entry.cost ?? 0).toFixed(4)}  (acumulado ${spent.toFixed(3)})`);
  if (key) { saved[key] = { result, entry }; fs.mkdirSync("docs/benchmarks", { recursive: true }); fs.writeFileSync(CHECKPOINT, JSON.stringify(saved)); }
  return { result, entry };
}
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const mean = (s) => (s && [s.clareza, s.evidencia, s.voz, s.utilidade].every(Number.isFinite) ? (s.clareza + s.evidencia + s.voz + s.utilidade) / 4 : null);

const report = { experiment: "EXP-308 rodada 2 · Redator", at: new Date().toISOString(), writers: WRITERS, baseline: r1.writers, judges: JUDGES, briefs: [] };
for (const b1 of r1.briefs) {
  console.log(`\n== ${b1.id}: ${b1.title}`);
  const packet = contextPacket({ ...doc, workspace: b1.workspace }, { ...b1, sourceIds: [b1.source], deadline: "2026-11-10" });
  const known = [...packet.sources, ...(packet.brandKnowledge || [])];
  const allowed = new Set(known.map((s) => s.id));
  const versions = b1.versions.map((v) => ({ writer: v.writer, round: 1, body: v.body, title: v.title, words: v.words, issues: v.issues, sourcesOk: v.sourcesOk, cost: v.cost, seconds: v.seconds, inputTokens: v.inputTokens, outputTokens: v.outputTokens }));
  for (const writer of WRITERS) {
    try {
      const { result: v, entry } = await call(writer, "redator", `Atue como Copywriter/Ghostwriter. ${COPY_METHOD} ${BRAND_WRITING} ${formatGuide(b1.format)} Retorne {title,body,hook,strategy,sourceIds:string[],facts:[{sourceId,excerpt,verified:false}]}. Use packet.sources e packet.brandKnowledge para sustentar afirmações factuais.`, { packet, plan: b1.plan, strategy: "Racional" }, `${b1.id}|redator|${writer}`);
      const body = typeof v.body === "string" ? v.body : "";
      versions.push({
        writer, round: 2, body, title: v.title || "", words: body.split(/\s+/).filter(Boolean).length,
        issues: editorialIssues({ body, format: b1.format, brief: packet.brief, brand: packet.brand, sources: packet.sources }).map((i) => i.message),
        sourcesOk: Array.isArray(v.sourceIds) && v.sourceIds.length > 0 && v.sourceIds.every((id) => allowed.has(id)),
        factsVerbatim: (v.facts || []).filter((f) => known.find((s) => s.id === f.sourceId)?.text.includes(f.excerpt)).length, facts: (v.facts || []).length,
        ...entry,
      });
    } catch (error) {
      if (/Teto/.test(error.message)) throw error;
      console.log(`  redator ${writer.padEnd(31)} FALHOU: ${error.message.slice(0, 120)}`);
      versions.push({ writer, round: 2, failed: error.message.slice(0, 300) });
    }
  }
  const judged = versions.filter((v) => !v.failed && v.body.trim());
  const verdicts = [];
  for (const judge of JUDGES) {
    const judgeKey = `${b1.id}|juiz|${judge}|${judged.map((v) => v.writer).join(",")}`;
    const order = saved[judgeKey]?.order || shuffle(judged.map((_, i) => i));
    const labels = order.map((_, k) => String.fromCharCode(65 + k));
    let verdict;
    try {
    ({ result: verdict } = await call(judge, "juiz", "Você é editor-chefe e avalia versões anônimas de um mesmo post para a marca do pacote. Julgue só o texto, comparando com as fontes. Para cada versão dê notas inteiras de 1 a 5: clareza, evidencia (fiel às fontes, sem inventar), voz (soa como a marca descrita), utilidade (vale o tempo do leitor). Depois ordene todas da melhor para a pior e diga em uma frase o motivo do primeiro lugar. Retorne {scores:{A:{clareza,evidencia,voz,utilidade},B:{...}},ranking:string[],reason:string}.", {
      brand: packet.brand, voice: packet.voice, brief: packet.brief, sources: packet.sources.map((s) => ({ title: s.title, text: s.text })),
      versions: order.map((vi, k) => ({ id: labels[k], title: judged[vi].title, body: judged[vi].body })),
    }, judgeKey));
    saved[judgeKey].order = order;
    fs.writeFileSync(CHECKPOINT, JSON.stringify(saved));
    } catch (error) {
      if (/Teto/.test(error.message)) throw error;
      console.log(`  juiz    ${judge.padEnd(31)} FALHOU: ${error.message.slice(0, 100)}`);
      verdicts.push({ judge, failed: error.message.slice(0, 200) });
      continue;
    }
    order.forEach((vi, k) => {
      const v = judged[vi];
      (v.judges ||= {})[judge] = { scores: verdict.scores?.[labels[k]] || null, mean: mean(verdict.scores?.[labels[k]]), rank: (verdict.ranking || []).indexOf(labels[k]) + 1 || null };
    });
    verdicts.push({ judge, reason: verdict.reason, ranking: verdict.ranking });
  }
  for (const v of judged) {
    const means = Object.values(v.judges).map((j) => j.mean).filter(Number.isFinite);
    v.mean = means.length ? Math.round((means.reduce((a, b) => a + b, 0) / means.length) * 100) / 100 : null;
  }
  report.briefs.push({ id: b1.id, title: b1.title, verdicts, versions });
}
report.ledger = ledger;
report.spent = Math.round(spent * 10000) / 10000;
fs.writeFileSync("docs/benchmarks/exp-308-redator-r2.json", JSON.stringify(report, null, 2));

// Summary across briefs: mean score, mean cost, share of Opus cost.
const all = [...r1.writers, ...WRITERS];
const stat = (w, key) => { const xs = report.briefs.map((b) => b.versions.find((v) => v.writer === w)?.[key]).filter(Number.isFinite); return xs.length === report.briefs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; };
const opusCost = stat(r1.writers[0], "cost"), opusScore = stat(r1.writers[0], "mean");
const rows = all.map((w) => ({ w, score: stat(w, "mean"), cost: stat(w, "cost"), seconds: stat(w, "seconds") })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
const md = [`# EXP-308 · rodada 2 · Redator (${report.at.slice(0, 10)})`, "", `Mesmos briefs e plano da rodada 1; textos de ${r1.writers.join(", ")} reaproveitados. Juízes cegos: ${JUDGES.join(" e ")} (fora das famílias dos redatores); nota = média dos dois. Gasto da rodada: US$ ${report.spent}.`, "", "| Redator | Nota média (1–5) | Custo médio/texto | % do Opus | Tempo médio | Passa no critério? |", "|---|---|---|---|---|---|"];
for (const r of rows) {
  const pass = r.score != null && r.cost != null && r.w !== r1.writers[0] && r.score >= opusScore - 0.3 && r.cost <= opusCost * 0.5;
  md.push(`| ${r.w} | ${r.score?.toFixed(2) ?? "falhou"} | ${r.cost != null ? "US$ " + r.cost.toFixed(4) : "—"} | ${r.cost != null ? Math.round((r.cost / opusCost) * 100) + "%" : "—"} | ${r.seconds?.toFixed(1) ?? "—"} s | ${r.w === r1.writers[0] ? "referência" : pass ? "**sim**" : "não"} |`);
}
md.push("", `Critério: nota ≥ Opus − 0,3 (${(opusScore - 0.3).toFixed(2)}) com ≤ 50% do custo do Opus.`, "");
for (const b of report.briefs) {
  md.push(`## ${b.title}`, "");
  for (const v of b.verdicts) md.push(`- **${v.judge}:** ${v.reason}`);
  md.push("", "| Redator | Nota | Grok | Mistral | Custo | Palavras | Fontes válidas | Problemas editoriais |", "|---|---|---|---|---|---|---|---|");
  for (const v of [...b.versions].sort((x, y) => (y.mean ?? -1) - (x.mean ?? -1))) {
    if (v.failed) { md.push(`| ${v.writer} | falhou | — | — | — | — | — | ${v.failed.slice(0, 80)} |`); continue; }
    md.push(`| ${v.writer} | ${v.mean ?? "—"} | ${v.judges?.[JUDGES[0]]?.mean ?? "—"} | ${v.judges?.[JUDGES[1]]?.mean ?? "—"} | US$ ${(v.cost ?? 0).toFixed(4)} | ${v.words} | ${v.sourcesOk ? "sim" : "não"} | ${v.issues?.length ? v.issues.join("; ") : "nenhum"} |`);
  }
  md.push("");
  for (const v of b.versions.filter((x) => x.round === 2 && !x.failed)) md.push(`### ${v.writer}`, "", "```", v.body, "```", "");
}
fs.writeFileSync("docs/benchmarks/exp-308-redator-r2.md", md.join("\n"));
console.log("\n" + md.slice(4, 6 + rows.length).join("\n"));
console.log(`\nGasto da rodada: US$ ${report.spent} · relatório em docs/benchmarks/exp-308-redator-r2.md`);
