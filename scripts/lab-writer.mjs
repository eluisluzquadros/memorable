// EXP-308 round 2 through the model lab: ten writers on three LinkedIn briefs, two blind judges from
// families outside every writer. Every answer is stored in bench_items as it arrives (Supabase), so a
// crash, timeout or empty balance never costs the work already paid: run it again and it resumes.
//   node --env-file=.env scripts/lab-writer.mjs [--budget 3]
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

process.env.MEMORAVEL_DB = "postgres";
const { createLabStore, startRound } = await import("../server/lab.mjs");
const { createObservability } = await import("../server/observability.mjs");
const { closePool } = await import("../server/sql.mjs");
const { contextPacket } = await import("../src/operations.mjs");
const { editorialIssues } = await import("../src/editorial-quality.mjs");
const { COPY_METHOD, PLANNER_METHOD, formatGuide } = await import("../src/playbooks.mjs");
const { BRAND_WRITING } = await import("../server/editorial.mjs");
const { benchmarkModel } = await import("../server/ai.mjs");

const RUN = { id: "EXP-308-r2", experiment: "EXP-308", title: "Redator · 10 modelos × 3 posts de LinkedIn", task: "redator" };
const WRITERS = [
  "anthropic/claude-opus-5.5", "openai/gpt-6.1-sol", "openai/gpt-6.1-terra", "anthropic/claude-sonnet-5.5",
  "google/gemini-3.8-flash", "google/gemini-3.5-flash-lite", "openai/gpt-5.4-mini", "openai/gpt-4.1-mini",
  "deepseek/deepseek-v4-pro-0813", "deepseek/deepseek-v4.1-flash",
  // Added after the first pass: it planned the texts, but as a writer it must be measured like the others.
  "google/gemini-4-argon",
];
const JUDGES = ["x-ai/grok-4.7", "mistralai/mistral-large-4-0"]; // no writer comes from these families
const PLANNER = "google/gemini-4-argon"; // one shared plan per brief, so only the writer varies
const budget = Number(process.argv[process.argv.indexOf("--budget") + 1]) || 3;
const ACCOUNT = "593efd79-f6a5-422c-9080-9422455c5241"; // Grupo BBMD
const BRIEFS = [
  { id: "conecta", workspace: "esfera", source: "77432716-34c9-4c3c-bab5-247bb972fcfe", title: "O que o Esfera Conecta trouxe para quem lidera escritório", objective: "Informar", format: "LinkedIn" },
  { id: "6x1", workspace: "esfera", source: "935d1426-d9d1-4410-b67d-494d68b6fb13", title: "Fim da escala 6x1: o que muda para escritórios e clientes", objective: "Informar", format: "LinkedIn" },
  { id: "podcast-vendas", workspace: "podcast", source: "rolim4", title: "Vendas no digital para escritórios: o que o episódio ensina", objective: "Informar", format: "LinkedIn" },
];
// Plans saved in round 1 are reused, so the first two briefs see exactly the same input as before.
const r1 = JSON.parse(fs.readFileSync("docs/benchmarks/exp-308-redator-r1.json", "utf8"));
const savedPlan = Object.fromEntries(r1.briefs.map((b) => [b.id, b.plan]));
const r1Text = Object.fromEntries(r1.briefs.flatMap((b) => b.versions.map((v) => [`${b.id}|${v.writer}`, v])));

// Before paying anything: the OpenRouter key must hold more than the round could spend.
const key = await (await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${process.env.MEMORABLE_AI_KEY}` } })).json();
// Without a cap on the key, the account balance is what limits the round.
const credits = key.data?.limit_remaining == null ? (await (await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${process.env.MEMORABLE_AI_KEY}` } })).json()).data : null;
const available = key.data?.limit_remaining ?? (credits ? credits.total_credits - credits.total_usage : Infinity);
console.log(`Saldo disponível: US$ ${Number(available).toFixed(2)} · teto da rodada US$ ${budget}`);
if (available < budget) {
  console.log(`A chave do OpenRouter tem US$ ${Number(available).toFixed(2)} disponíveis, menos que o teto da rodada (US$ ${budget}). Aumente o limite da chave em openrouter.ai/settings/keys ou rode com --budget menor. Nada foi gasto.`);
  process.exit(0);
}
const store = createLabStore();
const obs = createObservability(path.resolve(".runtime"));
const model = (name, role) => obs.instrument(benchmarkModel(name), { route: "lab", runTag: RUN.id, provider: "server" });
const doc = JSON.parse(new DatabaseSync(".runtime/skyvidya.sqlite", { readOnly: true }).prepare("SELECT document FROM account_state WHERE user_id=?").get(ACCOUNT).document);
// --no-retry keeps earlier model failures as they were (only transient errors deserve another try).
const retryFailed = !process.argv.includes("--no-retry");
const round = await startRound(store, { ...RUN, budget_usd: budget, config: { writers: WRITERS, judges: JUDGES, planner: PLANNER, briefs: BRIEFS.map(({ id, title, workspace, format }) => ({ id, title, workspace, format })), criterion: "nota ≥ Opus − 0,3 a ≤ 50% do custo; piso 4,0", floor: 4.0 } }, { retryFailed });
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const writerSystem = (format) => `Atue como Copywriter/Ghostwriter. ${COPY_METHOD} ${BRAND_WRITING} ${formatGuide(format)} Retorne {title,body,hook,strategy,sourceIds:string[],facts:[{sourceId,excerpt,verified:false}]}. Use packet.sources e packet.brandKnowledge para sustentar afirmações factuais.`;

