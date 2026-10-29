// EXP-308 — Writer benchmark: same packet, same plan, same Writer prompt as the squad, different models.
// A blind judge from another family scores the shuffled versions. Costs come from the provider.
//   node --env-file=.env scripts/bench-writer.mjs [--budget 0.9]
// Reads the BBMD group account from the local copy (.runtime), writes docs/benchmarks/exp-308-*.json/.md.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { contextPacket } from "../src/operations.mjs";
import { editorialIssues } from "../src/editorial-quality.mjs";
import { COPY_METHOD, PLANNER_METHOD, formatGuide } from "../src/playbooks.mjs";
import { BRAND_WRITING } from "../server/editorial.mjs";
import { serverModel } from "../server/ai.mjs";

const WRITERS = ["anthropic/claude-opus-5.5", "openai/gpt-6.1-sol", "openai/gpt-6.1-terra"];
const PLANNER = "google/gemini-4-argon"; // one shared plan per brief, so only the writer varies
const JUDGE = "google/gemini-4-argon"; // a family different from every writer
const budget = Number(process.argv[process.argv.indexOf("--budget") + 1]) || 0.9;
const ACCOUNT = "593efd79-f6a5-422c-9080-9422455c5241"; // Grupo BBMD
const BRIEFS = [
  { id: "conecta", workspace: "esfera", source: "77432716-34c9-4c3c-bab5-247bb972fcfe", title: "O que o Esfera Conecta trouxe para quem lidera escritório", objective: "Informar", format: "LinkedIn" },
  { id: "6x1", workspace: "esfera", source: "935d1426-d9d1-4410-b67d-494d68b6fb13", title: "Fim da escala 6x1: o que muda para escritórios e clientes", objective: "Informar", format: "LinkedIn" },
];

const doc = JSON.parse(new DatabaseSync(".runtime/skyvidya.sqlite", { readOnly: true }).prepare("SELECT document FROM account_state WHERE user_id=?").get(ACCOUNT).document);
let spent = 0;
const ledger = [];
async function call(modelName, role, system, data) {
  if (spent >= budget) throw new Error(`Teto de US$ ${budget} atingido; parei antes de ${role}.`);
  const model = serverModel(modelName);
  let usage = {};
  const started = performance.now();
  const result = await model(system, data, (u) => { usage = { ...usage, ...u }; });
  const entry = { model: modelName, role, seconds: Math.round((performance.now() - started) / 100) / 10, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cost: usage.cost ?? null };
  spent += entry.cost || 0;
  ledger.push(entry);
  console.log(`  ${role.padEnd(9)} ${modelName.padEnd(28)} ${String(entry.seconds).padStart(5)} s  ${String(entry.inputTokens).padStart(6)}→${String(entry.outputTokens).padStart(5)} tok  US$ ${(entry.cost ?? 0).toFixed(4)}  (acumulado ${spent.toFixed(3)})`);
  return { result, entry };
}
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

