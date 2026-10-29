import test from "node:test";
import assert from "node:assert/strict";
import { createTasks, bufferedRequest, capturedResponse } from "../server/tasks.mjs";

const settle = () => new Promise((r) => setTimeout(r, 20));

test("a background task answers like the route, only to whoever started it", async () => {
  const tasks = createTasks();
  let release;
  const id = tasks.start("ana", "/api/squad", () => new Promise((r) => { release = r; }));
  assert.equal(tasks.get(id, "ana").state, "running");
  assert.equal(tasks.get(id, "rui"), null, "another account cannot read it");
  assert.equal(tasks.get("forged", "ana"), null);
  await settle();
  release({ status: 200, data: { versions: [1] } });
  await settle();
  assert.deepEqual({ ...tasks.get(id, "ana"), seconds: 0 }, { state: "done", status: 200, data: { versions: [1] }, seconds: 0 });
});

test("route errors keep their status; too many at once is refused", async () => {
  const tasks = createTasks({ perOwner: 2 });
  const failed = tasks.start("ana", "/api/refine", async () => { const e = new Error("créditos"); e.status = 402; throw e; });
  tasks.start("ana", "/api/squad", () => new Promise(() => {}));
  await settle();
  assert.deepEqual(tasks.get(failed, "ana").data, { error: "créditos" });
  assert.equal(tasks.get(failed, "ana").status, 402);
  tasks.start("ana", "/api/squad", () => new Promise(() => {}));
  assert.throws(() => tasks.start("ana", "/api/squad", () => new Promise(() => {})), (e) => e.status === 429);
  assert.ok(tasks.start("rui", "/api/squad", () => new Promise(() => {})), "other accounts are not affected");
});

test("the handler reads the buffered body and its answer is captured", async () => {
  const req = bufferedRequest({ method: "POST", url: "/api/squad", headers: { cookie: "a=b" }, socket: {} }, Buffer.from('{"x":1}'));
  let text = "";
  for await (const chunk of req) text += chunk;
  assert.equal(text, '{"x":1}');
  const { res, done } = capturedResponse();
  res.writeHead(409, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "conflito" }));
  assert.deepEqual(await done, { status: 409, data: { error: "conflito" } });
});
