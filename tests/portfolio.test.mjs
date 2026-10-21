import test from "node:test";
import assert from "node:assert/strict";
import { saveCase, caseStory, caseDocument, eligiblePieces, removeCase } from "../src/cases.mjs";

const base = () => ({
  workspace: "w1",
  role: "Editor",
  cases: [],
  sources: [{ id: "s1", title: "Episódio 31", origin: "Podcast da marca", workspace: "w1" }],
  pieces: [
    { id: "p1", workspace: "w1", title: "Carrossel clareza", format: "Carrossel", status: "Aprovado", body: "TELA 1\n<b>Texto</b>", sourceIds: ["s1"], approver: "Ana", approvedRevision: 3 },
    { id: "p2", workspace: "w1", title: "Rascunho", format: "Reels", status: "Rascunho", body: "x", sourceIds: ["s1"] },
    { id: "p3", workspace: "w2", title: "Outra marca", format: "Artigo", status: "Aprovado", body: "y", sourceIds: [] },
  ],
  outcomes: [
    { pieceId: "p1", views: 1200, clicks: 40, evidence: "print do Instagram", learning: "Pergunta no gancho funcionou" },
    { pieceId: "p1", views: 99999, evidence: "" },
  ],
});

test("a case only gathers approved pieces from the active workspace", () => {
  const state = base();
  assert.deepEqual(eligiblePieces(state).map((p) => p.id), ["p1"]);
  assert.throws(() => saveCase(state, { title: "Case", challenge: "Explicar contratos para leigos.", pieceIds: ["p2"] }), /aprovadas/);
  assert.throws(() => saveCase(state, { title: "Case", challenge: "Explicar contratos para leigos.", pieceIds: ["p3"] }), /aprovadas/);
  assert.throws(() => saveCase(state, { title: "Case", challenge: "curto", pieceIds: ["p1"] }), /desafio/);
  assert.throws(() => saveCase({ ...state, role: "Observador" }, { title: "Case", challenge: "Explicar contratos para leigos.", pieceIds: ["p1"] }));
  const next = saveCase(state, { title: "Um episódio, sete peças", challenge: "Explicar contratos para leigos.", pieceIds: ["p1"] });
  assert.equal(next.cases.length, 1);
  assert.equal(removeCase(next, next.cases[0].id).cases.length, 0);
});

test("case results count only outcomes registered with evidence, and the export escapes content", () => {
  const state = saveCase(base(), { title: "Case <x>", challenge: "Explicar contratos para leigos.", pieceIds: ["p1"] });
  const story = caseStory(state, state.cases[0]);
  assert.equal(story.totals.views, 1200);
  assert.deepEqual(story.learnings, ["Pergunta no gancho funcionou"]);
  assert.equal(story.sources[0].title, "Episódio 31");
  const html = caseDocument(state, state.cases[0], "Marca");
  assert.match(html, /Case &lt;x&gt;/);
  assert.match(html, /&lt;b&gt;Texto&lt;\/b&gt;/);
  assert.doesNotMatch(html, /99999|99\.999/);
  assert.match(html, /aprovada por Ana \(v3\)/);
});
