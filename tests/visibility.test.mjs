import test from "node:test";
import assert from "node:assert/strict";
import { visibleTo } from "../src/visibility.mjs";
import { accessibleSources } from "../src/workflow.mjs";

test("a brand sees its own references and the shared library, minus shared ones it removed", () => {
  const own = { id: "a", workspace: "esfera" };
  const shared = { id: "b", workspace: "podcast", shared: true, hiddenIn: ["esfera"] };
  const sharedOpen = { id: "c", workspace: "podcast", shared: true };
  const privateOther = { id: "d", workspace: "bbmd" };
  assert.equal(visibleTo(own, "esfera"), true);
  assert.equal(visibleTo(shared, "esfera"), false);
  assert.equal(visibleTo(shared, "bbmd"), true, "still visible to the other brands");
  assert.equal(visibleTo(shared, "podcast"), true, "and to its owner");
  assert.equal(visibleTo(privateOther, "esfera"), false);
  assert.deepEqual(accessibleSources({ sources: [own, shared, sharedOpen, privateOther] }, "esfera").map((s) => s.id), ["a", "c"]);
});
