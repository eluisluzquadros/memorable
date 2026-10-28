// Group DNA journey with a recorded coherence result (no model cost): brand matrix, group rules,
// coherence problems with the brands involved, one recommendation, and suggested rules added.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";

// Synthetic review, so no client analysis is stored in the repository.
const recorded = {
  problems: [
    { kind: "compliance", brands: ["BBMD Advogados", "2B Juris"], problem: "Indicação entre marcas do grupo pode parecer captação de clientela.", severity: "alta" },
    { kind: "sobreposição", brands: ["BBMD Advogados", "2B Juris"], problem: "As duas falam com a mesma pessoa física sem papéis claros.", severity: "média" },
    { kind: "dado divergente", brands: ["2B Ativos Judiciais"], problem: "A grafia da marca muda entre os canais.", severity: "baixa" },
  ],
  recommendation: "Formalize o papel de cada marca e separe a comunicação da advocacia das demais atividades do grupo.",
  suggestedRules: ["Nenhuma marca indica outra do grupo como prestadora do serviço.", "Padronizar a grafia oficial das marcas."],
  brands: ["BBMD Advogados", "Esfera Legal", "2B Ativos Judiciais", "2B Juris"],
  at: new Date().toISOString(),
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [scheme, width] of [["light", 1440], ["dark", 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: "reduce" });
    await context.addInitScript(() => { try { sessionStorage.setItem("memorable-tour-dismissed:demo", "true"); } catch {} });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let sent;
    await page.route("**/api/group-coherence", async (r) => { sent = JSON.parse(r.request().postData()); await r.fulfill({ json: recorded }); });
    await page.goto("http://localhost:5173/#app/organizacao/grupo");
    // On a phone the role moves into the drawer.
    if (width > 850) await page.getByLabel("Papel na demonstração").selectOption("Administrador");
    else {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page.getByLabel("Trocar papel").selectOption("Administrador");
      await page.getByRole("button", { name: "Fechar menu" }).click();
    }
    await page.getByRole("heading", { name: "DNA do grupo" }).waitFor();
    assert.ok(await page.locator(".gd-matrix tbody tr").count() >= 4);
    await page.getByLabel("Regras para todas as marcas").fill("Nenhuma marca promete resultado de causa.");
    await page.getByRole("button", { name: "Checar coerência do grupo" }).click();
    await page.locator(".gd-result").waitFor();
    assert.equal(sent.group.rules, "Nenhuma marca promete resultado de causa.");
    assert.ok(sent.brands.length >= 4);
    assert.equal(await page.locator(".gd-result .rf-problems li").count(), recorded.problems.length);
    await page.getByText("Não é parecer jurídico.", { exact: false }).waitFor();
    const report = await new AxeBuilder({ page }).include(".gd-panel").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(report.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`), [], `axe ${scheme}`);
    await page.locator(".gd-result").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.impeccable/review/group-dna-${scheme}.png` });
    await page.getByRole("button", { name: "Adicionar às regras" }).first().click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("esteira-demo-v1")).groupDNA);
    assert.ok(saved.rules.includes(recorded.suggestedRules[0]));
    assert.equal(saved.coherence.problems.length, recorded.problems.length);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("PASS: group DNA matrix, group rules sent to the coherence review, problems with brands, one recommendation, legal disclaimer, suggested rule added; Axe light 1440 and dark 390.");
} finally {
  await browser.close();
}
