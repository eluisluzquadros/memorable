import test from "node:test";
import assert from "node:assert/strict";
import { createPlatform, sanitizePolicy, toCredits } from "../server/platform.mjs";
import { openDb } from "../server/sql.mjs";

const SCHEMA = "CREATE TABLE IF NOT EXISTS service_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);";
const known = (id) => ["a/one", "b/two", "c/three"].includes(id);

test("platform administrators are named by e-mail, from the database or the environment", async () => {
  const db = openDb(":memory:", SCHEMA);
  const platform = createPlatform(db, { env: { MEMORAVEL_PLATFORM_ADMINS: "Dono@Memoravel.org, outro@memoravel.org" }, ttlMs: 0 });
  assert.equal(await platform.isAdmin({ email: "dono@memoravel.org" }), true, "case does not matter");
  assert.equal(await platform.isAdmin({ email: "cliente@bbmd.com" }), false);
  assert.equal(await platform.isAdmin(null), false);
  await platform.addAdmin(" Equipe@Memoravel.org ");
  assert.equal(await platform.isAdmin({ email: "equipe@memoravel.org" }), true);
  assert.deepEqual((await platform.admins()).sort(), ["dono@memoravel.org", "equipe@memoravel.org", "outro@memoravel.org"]);
  await assert.rejects(platform.addAdmin("sem-arroba"), /e-mail válido/);
  await platform.removeAdmin("equipe@memoravel.org");
  assert.equal(await platform.isAdmin({ email: "equipe@memoravel.org" }), false);
  await db.close();
});

test("the model policy is validated against the catalog and applies to everyone", async () => {
  const db = openDb(":memory:", SCHEMA);
  const platform = createPlatform(db, { env: {}, ttlMs: 0 });
  assert.deepEqual(await platform.modelPolicy(), {});
  const saved = await platform.setModelPolicy({ writer: "a/one", judge: "b/two", ignored: "x", writerByFormat: { Reels: "c/three", LinkedIn: "" } }, known);
  assert.deepEqual(saved, { writer: "a/one", judge: "b/two", writerByFormat: { Reels: "c/three" } }, "unknown roles and empty choices are dropped");
  assert.deepEqual(await platform.modelPolicy(), saved);
  await assert.rejects(platform.setModelPolicy({ writer: "z/unknown" }, known), /fora do catálogo/);
  await assert.rejects(platform.setModelPolicy({ writerByFormat: { Reels: "z/unknown" } }, known), /Redator inválido/);
  assert.deepEqual(await platform.modelPolicy(), saved, "a refused policy leaves the current one untouched");
  assert.deepEqual(sanitizePolicy({}, known), {});
  await db.close();
});

test("the plan gives each account a monthly allowance in credits; a reset restarts its usage", async () => {
  const db = openDb(":memory:", SCHEMA);
  const platform = createPlatform(db, { env: {}, ttlMs: 0 });
  assert.deepEqual(await platform.planFor({ email: "cliente@bbmd.com" }), { creditsPerUsd: 1000, allowance: 10000 });
  await platform.setPlan({ allowance: 25000 });
  await platform.setAllowance("Grande@Cliente.com", 80000);
  assert.deepEqual(await platform.planFor({ email: "outro@x.com" }), { creditsPerUsd: 1000, allowance: 25000 });
  assert.equal((await platform.planFor({ email: "grande@cliente.com" })).allowance, 80000, "an account can have its own allowance");
  await assert.rejects(platform.setPlan({ allowance: 0 }), /maior que zero/);
  await assert.rejects(platform.setAllowance("sem-arroba", 5), /e-mail válido/);
  assert.equal(await platform.usageSince("u1"), null);
  await platform.setUsageSince("u1", "2026-10-30T12:00:00.000Z");
  assert.equal(await platform.usageSince("u1"), "2026-10-30T12:00:00.000Z");
  assert.equal(await platform.usageSince("u2"), null, "only that account restarts");
  assert.deepEqual(await platform.admins(), [], "plan settings do not touch the administrators");
  await db.close();
});

test("the credits per brand always add up to the total the customer sees", () => {
  // Three brands whose costs round badly: 0.0004 + 0.0004 + 0.0004 = 0.0012 → 1 credit, but each line alone rounds to 0.
  const { byWorkspace, used } = toCredits({ esfera: 0.8815, podcast: 0.4472, grupo: 0.00049, "": 0.0004 }, 1000);
  assert.deepEqual(byWorkspace, { esfera: 882, podcast: 447, grupo: 0, "": 0 });
  assert.equal(used, Object.values(byWorkspace).reduce((n, v) => n + v, 0), "total = sum of the lines");
  const many = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`m${i}`, 0.0123456 * (i + 1)]));
  const result = toCredits(many);
  assert.equal(result.used, Object.values(result.byWorkspace).reduce((n, v) => n + v, 0));
  assert.deepEqual(toCredits({}), { byWorkspace: {}, used: 0 });
});
