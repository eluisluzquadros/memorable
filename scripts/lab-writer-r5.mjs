// EXP-308 round 5: the three Reels again (same briefs, sources, writers and judges as rounds 3–4), now with
// the platform's spoken-brand rule (the script writer is asked to say the brand, and gets one repair when no
// line does). When it finishes, the Reels of rounds 3–4 leave the totals as superseded.
//   node --env-file=.env scripts/lab-writer-r5.mjs [--budget 1.5] [--no-retry] [--audit]
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
const { evidencePack, judgeInstruction, briefAnomaly, auditBrief } = await import("./lab-judge.mjs");
// --audit: free pre-flight, no model call and no change to the round.
const AUDIT = process.argv.includes("--audit");
const audit = [];
const { benchmarkModel, generateVideoScripts, routingPolicy } = await import("../server/ai.mjs");

const RUN = { id: "EXP-308-r5", experiment: "EXP-308", title: "Redator · Reels com a marca falada (refaz os Reels das rodadas 3 e 4)", task: "redator" };
// The six strongest writers so far.
const WRITERS = ["deepseek/deepseek-v4.1-flash", "anthropic/claude-opus-5.5", "google/gemini-3.8-flash", "google/gemini-4-argon", "anthropic/claude-sonnet-5.5", "deepseek/deepseek-v4-pro-0813"];
const JUDGES = ["x-ai/grok-4.7", "mistralai/mistral-large-4-0"];
const PLANNER = "google/gemini-4-argon";
const budget = Number(process.argv[process.argv.indexOf("--budget") + 1]) || 1.5;
const BBMD = "593efd79-f6a5-422c-9080-9422455c5241", SKY = "2fea9c15-0530-49fb-960c-c18b5f7f69a3";
const BRIEFS = [
  { id: "reels-conecta", account: BBMD, workspace: "esfera", source: "77432716", title: "Esfera Conecta em 30 segundos: a pauta que a faculdade não ensina", format: "Reels", durationSeconds: 30 },
  { id: "reels-6x1", account: BBMD, workspace: "esfera", source: "935d1426", title: "Fim da 6x1 em 30 segundos: o que o escritório precisa olhar", format: "Reels", durationSeconds: 30 },
  { id: "reels-bastidores", account: BBMD, workspace: "podcast", source: "title:Gio Lisboa: carreira", title: "Gio Lisboa em 30 segundos: paciência e reinvenção", format: "Reels", durationSeconds: 30 },
];

