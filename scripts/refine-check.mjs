// Refino journey with a mocked /api/refine (no model cost): notes with recommendations, revised
// version, blind-judge table, models per role, and "Usar versão refinada" as a new revision.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";

const result = {
  problems: [
    { problem: "Fala com o profissional, não com quem busca orientação.", excerpt: "Antes de explicar, escute.", severity: "alta" },
    { problem: "CTA do briefing ignorado.", excerpt: "", severity: "média" },
  ],
  recommendation: "Fale direto com quem busca orientação jurídica, traga o ponto de vista do BBMD logo na abertura e feche com a pergunta do briefing.",
  revised: { body: "Você chega ao primeiro atendimento com dúvidas. No BBMD Advogados, explicamos cada termo antes de qualquer decisão.\n\nQual dúvida você gostaria de esclarecer?", changes: ["Texto fala com o cliente", "CTA do briefing"], issues: [] },
  originalIssues: [],
  judge: { original: { clareza: 5, evidencia: 4, voz: 3, utilidade: 3 }, revised: { clareza: 4, evidencia: 4, voz: 5, utilidade: 4 }, winner: "revisada", reason: "Fala com o público certo." },
  models: { reviewer: "google/gemini-4-argon", writer: "anthropic/claude-opus-5.5", judge: "openai/gpt-6.1-sol" },
  at: new Date().toISOString(),
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [scheme, width] of [["light", 1440], ["dark", 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: "reduce" });
    await context.addInitScript(() => { try { sessionStorage.setItem("memorable-tour-dismissed:demo", "true"); } catch {} });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let sent;
    await page.route("**/api/refine", async (route) => { sent = JSON.parse(route.request().postData()); await route.fulfill({ json: result }); });
    await page.goto("http://localhost:5173/#app/painel");
    await page.getByText("Clareza no primeiro atendimento").first().click();
    await page.getByRole("button", { name: "Refinar com IA" }).click();
    await page.locator(".rf-result").waitFor();
    assert.ok(sent.packet.brand && sent.packet.voice, "refine receives the brand context packet");
    assert.ok(sent.piece.body.length > 20);
    assert.equal(await page.locator(".rf-problems li").count(), 2);
    await page.getByText("Fale direto com quem busca orientação jurídica", { exact: false }).waitFor();
    await page.getByText("Prefere a versão refinada.", { exact: false }).waitFor();
    await page.getByText("google/gemini-4-argon").waitFor();
    const report = await new AxeBuilder({ page }).include(".rf-panel").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    assert.deepEqual(report.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ") + " " + (n.any[0]?.message || "")).join(" | ")}`), [], `axe ${scheme}`);
    await page.locator(".rf-versions").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.impeccable/review/refine-${scheme}.png` });
    await page.getByRole("button", { name: "Usar versão refinada" }).click();
    await page.getByText("Aplicada como versão 2.", { exact: false }).waitFor();
    const piece = await page.evaluate(() => JSON.parse(localStorage.getItem("esteira-demo-v1")).pieces.find((p) => p.title === "Clareza no primeiro atendimento"));
    assert.equal(piece.revision, 2);
    assert.equal(piece.status, "Rascunho");
    assert.match(piece.body, /BBMD Advogados, explicamos/);
    assert.equal(piece.refine.accepted, true);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log("PASS: refine problems with one general recommendation, revised version, blind judge and models per role; applying creates revision 2 back in writing; Axe in light 1440 and dark 390.");
} finally {
  await browser.close();
}
