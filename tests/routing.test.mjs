import test from "node:test";
import assert from "node:assert/strict";
import { routingPolicy } from "../server/ai.mjs";

test("OpenRouter calls default to providers that neither train on nor retain data", () => {
  const saved = { p: process.env.MEMORAVEL_PRIVACY, i: process.env.MEMORAVEL_PROVIDER_IGNORE };
  try {
    delete process.env.MEMORAVEL_PRIVACY; delete process.env.MEMORAVEL_PROVIDER_IGNORE;
    assert.deepEqual(routingPolicy(), { data_collection: "deny", zdr: true, ignore: ["Baidu", "Alibaba", "SiliconFlow", "StreamLake"] });
    process.env.MEMORAVEL_PROVIDER_IGNORE = "";
    assert.deepEqual(routingPolicy(), { data_collection: "deny", zdr: true });
    process.env.MEMORAVEL_PRIVACY = "standard";
    assert.equal(routingPolicy(), null);
  } finally {
    for (const [k, v] of [["MEMORAVEL_PRIVACY", saved.p], ["MEMORAVEL_PROVIDER_IGNORE", saved.i]]) v === undefined ? delete process.env[k] : (process.env[k] = v);
  }
});