const report = { experiment: "EXP-308 rodada 1 · Redator", at: new Date().toISOString(), writers: WRITERS, planner: PLANNER, judge: JUDGE, briefs: [] };
for (const b of BRIEFS) {
  console.log(`\n== ${b.id}: ${b.title}`);
  const state = { ...doc, workspace: b.workspace };
  const packet = contextPacket(state, { ...b, sourceIds: [b.source], deadline: "2026-11-10" });
  if (!packet.sources.length) throw new Error(`${b.id}: referência indisponível no pacote.`);
  const { result: plan } = await call(PLANNER, "plano", `Atue como Trend Hunter e Content Planner. ${PLANNER_METHOD} ${BRAND_WRITING} ${formatGuide(b.format)} Retorne {thesis,evidence,outline,risks,patternUsed}. Não diga que pesquisou na internet.`, packet);
  const allowed = new Set([...packet.sources, ...(packet.brandKnowledge || [])].map((s) => s.id));
  const versions = [];
  for (const writer of WRITERS) {
    const { result: v, entry } = await call(writer, "redator", `Atue como Copywriter/Ghostwriter. ${COPY_METHOD} ${BRAND_WRITING} ${formatGuide(b.format)} Retorne {title,body,hook,strategy,sourceIds:string[],facts:[{sourceId,excerpt,verified:false}]}. Use packet.sources e packet.brandKnowledge para sustentar afirmações factuais.`, { packet, plan, strategy: "Racional" });
    const issues = editorialIssues({ body: v.body || "", format: b.format, brief: packet.brief, brand: packet.brand, sources: packet.sources });
    const sourcesOk = Array.isArray(v.sourceIds) && v.sourceIds.length > 0 && v.sourceIds.every((id) => allowed.has(id));
    const factsOk = (v.facts || []).filter((f) => [...packet.sources, ...(packet.brandKnowledge || [])].find((s) => s.id === f.sourceId)?.text.includes(f.excerpt)).length;
    versions.push({ writer, body: v.body || "", title: v.title || "", words: (v.body || "").split(/\s+/).filter(Boolean).length, issues: issues.map((i) => i.message), sourcesOk, facts: (v.facts || []).length, factsVerbatim: factsOk, ...entry });
  }
  // Blind: the judge sees letters, never model names, in a random order.
  const order = shuffle(versions.map((_, i) => i));
  const letters = ["A", "B", "C"];
  const { result: verdict } = await call(JUDGE, "juiz", "Você é editor-chefe e avalia versões anônimas de um mesmo post para a marca do pacote. Julgue só o texto. Para cada versão dê notas de 1 a 5: clareza, evidencia (fiel às fontes, sem inventar), voz (soa como a marca), utilidade (vale o tempo do leitor). Depois ordene da melhor para a pior e diga em uma frase o motivo do primeiro lugar. Retorne {scores:{A:{clareza,evidencia,voz,utilidade},...},ranking:string[],reason:string}.", {
    brand: packet.brand, voice: packet.voice, brief: packet.brief, sources: packet.sources.map((s) => ({ title: s.title, text: s.text })),
    versions: order.map((vi, k) => ({ id: letters[k], title: versions[vi].title, body: versions[vi].body })),
  });
  order.forEach((vi, k) => {
    const s = verdict.scores?.[letters[k]] || {};
    versions[vi].letter = letters[k];
    versions[vi].scores = s;
    versions[vi].mean = Math.round(((s.clareza + s.evidencia + s.voz + s.utilidade) / 4) * 100) / 100;
    versions[vi].rank = (verdict.ranking || []).indexOf(letters[k]) + 1 || null;
  });
  report.briefs.push({ ...b, plan, verdict: { ranking: verdict.ranking, reason: verdict.reason }, versions });
}
report.ledger = ledger;
report.spent = Math.round(spent * 10000) / 10000;
fs.mkdirSync("docs/benchmarks", { recursive: true });
fs.writeFileSync("docs/benchmarks/exp-308-redator-r1.json", JSON.stringify(report, null, 2));

const md = [`# EXP-308 · rodada 1 · Redator (${report.at.slice(0, 10)})`, "", `Planejador e juiz cego: ${JUDGE}. Gasto total: US$ ${report.spent}.`, ""];
for (const b of report.briefs) {
  md.push(`## ${b.title}`, "", "| Redator | Nota média (1–5) | Posição | Custo | Tempo | Palavras | Fontes válidas | Problemas editoriais |", "|---|---|---|---|---|---|---|---|");
  for (const v of b.versions) md.push(`| ${v.writer} | ${v.mean} | ${v.rank ?? "—"}º | US$ ${(v.cost ?? 0).toFixed(4)} | ${v.seconds} s | ${v.words} | ${v.sourcesOk ? "sim" : "não"} | ${v.issues.length ? v.issues.join("; ") : "nenhum"} |`);
  md.push("", `Juiz: ${b.verdict.reason}`, "");
  for (const v of b.versions) md.push(`### ${v.writer}`, "", "```", v.body, "```", "");
}
fs.writeFileSync("docs/benchmarks/exp-308-redator-r1.md", md.join("\n"));
console.log(`\nGasto total: US$ ${report.spent} · relatório em docs/benchmarks/exp-308-redator-r1.md`);