try {
  for (const b of BRIEFS) {
    console.log(`\n== ${b.id}: ${b.title}`);
    const packet = contextPacket({ ...doc, workspace: b.workspace }, { ...b, sourceIds: [b.source], deadline: "2026-11-10" });
    if (!packet.sources.length) throw new Error(`${b.id}: referência indisponível.`);
    const known = [...packet.sources, ...(packet.brandKnowledge || [])];
    let plan = savedPlan[b.id];
    if (!plan) {
      const item = await round.call({ key: `${b.id}|plano|${PLANNER}`, role: "plano", model: PLANNER, briefId: b.id, invoke: (observe) => model(PLANNER)(`Atue como Trend Hunter e Content Planner. ${PLANNER_METHOD} ${BRAND_WRITING} ${formatGuide(b.format)} Retorne {thesis,evidence,outline,risks,patternUsed}. Não diga que pesquisou na internet.`, packet, observe) });
      plan = item?.output;
      if (!plan) throw new Error(`${b.id}: o plano falhou; rode de novo.`);
    }
    const versions = [];
    for (const writer of WRITERS) {
      const key = `${b.id}|redator|${writer}`;
      const previous = r1Text[`${b.id}|${writer}`];
      // Round-1 texts enter as they were (same input, already paid), with their real cost and time.
      const item = previous
        ? (await store.item(`${RUN.id}|${key}`)) || (await store.saveItem({ key: `${RUN.id}|${key}`, run_id: RUN.id, brief_id: b.id, role: "redator", model: writer, output: { title: previous.title, body: previous.body, sourceIds: [], facts: [] }, cost_usd: previous.cost, seconds: previous.seconds, input_tokens: previous.inputTokens, output_tokens: previous.outputTokens, checks: { ok: previous.sourcesOk && !previous.issues.length, sourcesOk: previous.sourcesOk, issues: previous.issues, reusedFrom: "EXP-308-r1" } }), await store.item(`${RUN.id}|${key}`))
        : await round.call({ key, role: "redator", model: writer, briefId: b.id, invoke: (observe) => model(writer)(writerSystem(b.format), { packet, plan, strategy: "Racional" }, observe) });
      if (!item || item.status !== "done") continue;
      const v = item.output || {};
      if (!item.checks) {
        const body = typeof v.body === "string" ? v.body : "";
        const issues = editorialIssues({ body, format: b.format, brief: packet.brief, brand: packet.brand, sources: packet.sources }).map((i) => i.message);
        const sourcesOk = Array.isArray(v.sourceIds) && v.sourceIds.length > 0 && v.sourceIds.every((id) => known.some((s) => s.id === id));
        const facts = Array.isArray(v.facts) ? v.facts : [];
        const factsVerbatim = facts.filter((f) => known.find((s) => s.id === f.sourceId)?.text.includes(f.excerpt)).length;
        item.checks = { ok: sourcesOk && !issues.length && factsVerbatim === facts.length, sourcesOk, issues, facts: facts.length, factsVerbatim, words: body.split(/\s+/).filter(Boolean).length };
        await round.update(key, { checks: item.checks });
      }
      if (typeof v.body === "string" && v.body.trim()) versions.push({ key, writer, title: v.title || "", body: v.body });
    }
    // Blind judging: anonymous letters in a random order that is saved, so a rerun maps letters the same way.
    const scores = Object.fromEntries(versions.map((v) => [v.key, {}]));
    for (const judge of JUDGES) {
      const jkey = `${b.id}|juiz|${judge}|${createHash("sha1").update(versions.map((v) => v.writer).sort().join(",")).digest("hex").slice(0, 8)}`;
      const saved = await store.item(`${RUN.id}|${jkey}`);
      const order = saved?.output?.order || shuffle(versions.map((v) => v.key));
      const label = (k) => String.fromCharCode(65 + order.indexOf(k));
      const item = await round.call({ key: jkey, role: "juiz", model: judge, briefId: b.id, invoke: async (observe) => {
        const verdict = await model(judge)("Você é editor-chefe e avalia versões anônimas de um mesmo post para a marca do pacote. Julgue só o texto, comparando com as fontes. Para cada versão dê notas inteiras de 1 a 5: clareza, evidencia (fiel às fontes, sem inventar), voz (soa como a marca descrita), utilidade (vale o tempo do leitor). Depois ordene todas da melhor para a pior e diga em uma frase o motivo do primeiro lugar. Retorne {scores:{A:{clareza,evidencia,voz,utilidade},B:{...}},ranking:string[],reason:string}.", {
          brand: packet.brand, voice: packet.voice, brief: packet.brief, sources: packet.sources.map((s) => ({ title: s.title, text: s.text })),
          versions: order.map((k) => { const v = versions.find((x) => x.key === k); return { id: label(k), title: v.title, body: v.body }; }),
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
