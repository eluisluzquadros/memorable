import test from "node:test";
import assert from "node:assert/strict";
import { createLabStore, startRound, labSummary, labStats, labView, transientError, generationSetups, billCheck } from "../server/lab.mjs";
import { createObservability } from "../server/observability.mjs";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";

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

test("the lab view carries everything the platform team needs: rounds with their texts, totals, excluded pieces", () => {
  const runs = [{ id: "r", experiment: "E", title: "Rodada", task: "redator", status: "done", spent_usd: 1, config: { briefs: [{ id: "a", title: "Pauta", format: "LinkedIn" }, { id: "bad", format: "LinkedIn" }], excludedBriefs: [{ id: "bad", reason: "motivo interno" }] } }];
  const items = [{ run_id: "r", brief_id: "a", role: "redator", model: "m", status: "done", mean: 4.2, cost_usd: 0.01, output: { body: "texto" } }];
  const view = labView(items, runs);
  assert.equal(view.runs[0].open, true);
  assert.equal(view.runs[0].config.briefs[0].title, "Pauta");
  assert.equal(view.summary.excluded[0].reason, "motivo interno");
  assert.equal(view.summary.excludedCount, 1);
  assert.equal(view.summary.models[0].mean, 4.2);
  assert.ok(view.stats.overall.spent > 0);
});

test("network drops and rate limits are always retried; a model's own failure is kept as a result", () => {
  for (const e of ["read ECONNRESET", "terminated", "O provedor de IA limitou as requisições por agora.", "HTTP 503", "connect ETIMEDOUT 1.2.3.4:443"]) assert.equal(transientError(e), true, e);
  for (const e of ["O provedor retornou um formato incompatível com o contrato JSON.", "O roteiro voltou incompleto mesmo após uma correção: faltam os campos technique."]) assert.equal(transientError(e), false, e);
});

test("spend: a text reused from an earlier round is paid once; the overall spend is what the rounds paid", () => {
  const runs = [
    { id: "r1", task: "redator", spent_usd: 0.12, config: { briefs: [{ id: "a", format: "LinkedIn" }] } },
    { id: "r2", task: "redator", spent_usd: 0.05, config: { briefs: [{ id: "a", format: "LinkedIn" }] } },
  ];
  const items = [
    { run_id: "r1", brief_id: "a", role: "redator", model: "m", status: "done", mean: 4, cost_usd: 0.1 },
    { run_id: "r2", brief_id: "a", role: "redator", model: "m", status: "done", mean: 4, cost_usd: 0.1, checks: { reusedFrom: "r1" } },
    { run_id: "r2", brief_id: "a", role: "redator", model: "n", status: "done", mean: 4, cost_usd: 0.05 },
  ];
  const { overall, byFormat } = labStats(items, runs);
  assert.ok(Math.abs(byFormat.LinkedIn.spent - 0.15) < 1e-9, "the reused text is not paid again");
  assert.equal(byFormat.LinkedIn.calls, 2);
  assert.ok(Math.abs(overall.spent - 0.17) < 1e-9, "the rounds paid 0.17 (a plan outside the items included)");
  assert.ok(Math.abs(overall.unassigned - 0.02) < 1e-9);
  assert.ok(Math.abs(overall.costPerText - (0.25 / 3)) < 1e-9, "cost per text still uses every text's own cost");
});

test("whole generations are read from the call sequence and checked against the provider's bill", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "obs-"));
  const obs = createObservability(dir);
  const at = (s) => new Date(Date.parse("2026-10-30T03:55:00Z") + s * 1000).toISOString();
  const calls = [
    // generation 1 (Sonnet writes, Argon reviews); generation 2 starts 22 s later with its own script writer
    [0, "Roteirista", "anthropic/claude-sonnet-5.5", 0.05], [10, "Comitê de roteiro", "google/gemini-4-argon", 0.01], [20, "Editor crítico", "google/gemini-4-argon", 0.02],
    [42, "Roteirista", "google/gemini-4-argon", 0.02], [50, "Editor crítico", "google/gemini-4-argon", 0.02],
    // an attempt that stopped before the editor
    [900, "Planejador", "anthropic/claude-opus-5.5", 0.13],
  ];
  for (const [s, role, model, cost] of calls)
    await obs.instrument(Object.assign(async (system, data, observe) => { observe({ cost }); return {}; }, { modelName: model }), { owner: "ana", route: "/api/squad" })(role === "Roteirista" ? "Você é roteirista" : role === "Planejador" ? "Content Planner" : role === "Editor crítico" ? "Você é editor crítico" : "Revise o lote pela perspectiva", {});
  // The calls are recorded back to back, so the split comes from the first step of each generation.
  const list = await obs.generations({ since: "1970-01-01" });
  assert.deepEqual(list.map((g) => [g.calls, g.complete, g.writers[0]]), [
    [3, true, "anthropic/claude-sonnet-5.5"], [2, true, "google/gemini-4-argon"], [1, false, "anthropic/claude-opus-5.5"],
  ]);
  assert.ok(Math.abs(list[0].cost - 0.08) < 1e-9);
  const setups = generationSetups([
    { at: at(0), cost: 0.08, calls: 3, seconds: 20, complete: true, writers: ["anthropic/claude-sonnet-5.5"], reviewers: ["google/gemini-4-argon"] },
    { at: at(42), cost: 0.04, calls: 2, seconds: 8, complete: true, writers: ["google/gemini-4-argon"], reviewers: ["google/gemini-4-argon"] },
    { at: at(60), cost: 0.06, calls: 2, seconds: 8, complete: true, writers: ["google/gemini-4-argon"], reviewers: ["google/gemini-4-argon"] },
    { at: at(900), cost: 0.13, calls: 1, seconds: 30, complete: false, writers: ["anthropic/claude-opus-5.5"], reviewers: [] },
  ]);
  assert.equal(setups.setups.length, 2);
  const argon = setups.setups.find((s) => s.writers[0] === "google/gemini-4-argon");
  assert.deepEqual([argon.count, argon.minCost, argon.maxCost], [2, 0.04, 0.06]);
  assert.deepEqual(setups.attempts, { count: 1, cost: 0.13 });
  const bill = billCheck({ total: 22.37, checkedAt: "x" }, [{ spent_usd: 12.68 }], { lab: 12.13, accounts: 3.46, unowned: 4.78 });
  assert.ok(Math.abs(bill.recorded - 20.92) < 1e-9);
  assert.ok(Math.abs(bill.unrecorded - 1.45) < 1e-9, "what the bill has beyond the records is shown, not hidden");
  assert.equal(billCheck(null, [], {}), null);
  obs.close();
});
