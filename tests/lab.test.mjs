import test from "node:test";
import assert from "node:assert/strict";
import { createLabStore, startRound, labSummary, labStats, labView, canOpenRun, transientError } from "../server/lab.mjs";

const quiet = () => {};

test("a round resumes from saved answers and never pays twice; the budget pauses it without losing work", async () => {
  const store = createLabStore(":memory:");
  let paid = 0;
  const invoke = (cost) => async (observe) => { paid++; observe({ cost, inputTokens: 10, outputTokens: 5 }); return { body: "texto" }; };
  const round = await startRound(store, { id: "EXP-T-r1", experiment: "EXP-T", title: "teste", task: "redator", budget_usd: 0.05 }, { log: quiet });
  await round.call({ key: "b1|redator|a", role: "redator", model: "a", briefId: "b1", invoke: invoke(0.03) });
  await round.call({ key: "b1|redator|b", role: "redator", model: "b", briefId: "b1", invoke: invoke(0.03) });
  await assert.rejects(round.call({ key: "b1|redator|c", role: "redator", model: "c", briefId: "b1", invoke: invoke(0.01) }), /Teto/);
  assert.equal(paid, 2);
  assert.equal((await store.run("EXP-T-r1")).status, "paused");
  // Next attempt with a higher ceiling: the two saved answers are reused, only "c" is paid.
  const again = await startRound(store, { id: "EXP-T-r1", experiment: "EXP-T", title: "teste", task: "redator", budget_usd: 1 }, { log: quiet });
  const a = await again.call({ key: "b1|redator|a", role: "redator", model: "a", briefId: "b1", invoke: invoke(0.03) });
  await again.call({ key: "b1|redator|c", role: "redator", model: "c", briefId: "b1", invoke: invoke(0.01) });
  assert.equal(a.output.body, "texto");
  assert.equal(paid, 3);
  assert.ok(Math.abs(again.spent - 0.07) < 1e-9);
  // A failure is recorded and retried later, not cached as an answer.
  const failed = await again.call({ key: "b1|redator|d", role: "redator", model: "d", briefId: "b1", invoke: async () => { throw new Error("tempo esgotado"); } });
  assert.equal(failed, null);
  assert.equal((await store.item("EXP-T-r1|b1|redator|d")).status, "failed");
  await again.call({ key: "b1|redator|d", role: "redator", model: "d", briefId: "b1", invoke: invoke(0.01) });
  assert.equal((await store.item("EXP-T-r1|b1|redator|d")).status, "done");
});

test("profiles: the cheapest qualified, the cheapest near the best, and the best", () => {
  const runs = [{ id: "r", task: "redator" }];
  const items = [];
  const add = (model, mean, cost, evidence = 4, ok = true) => {
    for (let n = 0; n < 3; n++) items.push({ run_id: "r", role: "redator", model, status: "done", mean, cost_usd: cost, seconds: 10, scores: { j: { evidencia: evidence } }, checks: { ok } });
  };
  add("caro", 4.9, 0.15);
  add("medio", 4.7, 0.03);
  add("barato", 4.1, 0.005);
  add("ruim", 3.6, 0.001);
  add("inventa", 4.6, 0.002, 2);
  const s = labSummary(items, runs);
  assert.deepEqual(s.profiles.redator, { essencial: "barato", equilibrado: "medio", excelencia: "caro" });
  const why = Object.fromEntries(s.models.map((m) => [m.model, m.qualified ? "ok" : m.why]));
  assert.match(why.ruim, /abaixo do piso de 4,0/);
  assert.match(why.inventa, /um juiz deu 2 de 5 em evidência: o texto afirma algo que a fonte não sustenta/);
  // Fewer than three judged outputs never qualify, however good.
  const few = labSummary(items.filter((i) => i.model !== "caro").concat([{ run_id: "r", role: "redator", model: "novo", status: "done", mean: 5, cost_usd: 0.001, scores: {}, checks: { ok: true } }]), runs);
  assert.match(few.models.find((m) => m.model === "novo").why, /só 1 de 3 textos avaliados/);
});

