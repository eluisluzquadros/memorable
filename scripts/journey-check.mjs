import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const check = (name) => console.log("PASS: " + name);
try {
  await page.goto("http://localhost:5173/#app/guardar", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("textbox", { name: "Buscar no acervo" })
    .pressSequentially("Conexão");
  assert.equal(await page.locator(".source-row").count(), 1);
  check("Acervo search keeps focus and filters");
  await page.locator(".source-row").click();
  await page.getByRole("button", { name: "Criar a partir daqui" }).click();
  await page
    .getByRole("textbox", { name: "O que vamos comunicar?" })
    .fill("Como tornar uma conversa mais clara");
  await page.getByLabel("Quantidade de versões").selectOption("3");
  await page.getByRole("button", { name: "Preparar 3 versões locais" }).click();
  await page.getByRole("tab", { name: "Storytelling", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Editar abordagem" });
  await editor.fill(
    "Uma conversa começa com escuta. Texto editado para o teste de revisão. Antes de explicar um termo técnico, entenda a dúvida e preserve o contexto da fonte. O que ainda precisa ficar claro?",
  );
  await page.getByRole("tab", { name: "Quebra de Objeção", exact: true }).click();
  await page.getByRole("tab", { name: "Storytelling", exact: true }).click();
  assert.match(await editor.inputValue(), /Texto editado/);
  check("Variant edits survive switching");
  await page.getByLabel("Prazo", { exact: true }).fill("");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  assert.match(await page.locator(".toast").innerText(), /prazo válido/);
  assert.equal(await page.locator("dialog").count(), 0);
  check("Missing deadline blocked before creation");
  await page.getByLabel("Prazo", { exact: true }).fill("2026-12-20");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await page.getByRole("button", { name: "Executar conselho e ajustes locais" }).click();
  await page.getByRole("button", { name: "Enviar para revisão" }).click();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Papel na demonstração" })
    .selectOption("Aprovador");
  await page.goto("http://localhost:5173/#app/aprovar");
  await page
    .getByRole("button")
    .filter({ hasText: "Como tornar uma conversa mais clara" })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Aprovar versão" }).isEnabled(),
    false,
  );
  await page.getByRole("checkbox", { name: "Conferi o texto" }).check();
  await page.screenshot({
    path: "qa/desktop-review-filled.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Aprovar versão" }).click();
  await page.getByRole("button", { name: "Definir data" }).click();
  await page.getByLabel("Data e hora locais").fill("2020-01-01T10:00");
  await page.getByRole("button", { name: "Adicionar à agenda" }).click();
  assert.match(await page.locator("dialog .toast").innerText(), /futuras/);
  check("Schedule validation visible inside dialog");
  await page.getByLabel("Data e hora locais").fill("2026-12-21T10:00");
  await page.getByRole("button", { name: "Adicionar à agenda" }).click();
  await page.goto("http://localhost:5173/#app/publicar");
  assert.equal(await page.locator(".schedule-list article").count(), 1);
  await page.reload();
  assert.equal(await page.locator(".schedule-list article").count(), 1);
  check("Approved content scheduled and persisted after reload");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar texto" }).click();
  const item = await dl;
  assert(item.suggestedFilename().endsWith(".txt"));
  await item.saveAs("qa/exported-piece.txt");
  assert.match(
    fs.readFileSync("qa/exported-piece.txt", "utf8"),
    /Texto editado/,
  );
  check("Actual text export");
  await page
    .getByRole("combobox", { name: "Papel na demonstração" })
    .selectOption("Editor");
  await page.getByRole("button", { name: "Abrir Como tornar" }).click();
  await page.getByRole("button", { name: "Editar peça" }).click();
  await page.getByLabel("Texto da peça").fill("Edição posterior à aprovação.");
  await page.getByRole("button", { name: "Salvar nova versão" }).click();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  assert.equal(await page.locator(".schedule-list article").count(), 0);
  check("Editing cancels the schedule");
  await page.goto("http://localhost:5173/#app/caderno");
  assert.match(
    await page.locator(".event-list").innerText(),
    /Texto atualizado/,
  );
  const cdl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar caderno" }).click();
  const ci = await cdl;
  await ci.saveAs("qa/exported-notebook.json");
  assert(
    JSON.parse(fs.readFileSync("qa/exported-notebook.json")).events.length >= 4,
  );
  check("Decision history and JSON export");
  await page
    .getByRole("combobox", { name: "Espaço de trabalho" })
    .selectOption("ativos");
  assert.equal(await page.locator(".event-list").count(), 0);
  check("Workspace data separation");
  await page.goto("http://localhost:5173/#app/painel");
  await page.getByRole("link", { name: "Ir para o conteúdo" }).focus();
  await page.keyboard.press("Enter");
  assert(page.url().endsWith("#app/painel"));
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "app-main",
  );
  check("Keyboard skip link stays in the app");
  assert.deepEqual(errors, []);
  check("No browser errors");
} finally {
  await browser.close();
}
