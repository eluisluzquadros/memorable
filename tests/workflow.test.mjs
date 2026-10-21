import test from "node:test";
import assert from "node:assert/strict";
import {
  initialState,
  transition,
  createPiece,
  accessibleSources,
  variants,
} from "../src/workflow.mjs";
import { evaluateCouncil, runCouncil } from "../src/operations.mjs";
const author = () => {
  const s = { ...initialState(), role: "Aprovador" };
  s.pieces[0].council = evaluateCouncil(s, s.pieces[0]);
  return s;
};
const future = () => new Date(Date.now() + 86400000 * 3).toISOString();
test("Editor cannot approve; a missing source blocks reviewers too", () => {
  assert.throws(
    () => transition(initialState(), "piece-1", "approve"),
    /Aprovador/,
  );
  assert.throws(() => transition(author(), "piece-2", "approve"), /fonte/);
});
test("only accessible, citable sources can support a new piece", () => {
  const s = initialState();
  const valid = {
    title: "Teste",
    body: "Texto",
    format: "LinkedIn",
    deadline: "2026-12-20",
    sourceIds: ["rolim31"],
  };
  assert.equal(createPiece(s, valid).pieces[0].sourceIds[0], "rolim31");
  assert.throws(
    () => createPiece(s, { ...valid, sourceIds: ["ativos-voice"] }),
    /fonte/,
  );
  assert.throws(() => createPiece(s, { ...valid, deadline: "" }), /prazo/);
  assert.throws(() => createPiece(s, { ...valid, body: "" }), /texto/);
});
test("editing approval cancels schedule and requires fresh review", () => {
  let s = transition(author(), "piece-1", "approve");
  s = transition(s, "piece-1", "schedule", {
    date: future(),
    channel: "LinkedIn",
  });
  s = { ...s, role: "Editor" };
  s = transition(s, "piece-1", "edit", {
    body: "Texto revisado: uma conversa clara começa por ouvir. Antes de explicar um termo técnico, entenda a dúvida e preserve o contexto da fonte. Registre também o que foi compreendido e quais pontos exigem uma explicação adicional, com linguagem acessível e sem prometer resultados. O que ainda precisa ficar claro?",
    sourceIds: ["rolim31"],
  });
  const p = s.pieces[0];
  assert.equal(p.status, "Rascunho");
  assert.equal(p.approver, null);
  assert.equal(p.approvedRevision, null);
  assert.equal(p.scheduledAt, null);
  assert.equal(p.revision, 2);
  assert.throws(
    () =>
      transition(s, "piece-1", "schedule", {
        date: future(),
        channel: "LinkedIn",
      }),
    /versão aprovada/,
  );
  s.pieces[0] = runCouncil(s, s.pieces[0]).piece;
  s = transition(s, "piece-1", "review");
  s = transition({ ...s, role: "Aprovador" }, "piece-1", "approve");
  assert.equal(s.pieces[0].approvedRevision, 2);
});
test("past and invalid schedules are rejected", () => {
  const s = transition(author(), "piece-1", "approve");
  for (const date of ["bad", "2020-01-01"])
    assert.throws(
      () => transition(s, "piece-1", "schedule", { date, channel: "LinkedIn" }),
      /data e hora/,
    );
  assert.throws(
    () =>
      transition(s, "piece-1", "schedule", { date: future(), channel: "Fake" }),
    /canal/,
  );
});
test("rejection preserves reason, author and category", () => {
  assert.throws(
    () => transition(author(), "piece-1", "reject", { reason: " " }),
    /Explique/,
  );
  const s = transition(author(), "piece-1", "reject", {
    reason: "Explique o termo.",
    category: "Clareza",
  });
  assert.equal(s.pieces[0].status, "Ajustes");
  assert.equal(s.events[0].category, "Clareza");
  assert.match(s.events[0].event, /Explique o termo/);
  assert.equal(s.events[0].author, "Aprovador");
});
test("workspace boundaries and reviewer edit restriction hold", () => {
  const s = initialState();
  assert(!accessibleSources(s, "bbmd").some((x) => x.id === "ativos-voice"));
  assert(accessibleSources(s, "ativos").some((x) => x.id === "rolim31"));
  assert.throws(
    () =>
      transition({ ...author(), workspace: "ativos" }, "piece-1", "approve"),
    /outro espaço/,
  );
  assert.throws(
    () => transition(author(), "piece-1", "edit", { body: "X" }),
    /Editor/,
  );
});
test("budget blocks creation but allows review and approvals", () => {
  const s = initialState();
  s.budgets.bbmd = 0;
  assert.throws(() => createPiece(s, { title: "Tema", body: "Texto" }), /teto/);
  assert.equal(
    transition({ ...author(), budgets: s.budgets }, "piece-1", "approve")
      .pieces[0].status,
    "Aprovado",
  );
});
test("every format provides three distinct locally generated texts", () => {
  for (const f of ["Reels", "Carrossel", "LinkedIn", "Legenda Instagram"]) {
    const list = variants(
      "Atendimento",
      { text: "O contexto vem primeiro." },
      f,
    );
    assert.equal(new Set(list.map((v) => v.body)).size, 3);
    assert(list.every((v) => v.body.includes("O contexto vem primeiro.")));
  }
});
