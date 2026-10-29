// Live quality check with real models (spends OpenRouter credits): the IRB article becomes a
// Skyvidya carousel and a 15 s Reels script, judged blind by a model from another vendor.
// Usage: node --env-file=.env scripts/live-agents-check.mjs [writerModel] [judgeModel]
import fs from "node:fs/promises";
import { editorialIssues } from "../src/editorial-quality.mjs";

const base = "http://127.0.0.1:5174";
const writer = process.argv[2] || "anthropic/claude-opus-5.5";
const judgeModel = process.argv[3] || "openai/gpt-6.1-sol";
const url = "https://www.irbre.com/dados-climaticos-confiaveis-o-elo-entre-ciencia-e-mercado-segurador-brasileiro/";
const post = async (path, body) => {
  const started = Date.now();
  const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${data.error}`);
  return { data, ms: Date.now() - started };
};

const source = (await post("/api/ingest/url", { url })).data;
const brand = { name: "Skyvidya" };
const voice = {
  positioning: "Inteligência geoespacial, artificial e humana para transformar risco climático em resiliência.",
  audience: "Profissionais de crédito rural, seguros e gestão de riscos climáticos.",
  tone: "Técnico, claro e confiante, sem jargão desnecessário.",
};
const packet = (format, extra = {}) => ({
  brand,
  voice,
  brandKnowledge: [],
  sources: [{ id: "irb-dados-climaticos", title: source.title, origin: source.origin, text: source.text, summary: source.summary, editorialRole: "reference" }],
  brief: { title: "Base climática global não basta: o risco precisa ser validado no território", format, versionCount: 1, deadline: "2026-11-30", audience: voice.audience, offer: "Diagnóstico de aderência territorial das bases climáticas usadas em seguro e crédito rural.", brandName: "Skyvidya", ...extra },
});

const runs = [];
for (const [format, extra] of [["Carrossel", {}], ["Reels", { durationSeconds: 15 }]]) {
  try {
    const { data, ms } = await post("/api/squad", { packet: packet(format, extra), provider: "server", model: writer });
    const version = data.versions[0];
    runs.push({ format, ms, body: version.body, title: version.title, issues: editorialIssues({ body: version.body, format, brief: { ...packet(format, extra).brief }, brand, sources: packet(format).sources }).map((i) => i.message), review: version.editorialReview });
  } catch (e) {
    runs.push({ format, error: e.message });
  }
}

// Blind judge: it sees the brief, the source and the piece, never the writer model.
async function judge(run) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MEMORABLE_AI_KEY}`, "X-Title": "Memoravel benchmark" },
    body: JSON.stringify({
      model: judgeModel,
      response_format: { type: "json_object" },
      usage: { include: true },
      messages: [
        { role: "system", content: "Você é um avaliador cego e exigente de conteúdo de marketing B2B em português. Avalie de 1 a 5: completude (frases e ideias completas para o formato e a duração), clareza, foco_na_marca (fala da Skyvidya e do problema do público, não promove a fonte), sustentacao (afirmações apoiadas na fonte, sem inventar), originalidade (sem clichês, sem repetir o título da fonte). Diga se é publicável sem edição. Responda em json: {completude,clareza,foco_na_marca,sustentacao,originalidade,publicavel:boolean,problemas:string[]}." },
        { role: "user", content: JSON.stringify({ marca: "Skyvidya", publico: voice.audience, formato: run.format, fonte: source.text.slice(0, 6000), peca: run.body }) },
      ],
    }),
  });
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`juiz sem resposta (HTTP ${response.status}): ${JSON.stringify(data.error || data).slice(0, 300)}`);
  return { ...JSON.parse(content.replace(/^```json\s*|```$/g, "")), cost: data.usage?.cost };
}
// Written texts are saved before judging, so a judge failure never loses paid generations.
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const save = () => fs.writeFile(`qa/live-agents/${stamp}.json`, JSON.stringify({ writer, judgeModel, source: { title: source.title, chars: source.text.length }, runs }, null, 2));
await fs.mkdir("qa/live-agents", { recursive: true });
await save();
for (const run of runs) {
  if (run.error) continue;
  try { run.judge = await judge(run); } catch (e) { run.judge = { error: e.message }; }
}
await save();
for (const run of runs) {
  console.log(`\n=== ${run.format} · ${writer} · ${run.ms ? Math.round(run.ms / 1000) + " s" : ""}`);
  if (run.error) { console.log("ERRO:", run.error); continue; }
  console.log(run.body);
  console.log("\nEditor crítico:", run.review?.passed ? `aprovado na rodada ${run.review.rounds}` : `pendente após ${run.review?.rounds} rodadas: ${(run.review?.pending || []).join(" | ")}`);
  console.log("Checagens automáticas:", run.issues.length ? run.issues.join(" | ") : "nenhum problema");
  console.log("Juiz cego (" + judgeModel + "):", JSON.stringify(run.judge));
}
