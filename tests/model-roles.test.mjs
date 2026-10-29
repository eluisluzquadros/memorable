import test from "node:test";
import assert from "node:assert/strict";
import { writerFor, profileWriters } from "../src/model-roles.mjs";

test("the writer follows the content type and falls back to the general writer", () => {
  const roles = { writer: "anthropic/claude-sonnet-5.5", writerByFormat: { LinkedIn: "deepseek/deepseek-v4.1-flash" } };
  assert.equal(writerFor(roles, "LinkedIn"), "deepseek/deepseek-v4.1-flash");
  assert.equal(writerFor(roles, "Reels"), "anthropic/claude-sonnet-5.5");
  assert.equal(writerFor(roles), "anthropic/claude-sonnet-5.5");
  assert.equal(writerFor(undefined, "LinkedIn"), undefined);
});

test("a lab profile applies only to formats where some model reached the floor", () => {
  const byFormat = {
    LinkedIn: { profiles: { redator: { essencial: "deepseek/a", excelencia: "anthropic/b" } } },
    Reels: { profiles: { redator: null } },
    Artigo: { profiles: { redator: { essencial: "x/fora-do-catalogo" } } },
  };
  assert.deepEqual(profileWriters(byFormat, "essencial", (m) => m !== "x/fora-do-catalogo"), { LinkedIn: "deepseek/a" });
  assert.deepEqual(profileWriters(byFormat, "excelencia"), { LinkedIn: "anthropic/b" });
});
