// EXP-308 round 3 through the model lab: the six best writers of round 2 on two more formats
// (Carrossel, Reels 30 s), three pieces each, with privacy routing on (no training, no retention).
// Every answer is stored as it arrives; run it again to resume.
//   node --env-file=.env scripts/lab-writer-r3.mjs [--budget 2.5]
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { createHash } from "node:crypto";

process.env.MEMORAVEL_DB = "postgres";
const { createLabStore, startRound } = await import("../server/lab.mjs");
const { createObservability } = await import("../server/observability.mjs");
const { closePool } = await import("../server/sql.mjs");
const { contextPacket } = await import("../src/operations.mjs");
const { editorialIssues } = await import("../src/editorial-quality.mjs");
const { scriptBody, spokenWords } = await import("../src/production.mjs");
const { COPY_METHOD, PLANNER_METHOD, formatGuide } = await import("../src/playbooks.mjs");
const { BRAND_WRITING } = await import("../server/editorial.mjs");
const { benchmarkModel, generateVideoScripts, routingPolicy } = await import("../server/ai.mjs");

const RUN = { id: "EXP-308-r3", experiment: "EXP-308", title: "Redator · 6 modelos × Carrossel e Reels 30 s (roteamento com privacidade)", task: "redator" };
// Round 2's six best; the four below the floor are left out, and GPT-6.1 Terra has no provider that meets the privacy policy.
const WRITERS = ["deepseek/deepseek-v4.1-flash", "anthropic/claude-opus-5.5", "google/gemini-3.8-flash", "deepseek/deepseek-v4-pro-0813", "anthropic/claude-sonnet-5.5", "openai/gpt-6.1-sol",
  // Added after the first pass: it plans the texts, but as a writer it must be measured like the others.
  "google/gemini-4-argon"];
const JUDGES = ["x-ai/grok-4.7", "mistralai/mistral-large-4-0"];
const PLANNER = "google/gemini-4-argon";
const budget = Number(process.argv[process.argv.indexOf("--budget") + 1]) || 2.5;
const BBMD = "593efd79-f6a5-422c-9080-9422455c5241", SKY = "2fea9c15-0530-49fb-960c-c18b5f7f69a3";
const BRIEFS = [
  { id: "car-esfera", account: BBMD, workspace: "esfera", source: "3750fb48", title: "Por que o crescimento do escritório trava fora do jurídico", format: "Carrossel" },
  { id: "car-podcast", account: BBMD, workspace: "podcast", source: "rolim2", title: "Liderança feminina na advocacia: o que o episódio mostra", format: "Carrossel" },
  { id: "car-skyvidya", account: SKY, workspace: null, source: "0f386ef8", title: "Dado climático confiável: o elo entre ciência e seguro", format: "Carrossel" },
  { id: "reels-conecta", account: BBMD, workspace: "esfera", source: "77432716", title: "Esfera Conecta em 30 segundos: a pauta que a faculdade não ensina", format: "Reels", durationSeconds: 30 },
  { id: "reels-6x1", account: BBMD, workspace: "esfera", source: "935d1426", title: "Fim da 6x1 em 30 segundos: o que o escritório precisa olhar", format: "Reels", durationSeconds: 30 },
  { id: "reels-vendas", account: BBMD, workspace: "podcast", source: "rolim5", title: "Técnicas de vendas para advogados em 30 segundos", format: "Reels", durationSeconds: 30 },
];

if (!routingPolicy()) throw new Error("Esta rodada exige o roteamento com privacidade (MEMORAVEL_PRIVACY não pode ser 'standard').");
const key = await (await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${process.env.MEMORABLE_AI_KEY}` } })).json();
const credits = key.data?.limit_remaining == null ? (await (await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${process.env.MEMORABLE_AI_KEY}` } })).json()).data : null;
const available = key.data?.limit_remaining ?? (credits ? credits.total_credits - credits.total_usage : Infinity);
console.log(`Saldo disponível: US$ ${Number(available).toFixed(2)} · teto da rodada US$ ${budget}`);
if (available < budget) { console.log("Saldo menor que o teto. Nada foi gasto."); process.exit(0); }

const docs = new Map();
const docOf = (account) => docs.get(account) || docs.set(account, JSON.parse(new DatabaseSync(".runtime/skyvidya.sqlite", { readOnly: true }).prepare("SELECT document FROM account_state WHERE user_id=?").get(account).document)).get(account);
const store = createLabStore();
const obs = createObservability(path.resolve(".runtime"));
const model = (name) => obs.instrument(benchmarkModel(name), { route: "lab", runTag: RUN.id, provider: "server" });
const round = await startRound(store, { ...RUN, budget_usd: budget, config: { writers: WRITERS, judges: JUDGES, planner: PLANNER, routing: routingPolicy(), briefs: BRIEFS.map(({ id, title, format }) => ({ id, title, format })), criterion: "piso 4,0; nota ≥ Opus − 0,3 a ≤ 50% do custo", floor: 4.0 } });
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const writerSystem = (format) => `Atue como Copywriter/Ghostwriter. ${COPY_METHOD} ${BRAND_WRITING} ${formatGuide(format)} Retorne {title,body,hook,strategy,sourceIds:string[],facts:[{sourceId,excerpt,verified:false}]}. Use packet.sources e packet.brandKnowledge para sustentar afirmações factuais.`;

