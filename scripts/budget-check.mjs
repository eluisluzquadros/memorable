// Journey: the account AI budget against real spend (local service, local databases only).
// A tiny cap plus one recorded call puts the account over budget: generation is held until the person
// confirms, the settings show the spend per brand, and the dashboard shows the brand's real spend.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

const base = "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const api = ctx.request;
  const reg = await api.post(`${base}/api/auth/register`, { headers: { Origin: base }, data: { name: "QA Orçamento", email: `qa-budget-${Date.now()}@example.test`, password: "senha-de-teste-123" } });
  assert.ok(reg.ok(), await reg.text());
  const { user } = await reg.json();
  const { state, revision } = await (await api.get(`${base}/api/account/state`)).json();
  const saved = await api.put(`${base}/api/account/state`, { headers: { Origin: base }, data: { userId: user.id, revision, state: { ...state, aiBudget: { amount: 0.01, period: "mês" } } } });
  assert.ok(saved.ok(), await saved.text());
  // One recorded call worth US$ 0.02 for this account and brand, straight into the local cost log.
  const log = new DatabaseSync(".runtime/observability.sqlite");
  log.prepare("INSERT INTO llm_calls (id, at, owner, route, role, provider, model, ms, input_tokens, output_tokens, cost, cost_source, ok, error, run_tag, workspace) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
    .run(randomUUID(), new Date().toISOString(), user.id, "/api/squad", "Redator", "server", "teste/modelo", 100, 10, 10, 0.02, "provider", 1, null, "budget-check", state.workspace);
  log.close();
  const status = await (await api.get(`${base}/api/budget`)).json();
  assert.equal(status.budget.amount, 0.01);
  assert.ok(Math.abs(status.total - 0.02) < 1e-9);
  assert.ok(status.share >= 1);
  const held = await api.post(`${base}/api/squad`, { headers: { Origin: base }, data: { packet: { workspace: state.workspace } } });
  assert.equal(held.status(), 402);
  assert.equal((await held.json()).code, "budget");
  const confirmed = await api.post(`${base}/api/squad`, { headers: { Origin: base }, data: { packet: { workspace: state.workspace }, confirmOverBudget: true } });
  assert.notEqual(confirmed.status(), 402, "with the person's yes, the budget gate lets the request through");
  const page = await ctx.newPage();
  await page.goto(`${base}/#app/configuracoes/orcamento`);
  await page.getByRole("button", { name: /Pular tour/i }).click({ timeout: 5000 }).catch(() => {});
  await page.getByRole("heading", { name: "Orçamento de IA da conta" }).waitFor();
  await page.getByText("O teto foi atingido. Novas gerações pedem confirmação.").waitFor();
  await page.goto(`${base}/#app/painel`);
  await page.getByText("Gasto com IA").first().waitFor();
  await page.getByText("US$ 0,02").first().waitFor();
  console.log("PASS: real spend per brand, over-budget generation held until confirmed, settings warning and dashboard tile.");
} finally {
  await browser.close();
}