if (!routingPolicy()) throw new Error("Esta rodada exige o roteamento com privacidade (MEMORAVEL_PRIVACY não pode ser 'standard').");
const key = await (await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${process.env.MEMORABLE_AI_KEY}` } })).json();
const credits = key.data?.limit_remaining == null ? (await (await fetch("https://openrouter.ai/api/v1/credits", { headers: { Authorization: `Bearer ${process.env.MEMORABLE_AI_KEY}` } })).json()).data : null;
const available = key.data?.limit_remaining ?? (credits ? credits.total_credits - credits.total_usage : Infinity);
console.log(`Saldo disponível: US$ ${Number(available).toFixed(2)} · teto da rodada US$ ${budget}`);
if (available < budget) { console.log("Saldo menor que o teto. Nada foi gasto."); process.exit(0); }

const { createAccounts } = await import("../server/accounts.mjs");
const accountStore = createAccounts();
const docs = new Map();
for (const id of [BBMD, SKY]) docs.set(id, (await accountStore.read({ id, name: "", email: "" })).state);
const docOf = (account) => docs.get(account);
const store = createLabStore();
const obs = createObservability(path.resolve(".runtime"));
const model = (name) => obs.instrument(benchmarkModel(name), { route: "lab", runTag: RUN.id, provider: "server" });
// --no-retry keeps earlier model failures as they were (only transient errors deserve another try).
const retryFailed = !process.argv.includes("--no-retry");
const round = AUDIT ? null : await startRound(store, { ...RUN, budget_usd: budget, config: { accounts: [...new Set(BRIEFS.map((b) => b.account))], writers: WRITERS, judges: JUDGES, planner: PLANNER, routing: routingPolicy(), briefs: BRIEFS.map(({ id, title, format }) => ({ id, title, format })), criterion: "piso 4,0; nota ≥ Opus − 0,3 a ≤ 50% do custo", floor: 4.0 } }, { retryFailed });
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const writerSystem = (format) => `Atue como Copywriter/Ghostwriter. ${COPY_METHOD} ${BRAND_WRITING} ${formatGuide(format)} Retorne {title,body,hook,strategy,sourceIds:string[],facts:[{sourceId,excerpt,verified:false}]}. Use packet.sources e packet.brandKnowledge para sustentar afirmações factuais.`;

try {
  const skip = new Set(((await store.run(RUN.id))?.config?.excludedBriefs || []).map((e) => e.id));
  for (const b of BRIEFS) {
    if (skip.has(b.id)) { console.log(`
== ${b.id}: fora dos totais, não é julgada`); continue; }
    console.log(`\n== ${b.id}: ${b.title}`);
    const doc = docOf(b.account);
    const source = b.source.startsWith("title:") ? doc.sources.find((s) => s.workspace === b.workspace && s.title.startsWith(b.source.slice(6))) : doc.sources.find((s) => s.id.startsWith(b.source));
    if (!source) throw new Error(`${b.id}: referência não encontrada (${b.source}).`);
    const packet = contextPacket({ ...doc, workspace: b.workspace || doc.workspace }, { ...b, sourceIds: [source.id], deadline: "2026-11-10" });
    if (!packet.sources.length) throw new Error(`${b.id}: referência indisponível.`);
    const known = [...packet.sources, ...(packet.brandKnowledge || [])];
    if (AUDIT) { audit.push(await auditBrief({ store, runId: RUN.id, brief: b, packet, writers: WRITERS, judges: JUDGES })); continue; }
    const video = b.format === "Reels" || b.format === "Roteiro de vídeo";
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
        // For scripts, only the platform's own timing flags and the format's editorial check count; the caveats
        // a model declares about itself are good behavior, not failures.
        const issues = video
          ? [...(v.warnings || []).filter((w) => /^(As cenas somam|As falas têm)/.test(w)), ...editorialIssues({ body, format: b.format, brief: packet.brief, brand: packet.brand, sources: [] }).map((i) => i.message)]
          : editorialIssues({ body, format: b.format, brief: packet.brief, brand: packet.brand, sources: packet.sources }).map((i) => i.message);
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
      const jkey = `${b.id}|juiz-v2|${judge}|${createHash("sha1").update(versions.map((v) => v.writer).sort().join(",")).digest("hex").slice(0, 8)}`;
      const saved = await store.item(`${RUN.id}|${jkey}`);
      const order = saved?.output?.order || shuffle(versions.map((v) => v.key));
      const label = (k) => String.fromCharCode(65 + order.indexOf(k));
      const what = { LinkedIn: "posts de LinkedIn", Carrossel: "carrosséis para Instagram/LinkedIn (telas numeradas)", Reels: "roteiros de Reels de 30 segundos (falas, cenas e tempo)", Artigo: "artigos", Newsletter: "edições de newsletter", "Legenda Instagram": "legendas de Instagram", "Roteiro de vídeo": "roteiros de vídeo de 60 segundos (falas, cenas e tempo)" }[b.format];
      const item = await round.call({ key: jkey, role: "juiz", model: judge, briefId: b.id, invoke: async (observe) => {
        const verdict = await model(judge)(judgeInstruction(what, video ? `; cabe em ${b.durationSeconds} segundos falados` : ""), {
          ...evidencePack(packet),
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
    const anomaly = briefAnomaly(scores);
    if (anomaly) {
      const run = await store.run(RUN.id);
      const flagged = (run.config.flaggedBriefs || []).filter((f) => f.id !== b.id);
      await store.saveRun({ ...run, config: { ...run.config, flaggedBriefs: [...flagged, { id: b.id, kind: anomaly.kind, reason: anomaly.message }] } });
      console.log(`  ⚠ ${b.id} em revisão: ${anomaly.message}`);
    }

  }
  if (AUDIT) {
    console.table(audit.map((a) => ({ peça: a.brief, formato: a.format, fontes: a.sources, "material da marca": a.brandKnowledge, "nomes da marca": a.brandNames.join(" / "), "juiz vê o mesmo que o redator": a.parity ? "sim" : "NÃO", "textos novos (pagos)": a.toWrite.join(", ") || "nenhum", "falhas mantidas": a.failed.join(", ") || "—", "versões a julgar": a.versions, "tokens por juiz": a.tokens, "custo estimado (US$)": a.cost.toFixed(3) })));
    for (const a of audit) for (const x of a.suspectChecks) console.log(`ATENÇÃO ${a.brief}: ${x.failed} de ${x.of} redatores falham na mesma checagem ("${x.issue.slice(0, 70)}…"). Provável régua errada ou conta incompleta (ex.: marca sem outros nomes); conferir antes de julgar.`);
    console.log(`Custo estimado do julgamento: US$ ${audit.reduce((s, a) => s + a.cost, 0).toFixed(2)} · peças com paridade quebrada: ${audit.filter((a) => !a.parity).length} · textos que seriam escritos de novo: ${audit.reduce((s, a) => s + a.toWrite.length, 0)} · checagens suspeitas: ${audit.reduce((s, a) => s + a.suspectChecks.length, 0)}`);
  } else {
    await round.finish("done");
    for (const [run, ids] of [["EXP-308-r3", ["reels-conecta", "reels-6x1"]], ["EXP-308-r4", ["reels-bastidores"]]]) {
      const r = await store.run(run);
      const kept = (r.config.excludedBriefs || []).filter((e) => !ids.includes(e.id));
      await store.saveRun({ ...r, config: { ...r.config, excludedBriefs: [...kept, ...ids.map((id) => ({ id, reason: "Substituída pela rodada 5 (Reels com a marca falada)." }))] } });
    }
    console.log("Reels das rodadas 3 e 4 marcados como substituídos.");
  }
  if (round) console.log(`\nRodada concluída · gasto US$ ${round.spent.toFixed(3)}`);
} catch (error) {
  console.log(`\n${error.message}`);
  if (!error.budget && round) await round.finish("paused", error.message);
} finally {
  await closePool();
}
