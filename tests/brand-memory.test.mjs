import test from "node:test";
import assert from "node:assert/strict";
import { brandMemory } from "../src/operations.mjs";

test("approved content and recorded learnings of this brand feed the second brain, nothing else", () => {
  const state = {
    workspace: "esfera",
    pieces: [
      { id: "a", workspace: "esfera", status: "Publicado", title: "Prazo combinado", format: "LinkedIn", body: "Combinamos o prazo e entregamos.", stageAt: "2026-10-20" },
      { id: "b", workspace: "esfera", status: "Rascunho", title: "Rascunho", format: "LinkedIn", body: "Ainda não aprovado." },
      { id: "c", workspace: "bbmd", status: "Aprovado", title: "Outra marca", format: "LinkedIn", body: "Não pertence à Esfera." },
      { id: "d", workspace: "esfera", status: "Aprovado", title: "Pesquisa jurisprudencial", format: "Carrossel", body: "TELA 1 ...", stageAt: "2026-10-21" },
    ],
    outcomes: [
      { pieceId: "a", learning: "Prazo explícito gerou mais conversas.", hypothesis: "Clareza de prazo", evidence: "3 contatos" },
      { pieceId: "c", learning: "Aprendizado de outra marca." },
      { pieceId: "d", learning: "" },
    ],
  };
  const { approvedExamples, insights } = brandMemory(state);
  assert.deepEqual(approvedExamples.map((p) => p.title), ["Pesquisa jurisprudencial", "Prazo combinado"]);
  assert.deepEqual(insights.map((i) => i.learning), ["Prazo explícito gerou mais conversas."]);
});
