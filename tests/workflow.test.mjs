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
    /outra marca/,
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

test("kanban drops map to workflow actions, and going back from approval needs confirmation", async () => {
  const { planKanbanMove, transition: move, removePiece } = await import("../src/workflow.mjs");
  const piece = (id, status, extra = {}) => ({ id, workspace: "w", title: id, status, revision: 2, approvedRevision: status === "Aprovado" || status === "Agendado" ? 2 : null, approver: status === "Aprovado" || status === "Agendado" ? "Ana" : null, sourceIds: [], ...extra });
  const state = { workspace: "w", role: "Editor", events: [], cases: [{ id: "c", pieceIds: ["r", "a"] }], pieces: [piece("d", "Rascunho"), piece("r", "Em revisão"), piece("a", "Aprovado"), piece("s", "Agendado", { scheduledAt: "2026-12-01", channel: "LinkedIn" }), piece("p", "Publicado"), piece("kid", "Rascunho", { parentId: "d" })] };
  assert.deepEqual(planKanbanMove(state, "d", "Pedido"), { kind: "apply", action: "move", payload: { status: "Pedido" } });
  assert.equal(planKanbanMove(state, "d", "Em revisão").action, "review");
  assert.equal(planKanbanMove(state, "r", "Rascunho").action, "retract");
  assert.deepEqual(planKanbanMove(state, "r", "Ajustes"), { kind: "needs", need: "reason" });
  assert.equal(planKanbanMove(state, "r", "Aprovado").action, "approve");
  assert.equal(planKanbanMove(state, "a", "Rascunho").kind, "confirm");
  assert.match(planKanbanMove(state, "s", "Rascunho").message, /cancela o agendamento/);
  assert.equal(planKanbanMove(state, "s", "Aprovado").action, "unschedule");
  assert.deepEqual(planKanbanMove(state, "a", "Agendado"), { kind: "needs", need: "schedule" });
  assert.throws(() => planKanbanMove(state, "p", "Rascunho"), /definitivo/);
  assert.throws(() => planKanbanMove(state, "a", "Em revisão"), /volte o conteúdo para a escrita/);

  const retracted = move(state, "r", "retract", { status: "Rascunho" });
  assert.equal(retracted.pieces.find((x) => x.id === "r").status, "Rascunho");
  const reopened = move(state, "s", "reopen", { status: "Rascunho" }).pieces.find((x) => x.id === "s");
  assert.deepEqual([reopened.status, reopened.approvedRevision, reopened.scheduledAt], ["Rascunho", null, null]);
  assert.throws(() => move({ ...state, role: "Observador" }, "d", "move", { status: "Pedido" }), /Editor/);

  const removed = removePiece(state, "r");
  assert.equal(removed.pieces.some((x) => x.id === "r"), false);
  assert.deepEqual(removed.cases[0].pieceIds, ["a"]);
  assert.equal(removed.events[0].action, "delete");
  assert.throws(() => removePiece(state, "p"), /publicados/);
  assert.throws(() => removePiece(state, "d"), /desdobramentos/);
  assert.throws(() => removePiece({ ...state, role: "Aprovador" }, "r"), /Editor/);
});

test("the send gate reads the brand with its other names, like generation does", () => {
  const base = initialState();
  const piece = { ...base.pieces[0], workspace: "w1", format: "LinkedIn", sourceIds: [], brief: { format: "LinkedIn", brandName: "Escritório de advocacia" }, body: "O Atlas mostra por que o intervalo entre a petição e a sentença decide quem cresce. ".repeat(6) };
  const stateWith = (aliases) => ({ ...base, workspace: "w1", workspaces: [{ id: "w1", name: "Escritório de advocacia", aliases }], sources: [] });
  const brandBlocked = (state) => evaluateCouncil(state, piece).checks.some((c) => c.blocker && /marca que está produzindo/.test(c.reason));
  assert.equal(brandBlocked(stateWith([])), true, "without the other name the text does not mention the brand");
  assert.equal(brandBlocked(stateWith(["Atlas"])), false, "the other name set on the brand counts");
});

test("send to review is one step: it checks again, and a blocked piece shows what to fix", async () => {
  const { submitForReview } = await import("../src/review-submit.mjs");
  const base = initialState();
  const piece = { ...base.pieces[0], status: "Em conferência", council: undefined, brief: { format: base.pieces[0].format, brandName: "Escritório de advocacia" } };
  const stateWith = (aliases) => ({ ...base, role: "Editor", pieces: [piece, ...base.pieces.slice(1)], workspaces: [{ id: piece.workspace, name: "Escritório de advocacia", aliases }] });
  const blocked = submitForReview(stateWith([]), piece.id);
  assert.equal(blocked.passed, false);
  assert.equal(blocked.state.pieces[0].status, "Em conferência", "a blocked piece stays where it is");
  assert.ok(blocked.council.checks.some((c) => c.blocker && /marca que está produzindo/.test(c.reason)), "and carries the reason");
  const sent = submitForReview(stateWith(["conversa"]), piece.id);
  assert.equal(sent.passed, true);
  assert.equal(sent.state.pieces[0].status, "Em revisão", "the same piece goes to review once the brand is recognised");
  assert.throws(() => submitForReview(stateWith([]), "inexistente"), /não encontrado/);
});
