import test from "node:test";
import assert from "node:assert/strict";
import { createPlatform, sanitizePolicy } from "../server/platform.mjs";
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