try {
  for (const b of BRIEFS) {
    console.log(`\n== ${b.id}: ${b.title}`);
    const doc = docOf(b.account);
    const source = doc.sources.find((s) => s.id.startsWith(b.source));
    const packet = contextPacket({ ...doc, workspace: b.workspace || doc.workspace }, { ...b, sourceIds: [source.id], deadline: "2026-11-10" });
    if (!packet.sources.length) throw new Error(`${b.id}: referência indisponível.`);
    const known = [...packet.sources, ...(packet.brandKnowledge || [])];
    const video = b.format === "Reels";
    let plan = null;
    if (!video) {
      const item = await round.call({ key: `${b.id}|plano|${PLANNER}`, role: "plano", model: PLANNER, briefId: b.id, invoke: (observe) => model(PLANNER)(`Atue como Trend Hunter e Content Planner. ${PLANNER_METHOD} ${BRAND_WRITING} ${formatGuide(b.format)} Retorne {thesis,evidence,outline,risks,patternUsed}. Não diga que pesquisou na internet.`, packet, observe) });
      plan = item?.output;
      if (!plan) throw new Error(`${b.id}: o plano falhou; rode de novo.`);
    }
    const versions = [];
    for (const writer of WRITERS) {
      const k = `${b.id}|redator|${writer}`;
      const item = await round.call({ key: k, role: "redator", model: writer, briefId: b.id, invoke: async (observe) => {
        if (!video) return model(writer)(writerSystem(b.format), { packet, plan, strategy: "Racional" }, observe);
        // The Reels path is the platform's own script writer, without its review committee.
        const result = await generateVideoScripts(packet, [{ id: b.id, title: b.title, sourceId: source.id }], (s, d) => model(writer)(s, d, observe), { validate: false, committee: false });
        const s = result.scripts[0];
        return { title: s.title, body: scriptBody(s), scenes: s.scenes, warnings: s.warnings, sourceIds: s.sourceIds, facts: [] };
      } });
      if (!item || item.status !== "done") continue;
      const v = item.output || {};
      if (!item.checks) {
        const body = typeof v.body === "string" ? v.body : "";
        const issues = video ? [...(v.warnings || [])] : editorialIssues({ body, format: b.format, brief: packet.brief, brand: packet.brand, sources: packet.sources }).map((i) => i.message);
        const sourcesOk = Array.isArray(v.sourceIds) && v.sourceIds.length > 0 && v.sourceIds.every((id) => known.some((s) => s.id === id));
        const facts = Array.isArray(v.facts) ? v.facts : [];
        const factsVerbatim = facts.filter((f) => known.find((s) => s.id === f.sourceId)?.text.includes(f.excerpt)).length;
        const timing = video ? { seconds: (v.scenes || []).reduce((n, c) => n + (c.duration || 0), 0), words: spokenWords({ scenes: v.scenes || [] }) } : null;
        item.checks = { ok: sourcesOk && !issues.length && factsVerbatim === facts.length, sourcesOk, issues, facts: facts.length, factsVerbatim, words: body.split(/\s+/).filter(Boolean).length, timing };
        await round.update(k, { checks: item.checks });
      }
      if (typeof v.body === "string" && v.body.trim()) versions.push({ key: k, writer, title: v.title || "", body: v.body });
    }
    const scores = Object.fromEntries(versions.map((v) => [v.key, {}]));
    for (const judge of JUDGES) {
      const jkey = `${b.id}|juiz|${judge}|${createHash("sha1").update(versions.map((v) => v.writer).sort().join(",")).digest("hex").slice(0, 8)}`;
      const saved = await store.item(`${RUN.id}|${jkey}`);
      const order = saved?.output?.order || shuffle(versions.map((v) => v.key));
      const label = (k) => String.fromCharCode(65 + order.indexOf(k));
      const what = video ? "roteiros de Reels de 30 segundos (falas, cenas e tempo)" : "carrosséis para Instagram/LinkedIn (telas numeradas)";
      const item = await round.call({ key: jkey, role: "juiz", model: judge, briefId: b.id, invoke: async (observe) => {
        const verdict = await model(judge)(`Você é editor-chefe e avalia versões anônimas de ${what} para a marca do pacote. Julgue só o texto, comparando com as fontes. Para cada versão dê notas inteiras de 1 a 5: clareza, evidencia (fiel às fontes, sem inventar), voz (soa como a marca descrita), utilidade (vale o tempo do público${video ? "; cabe em 30 segundos falados" : ""}). Depois ordene todas da melhor para a pior e diga em uma frase o motivo do primeiro lugar. Retorne {scores:{A:{clareza,evidencia,voz,utilidade},B:{...}},ranking:string[],reason:string}.`, {
          brand: packet.brand, voice: packet.voice, brief: packet.brief, sources: packet.sources.map((s) => ({ title: s.title, text: s.text })),
          versions: order.map((kk) => { const v = versions.find((x) => x.key === kk); return { id: label(kk), title: v.title, body: v.body }; }),
        }, observe);
        return { ...verdict, order };
      } });
      if (!item) continue;
      for (const v of versions) {
        const s = item.output.scores?.[label(v.key)];
        if (s && [s.clareza, s.evidencia, s.voz, s.utilidade].every(Number.isFinite)) scores[v.key][judge] = { ...s, mean: (s.clareza + s.evidencia + s.voz + s.utilidade) / 4, rank: (item.output.ranking || []).indexOf(label(v.key)) + 1 || null };
      }
    }
    for (const v of versions) {
      const means = Object.values(scores[v.key]).map((s) => s.mean);
      await round.update(v.key, { scores: scores[v.key], mean: means.length ? Math.round((means.reduce((a, c) => a + c, 0) / means.length) * 100) / 100 : null });
    }
  }
  await round.finish("done");
  console.log(`\nRodada concluída · gasto US$ ${round.spent.toFixed(3)}`);
} catch (error) {
  console.log(`\n${error.message}`);
  if (!error.budget) await round.finish("paused", error.message);
} finally {
  await closePool();
}
