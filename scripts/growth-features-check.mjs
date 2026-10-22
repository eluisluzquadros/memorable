// Browser journey for the October features: whole-channel import, channel monitoring,
// portfolio cases with export, provider cards and the new content formats.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { createAccountState } from "../src/account-state.mjs";

const base = "http://localhost:5173";
const email = `qa-growth-${Date.now()}@example.test`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const state = async () => (await (await context.request.get(base + "/api/account/state")).json()).state;
const saved = () => page.getByText("Salvo no SQLite", { exact: true }).waitFor();
async function qa(name) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow at ${width}`);
    const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(report.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), [], `${name} axe at ${width}`);
    await page.screenshot({ path: `qa/growth-${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
}
try {
  const registered = await context.request.post(base + "/api/auth/register", { data: { name: "Growth QA", email, password: "qa-only-growth-long-password-123", organization: { type: "single", name: "Escritório Demo", brands: [{ name: "Escritório Demo" }] } } });
  assert.equal(registered.status(), 200);
  const account = await registered.json();
  let seed = createAccountState(account.user, { type: "single", name: "Escritório Demo", brands: [{ name: "Escritório Demo" }] });
  seed.onboarding = { tour: { dontShowAgain: true } };
  const ws = seed.workspace;
  seed.sources = [{ id: "src-qa", workspace: ws, title: "Episódio 31 · Clareza", origin: "Podcast do escritório", url: "https://exemplo.com.br/ep31", text: "Clareza no primeiro atendimento gera confiança. ".repeat(8), citable: true, shared: false, type: "Texto", date: new Date().toISOString(), feedback: "", demo: false, editorialRole: "owned" }, ...seed.sources];
  seed.pieces = [{ id: "piece-qa", workspace: ws, title: "Seu cliente entende o que você explica?", body: "TELA 1\nSeu cliente entende o que você explica?", format: "Carrossel", sourceIds: ["src-qa"], owner: "Editor", deadline: "2026-11-30", status: "Aprovado", revision: 2, approvedRevision: 2, approver: "Ana", cost: 0, history: [] }, ...seed.pieces];
  seed.outcomes = [{ workspace: ws, pieceId: "piece-qa", views: 1840, clicks: 62, conversations: 4, evidence: "Captura do painel do Instagram", learning: "Pergunta direta no gancho segurou a leitura." }];
  assert.equal((await context.request.put(base + "/api/account/state", { data: { state: seed, revision: 1, userId: account.user.id } })).status(), 200);

  // 1. Whole channel into the archive, plus a channel monitor.
  await page.goto(base + "/#app/pesquisar");
  await page.getByRole("button", { name: "Adicionar ao acervo", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Adicionar ao acervo" });
  await dialog.getByRole("tab", { name: "Canal inteiro" }).click();
  await dialog.getByLabel("Endereço do canal, blog ou perfil").fill("https://www.irbre.com/");
  const list = dialog.getByRole("region", { name: "Publicações encontradas" });
  // Third-party sites are sometimes slow; the UI tells the user to retry, and so does the check.
  for (let attempt = 1; ; attempt++) {
    await dialog.getByRole("button", { name: "Listar publicações" }).click();
    await Promise.race([list.waitFor({ timeout: 60000 }), dialog.getByRole("alert").waitFor({ timeout: 60000 })]);
    if (await list.isVisible()) break;
    if (attempt === 3) throw new Error(`Channel discovery failed: ${await dialog.getByRole("alert").innerText()}`);
  }
  const boxes = list.locator('li input[type="checkbox"]:checked');
  while ((await boxes.count()) > 2) await boxes.nth(2).uncheck();
  await qa("channel-list");
  await dialog.getByRole("button", { name: "Importar 2 publicações" }).click();
  await dialog.getByText("2 importadas", { exact: false }).waitFor({ timeout: 90000 });
  await saved();
  let s = await state();
  const imported = s.sources.filter((x) => x.channel?.url);
  assert.equal(imported.length, 2);
  assert.ok(imported.every((x) => x.text.length > 500 && x.summary));
  assert.equal(s.monitors.filter((m) => m.mode === "channel").length, 1);
  await dialog.getByRole("button", { name: "Fechar", exact: true }).first().click();

  // 2. Portfolio case built from the approved piece, with evidence-only results and export.
  await page.goto(base + "/#app/portfolio");
  await page.getByRole("heading", { name: "Seu trabalho vira case.", exact: true }).waitFor();
  await page.getByRole("button", { name: "Montar case" }).click();
  await page.getByLabel("Título do case").fill("Um episódio, sete peças");
  await page.getByLabel("Desafio do cliente").fill("Explicar contratos para quem nunca contratou um escritório.");
  await page.getByRole("checkbox", { name: /Seu cliente entende/ }).check();
  await page.getByRole("button", { name: "Salvar case" }).click();
  await page.getByRole("button", { name: /Um episódio, sete peças/ }).click();
  await page.getByText("1.840", { exact: true }).waitFor();
  await qa("portfolio");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar apresentação" }).click();
  const file = await (await download).path();
  const html = await fs.readFile(file, "utf8");
  assert.match(html, /Um episódio, sete peças/);
  assert.match(html, /aprovada por Ana \(v2\)/);
  await saved();
  assert.equal((await state()).cases.length, 1);

  // 3. Providers: Claude for writing, Higgsfield by MCP and by API.
  await page.goto(base + "/#app/configuracoes");
  for (const name of ["Claude (Anthropic)", "Higgsfield (MCP)", "Higgsfield (API)"]) await page.getByRole("heading", { name, exact: true }).first().waitFor();

  // 4. New formats from the Higgsfield benchmark with their own duration rules.
  await page.goto(base + "/#app/escrever");
  await page.getByRole("button", { name: "Nova ideia" }).click();
  const format = page.getByLabel("Formato", { exact: true });
  await format.waitFor();
  const options = await format.locator("option").allTextContents();
  for (const f of ["Anúncio UGC", "Vídeo de produto", "Comercial", "Site para negócio local", "Vídeo faceless YouTube", "Produto digital"]) assert.ok(options.includes(f), `format ${f}`);
  await format.selectOption("Vídeo de produto");
  const durations = await page.getByLabel("Duração esperada", { exact: true }).locator("option").evaluateAll((o) => o.map((x) => Number(x.value)));
  assert.deepEqual(durations, [5, 10, 15]);

  assert.deepEqual(errors, []);
  console.log("PASS: whole-channel import (IRB feed) with monitor; portfolio case with evidence-only totals and HTML export; Claude + Higgsfield MCP/API cards; new formats and duration rules; Axe/overflow at 1440 and 390.");
} catch (e) {
  console.error(e);
  await page.screenshot({ path: "qa/growth-failure.png", fullPage: true });
  throw e;
} finally {
  await context.close();
  await browser.close();
  const db = new DatabaseSync(".runtime/skyvidya.sqlite");
  try {
    const user = db.prepare("SELECT id FROM users WHERE email=?").get(email);
    if (user) for (const table of ["sessions", "account_state_backups", "account_state"]) db.prepare(`DELETE FROM ${table} WHERE user_id=?`).run(user.id);
    if (user) db.prepare("DELETE FROM users WHERE id=?").run(user.id);
  } finally {
    db.close();
  }
}
