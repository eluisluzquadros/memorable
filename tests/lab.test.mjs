import test from "node:test";
import assert from "node:assert/strict";
import { createLabStore, startRound, labSummary } from "../server/lab.mjs";

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