test("with retryFailed off, a model's own failure stays recorded instead of being retried", async () => {
  const store = createLabStore(":memory:");
  const round = await startRound(store, { id: "EXP-F-r1", experiment: "EXP-F", title: "t", task: "redator", budget_usd: 1 }, { log: quiet });
  await round.call({ key: "b|redator|x", role: "redator", model: "x", invoke: async () => { throw new Error("formato inválido"); } });
  let paid = 0;
  const strict = await startRound(store, { id: "EXP-F-r1", experiment: "EXP-F", title: "t", task: "redator", budget_usd: 1 }, { log: quiet, retryFailed: false });
  assert.equal(await strict.call({ key: "b|redator|x", role: "redator", model: "x", invoke: async () => { paid++; return {}; } }), null);
  assert.equal(paid, 0);
  assert.equal((await store.item("EXP-F-r1|b|redator|x")).status, "failed");
});

test("a model that breaks the format in more than 10% of attempts does not qualify", () => {
  const runs = [{ id: "r", task: "redator" }];
  const items = [];
  for (let n = 0; n < 6; n++) items.push({ run_id: "r", role: "redator", model: "quebra", status: "done", mean: 4.8, cost_usd: 0.01, scores: { j: { evidencia: 5 } }, checks: { ok: true } });
  items.push({ run_id: "r", role: "redator", model: "quebra", status: "failed", error: "roteiro incompleto" });
  const row = labSummary(items, runs).models.find((m) => m.model === "quebra");
  assert.equal(row.qualified, false);
  assert.match(row.why, /Quebrou o formato em 1 de 7 tentativas/);
});

test("overall and per-format views; excluded briefs leave every total", () => {
  const runs = [{ id: "r", task: "redator", config: { briefs: [{ id: "a", format: "LinkedIn" }, { id: "b", format: "LinkedIn" }, { id: "c", format: "LinkedIn" }, { id: "x", format: "Reels" }, { id: "y", format: "Reels" }, { id: "z", format: "Reels" }, { id: "bad", format: "Reels" }], excludedBriefs: [{ id: "bad", reason: "fonte de outra marca" }] } }];
  const items = [];
  const put = (model, brief, mean) => items.push({ run_id: "r", brief_id: brief, role: "redator", model, status: "done", mean, cost_usd: 0.01, scores: { j: { evidencia: 4 } }, checks: { ok: true } });
  for (const b of ["a", "b", "c"]) { put("texto", b, 4.8); put("video", b, 4.0); }
  for (const b of ["x", "y", "z"]) { put("texto", b, 3.8); put("video", b, 4.7); }
  put("texto", "bad", 1);
  const s = labSummary(items, runs);
  assert.deepEqual(s.formats.sort(), ["LinkedIn", "Reels"]);
  assert.equal(s.byFormat.LinkedIn.profiles.redator.excelencia, "texto");
  assert.equal(s.byFormat.Reels.profiles.redator.excelencia, "video");
  assert.equal(s.models.find((m) => m.model === "texto").judged, 6, "the excluded brief is not counted");
  assert.equal(s.excluded[0].reason, "fonte de outra marca");
});

test("a rerun keeps the decisions recorded on the round (excluded and flagged briefs)", async () => {
  const store = createLabStore(":memory:");
  await startRound(store, { id: "EXP-K-r1", experiment: "EXP-K", title: "t", task: "redator", config: { briefs: [{ id: "a", format: "LinkedIn" }] } }, { log: quiet });
  const run = await store.run("EXP-K-r1");
  await store.saveRun({ ...run, config: { ...run.config, excludedBriefs: [{ id: "a", reason: "fonte de outra marca" }], flaggedBriefs: [{ id: "b", reason: "anomalia" }] } });
  await startRound(store, { id: "EXP-K-r1", experiment: "EXP-K", title: "t", task: "redator", config: { briefs: [{ id: "a", format: "LinkedIn" }], writers: ["x"] } }, { log: quiet });
  const after = await store.run("EXP-K-r1");
  assert.equal(after.config.excludedBriefs[0].reason, "fonte de outra marca");
  assert.equal(after.config.flaggedBriefs[0].id, "b");
  assert.deepEqual(after.config.writers, ["x"]);
});

