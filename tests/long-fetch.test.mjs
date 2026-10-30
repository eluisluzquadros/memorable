import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetry, pollTask, longFetch, OFFLINE_MESSAGE } from "../src/long-fetch.mjs";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const lost = () => Promise.reject(new TypeError("Failed to fetch"));
// Replaces fetch with a scripted list of answers (functions run in order).
function script(answers) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push({ url, init }); const next = answers.shift(); return next ? next(url, init) : lost(); };
  return calls;
}

test("a short request survives one dropped connection, and says so in Portuguese when it cannot", async () => {
  const calls = script([lost, () => json({ ok: true })]);
  const r = await fetchWithRetry("/api/auth/logout", { method: "POST" }, { delayMs: 1 });
  assert.equal(r.status, 200);
  assert.equal(calls.length, 2);
  script([lost, lost, lost]);
  await assert.rejects(fetchWithRetry("/api/text/status", {}, { delayMs: 1 }), { message: OFFLINE_MESSAGE });
});

test("a generation keeps waiting through lost polls and returns the service's answer", async () => {
  const calls = script([
    () => json({ state: "running", seconds: 2 }),
    lost,
    () => json({}, 502),
    () => json({ state: "done", status: 200, data: { versions: [{ title: "v1" }] } }),
  ]);
  const r = await pollTask("t1", undefined, {});
  assert.deepEqual(await r.json(), { versions: [{ title: "v1" }] });
  assert.equal(calls.length, 4);
  assert.ok(calls.every((c) => c.url === "/api/tasks/t1"));
});

test("the generation request carries its own task id and is resent with the same one", async () => {
  const calls = script([lost, (url, init) => json({ task: init.headers["X-Memoravel-Task"] }, 202), () => json({ state: "done", status: 200, data: { ok: 1 } })]);
  let task;
  const r = await longFetch("/api/squad", { method: "POST", body: "{}", headers: {} }, { onTask: (id) => { task = id; } });
  assert.deepEqual(await r.json(), { ok: 1 });
  const [first, second] = calls;
  assert.match(first.init.headers["X-Memoravel-Task"], /^[0-9a-f-]{36}$/);
  assert.equal(second.init.headers["X-Memoravel-Task"], first.init.headers["X-Memoravel-Task"], "same id on the resend");
  assert.equal(task, first.init.headers["X-Memoravel-Task"]);
});
