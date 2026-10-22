// Browser check for Kanban moves (drag, selector, confirmation when undoing approval) and piece deletion.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createAccountState } from "../src/account-state.mjs";

const base = "http://localhost:5173";
const email = `qa-kanban-${Date.now()}@example.test`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = async () => (await (await context.request.get(base + "/api/account/state")).json()).state;
const settle = () => page.waitForTimeout(150);
const until = async (check, label) => { for (let i = 0; i < 60; i++) { const current = await state(); if (check(current)) return current; await page.waitForTimeout(250); } throw new Error("timeout: " + label); };
try {
  const account = await (await context.request.post(base + "/api/auth/register", { data: { name: "Kanban QA", email, password: "qa-only-kanban-long-password-123", organization: { type: "single", name: "Marca", brands: [{ name: "Marca" }] } } })).json();
  let seed = createAccountState(account.user, { type: "single", name: "Marca", brands: [{ name: "Marca" }] });
  seed.onboarding = { tour: { dontShowAgain: true } };
  seed.role = "Editor";
  const ws = seed.workspace;
  seed.sources = [{ id: "src", workspace: ws, title: "Fonte", origin: "Origem", text: "Texto de referência suficiente para a peça. ".repeat(5), citable: true, type: "Texto", date: new Date().toISOString(), feedback: "", demo: false }, ...seed.sources];
  const piece = (id, title, status) => ({ id, workspace: ws, title, body: "Corpo da peça com texto completo.", format: "LinkedIn", sourceIds: ["src"], owner: "Editor", deadline: "2026-12-30", status, revision: 1, approvedRevision: status === "Aprovado" ? 1 : null, approver: status === "Aprovado" ? "Ana" : null, cost: 0, createdAt: new Date().toISOString() });
  seed.pieces = [piece("rev", "Peça em revisão ruim", "Em revisão"), piece("ok", "Peça aprovada", "Aprovado"), piece("draft", "Rascunho qualquer", "Rascunho")];
  await context.request.put(base + "/api/account/state", { data: { state: seed, revision: 1, userId: account.user.id } });
  await page.goto(base + "/#app/kanban");
  const column = (name) => page.locator(".r-kanban-column", { has: page.getByRole("heading", { name: new RegExp(`^${name}\\s*\\d*$`) }) });
  const card = (title) => page.locator(".r-kanban-card", { hasText: title });
  // Real HTML5 drag events, as a browser fires them.
  const drag = async (title, columnName) => {
    const source = await card(title).elementHandle();
    const target = await column(columnName).elementHandle();
    await page.evaluate(([from, to]) => {
      const data = new DataTransfer();
      from.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: data }));
      for (const type of ["dragenter", "dragover", "drop"]) to.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data }));
      from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: data }));
    }, [source, target]);
  };

  // Drag from review back to writing: allowed, recorded as a retraction.
  await drag("Peça em revisão ruim", "Escrevendo");
  await until((s) => s.pieces.find((p) => p.id === "rev").status === "Rascunho", "retract");

  // Dragging an approved piece back asks first, then undoes the approval.
  await drag("Peça aprovada", "Escrevendo");
  await page.getByRole("alertdialog", { name: "Confirmar movimento" }).waitFor();
  await page.getByRole("button", { name: "Voltar e desfazer aprovação" }).click();
  const reopened = (await until((s) => s.pieces.find((p) => p.id === "ok").status === "Rascunho", "reopen")).pieces.find((p) => p.id === "ok");
  assert.deepEqual([reopened.status, reopened.approvedRevision], ["Rascunho", null]);

  // Selector works without dragging (keyboard and phones).
  await page.getByLabel("Mover Rascunho qualquer").selectOption("Ideias");
  await until((s) => s.pieces.find((p) => p.id === "draft").status === "Pauta escolhida", "selector");

  // Delete from the piece detail, confirmed in place.
  await page.getByRole("button", { name: "Peça em revisão ruim" }).click();
  await page.getByRole("button", { name: "Excluir peça" }).click();
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  const after = await until((s) => !s.pieces.some((p) => p.id === "rev"), "delete");
  assert.equal(after.pieces.some((p) => p.id === "rev"), false);
  assert.ok(after.events.some((e) => e.action === "delete" && e.pieceId === "rev"));
  await page.screenshot({ path: "qa/kanban-after.png" });
  assert.deepEqual(errors, []);
  console.log("PASS: drag review→writing; approved→writing with confirmation; selector move; delete with audit event.");
} catch (e) {
  console.error(e);
  await page.screenshot({ path: "qa/kanban-failure.png", fullPage: true });
  throw e;
} finally {
  await context.close();
  await browser.close();
  const db = new DatabaseSync(".runtime/skyvidya.sqlite");
  const user = db.prepare("SELECT id FROM users WHERE email=?").get(email);
  if (user) {
    for (const table of ["sessions", "account_state_backups", "account_state"]) db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(user.id);
    db.prepare("DELETE FROM users WHERE id=?").run(user.id);
  }
  db.close();
}
