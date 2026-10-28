import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = "http://localhost:5173";
async function state() {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("esteira-demo-v1")),
  );
}
try {
  await page.goto(base + "/#app/cerebro/dna");
  await page.getByRole("button", { name: "Pular tour", exact: true }).click();
  await page.getByLabel("Papel na demonstração").selectOption("Administrador");
  const original = await state();
  await page
    .getByLabel("Site da marca", { exact: true })
    .fill("https://www.skyvidya.org/");
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/brand-dna") && r.request().method() === "POST",
    { timeout: 75000 },
  );
  await page
    .getByRole("button", { name: "Extrair proposta de DNA", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancelar leitura", exact: true })
    .waitFor();
  const response = await responsePromise;
  assert.equal(response.status(), 200);
  const result = await response.json();
  assert.equal(result.quality.method, "rendered");
  assert.equal(result.quality.status, "ready");
  assert.ok(result.quality.textCharacters > 5000);
  assert.equal(result.primary, "#ff5c2e");
  assert.equal(result.background, "#e9e3d5");
  assert.match(result.headingFont, /Inter Tight/);
  assert.match(result.bodyFont, /Inter Tight/);
  assert.match(result.audience, /produtor.*banco/i);
  assert.match(result.excerpt, /geoespacial/i);
  await fs.writeFile(
    "qa/skyvidya-dna-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    "PASS: live Skyvidya extraction returned " +
      result.quality.textCharacters +
      " characters and applied colors/fonts.",
  );
  await page.getByText("Página renderizada e lida.", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Cor principal (DNA)", { exact: true }).inputValue(),
    result.primary,
  );
  assert.deepEqual((await state()).voices, original.voices);
  assert.equal(
    (await state()).brandDNA?.[original.workspace],
    original.brandDNA?.[original.workspace],
  );
  await page
    .getByText("Texto extraído do site ou da documentação", { exact: true })
    .click();
  assert.match(
    await page.locator(".dna-excerpt").innerText(),
    /Estratégia para transformar riscos em resiliência/,
  );
  await page
    .getByText("Texto extraído do site ou da documentação", { exact: true })
    .click();
  await page.locator(".dna-quality").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "qa/skyvidya-dna-desktop.png" });
  await page
    .getByRole("button", { name: "Validar e aplicar DNA", exact: true })
    .click();
  await page.reload();
  await page.getByText("DNA validado · versão 1", { exact: true }).waitFor();
  const approved = await state();
  assert.equal(approved.brandDNA[original.workspace].primary, "#ff5c2e");
  assert.equal(
    approved.voices[original.workspace].positioning,
    result.positioning,
  );
  assert.equal(
    await page.getByLabel("Tom de voz", { exact: true }).inputValue(),
    result.tone,
  );

  // Cancellation and brand changes must discard late responses.
  for (const changeBrand of [false, true]) {
    let release, started;
    const requested = new Promise((resolve) => {
      started = resolve;
    });
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/api/brand-dna", async (route) => {
      started();
      await held;
      await route
        .fulfill({
          json: {
            ...result,
            tone: "RESPOSTA ANTIGA QUE NÃO DEVE SER APLICADA",
          },
        })
        .catch(() => {});
    });
    await page
      .getByLabel("Site da marca", { exact: true })
      .fill("https://brand.example/");
    await page
      .getByRole("button", { name: "Extrair proposta de DNA", exact: true })
      .click();
    await requested;
    if (changeBrand) {
      const other = await page
        .getByLabel("Escopo: grupo ou marca", { exact: true })
        .locator("option")
        .evaluateAll(
          (options, workspace) =>
            options.map((o) => o.value).find((id) => id !== workspace && id !== "__group__"),
          original.workspace,
        );
      await page
        .getByLabel("Escopo: grupo ou marca", { exact: true })
        .selectOption(other);
      assert.equal(
        await page.getByLabel("Site da marca", { exact: true }).inputValue(),
        "",
      );
    } else {
      await page
        .getByRole("button", { name: "Cancelar leitura", exact: true })
        .click();
      await page
        .getByRole("alert")
        .filter({ hasText: "Leitura cancelada." })
        .waitFor();
    }
    release();
    await page.unrouteAll({ behavior: "wait" });
    assert.ok(
      !(await page.locator(".dna-panel").innerText()).includes(
        "RESPOSTA ANTIGA",
      ),
    );
    if (changeBrand)
      await page
        .getByLabel("Escopo: grupo ou marca", { exact: true })
        .selectOption(original.workspace);
  }
  await page.route("**/api/brand-dna", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/html",
      body: "<html>Bad Gateway</html>",
    }),
  );
  await page
    .getByLabel("Site da marca", { exact: true })
    .fill("https://brand.example/");
  await page
    .getByRole("button", { name: "Extrair proposta de DNA", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "O serviço de extração não respondeu corretamente." })
    .waitFor();
  assert.equal(
    await page.getByLabel("Cor principal (DNA)", { exact: true }).inputValue(),
    "#ff5c2e",
  );
  await page.unrouteAll({ behavior: "wait" });
  await page.reload();
  await page.getByText("DNA validado · versão 1", { exact: true }).waitFor();
  for (const [name, width] of [
    ["desktop", 1440],
    ["mobile", 390],
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      report.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
    if (name === "mobile") {
      await page.locator(".dna-quality").scrollIntoViewIfNeeded();
      await page.screenshot({ path: "qa/skyvidya-dna-mobile.png" });
    }
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(
    "qa/skyvidya-dna-result.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    "PASS: real Skyvidya rendering, evidence, manual validation, persistence, voice application, cancellation, brand isolation, service errors, mobile and accessibility.",
  );
  console.log(
    JSON.stringify(
      {
        quality: result.quality,
        primary: result.primary,
        background: result.background,
        headingFont: result.headingFont,
        bodyFont: result.bodyFont,
        audience: result.audience,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