test("benchmark stats: spending counts every paid call, quality only the ranked texts", () => {
  const runs = [{ id: "r", task: "redator", config: { briefs: [{ id: "a", format: "LinkedIn" }, { id: "bad", format: "LinkedIn" }], excludedBriefs: [{ id: "bad", reason: "outra marca" }] } }];
  const items = [
    { run_id: "r", brief_id: "a", role: "plano", model: "p", status: "done", cost_usd: 0.01 },
    { run_id: "r", brief_id: "a", role: "redator", model: "m1", status: "done", mean: 4.5, cost_usd: 0.02, seconds: 10 },
    { run_id: "r", brief_id: "a", role: "redator", model: "m2", status: "done", mean: 3.5, cost_usd: 0.04, seconds: 30 },
    { run_id: "r", brief_id: "a", role: "redator", model: "m3", status: "failed", cost_usd: 0.005 },
    { run_id: "r", brief_id: "a", role: "juiz", model: "j", status: "done", cost_usd: 0.05 },
    { run_id: "r", brief_id: "bad", role: "redator", model: "m1", status: "done", mean: 1, cost_usd: 0.03, seconds: 99 },
  ];
  const { overall, byFormat } = labStats(items, runs);
  assert.ok(Math.abs(overall.spent - 0.155) < 1e-9, "the excluded piece was paid for, so it is spent");
  assert.equal(overall.texts, 3);
  assert.equal(overall.failures, 1);
  assert.equal(overall.mean, 4, "the excluded piece does not lower the quality");
  assert.ok(Math.abs(overall.costPerText - 0.03) < 1e-9);
  assert.equal(overall.judgeCalls, 1);
  assert.deepEqual(Object.keys(byFormat), ["LinkedIn"]);
});

test("the public benchmark shows numbers; texts, briefs and reasons stay with the accounts that produced them", () => {
  const runs = [{ id: "r", experiment: "E", title: "Rodada", task: "redator", status: "done", spent_usd: 1, config: { accounts: ["dono"], briefs: [{ id: "a", title: "Pauta sigilosa", format: "LinkedIn" }, { id: "bad", format: "LinkedIn" }], excludedBriefs: [{ id: "bad", reason: "motivo interno" }] } }];
  const items = [{ run_id: "r", brief_id: "a", role: "redator", model: "m", status: "done", mean: 4.2, cost_usd: 0.01, output: { body: "texto do cliente" } }];
  const pub = labView(items, runs, "outra-conta");
  assert.equal(pub.access, "public");
  assert.equal(pub.runs[0].config, undefined);
  assert.equal(pub.runs[0].open, false);
  assert.deepEqual(pub.summary.excluded, []);
  assert.equal(pub.summary.excludedCount, 1);
  assert.ok(!JSON.stringify(pub).includes("texto do cliente") && !JSON.stringify(pub).includes("Pauta sigilosa") && !JSON.stringify(pub).includes("motivo interno"));
  assert.equal(pub.summary.models[0].mean, 4.2, "the scores are public");
  const own = labView(items, runs, "dono");
  assert.equal(own.access, "owner");
  assert.equal(own.runs[0].config.briefs[0].title, "Pauta sigilosa");
  assert.equal(own.summary.excluded[0].reason, "motivo interno");
  assert.equal(canOpenRun(runs[0], "dono"), true);
  assert.equal(canOpenRun(runs[0], undefined), false);
});

test("network drops and rate limits are always retried; a model's own failure is kept as a result", () => {
  for (const e of ["read ECONNRESET", "terminated", "O provedor de IA limitou as requisições por agora.", "HTTP 503", "connect ETIMEDOUT 1.2.3.4:443"]) assert.equal(transientError(e), true, e);
  for (const e of ["O provedor retornou um formato incompatível com o contrato JSON.", "O roteiro voltou incompleto mesmo após uma correção: faltam os campos technique."]) assert.equal(transientError(e), false, e);
});
