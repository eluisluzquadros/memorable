// Brand without a website: interview + uploaded file become official acervo sources and feed the DNA.
// /api/brand-dna is mocked (no model cost); /api/ingest/file runs for real on a small text file.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "memorable-dna-")), "apresentacao-esfera.txt");
fs.writeFileSync(file, "A Esfera Legal apoia escritórios parceiros com pesquisa jurisprudencial, petições e acompanhamento processual em todo o Brasil. Atendemos com linguagem direta e prazos claros.");
const proposal = {
  colors: [], fonts: [], sources: ["Entrevista da marca"], fieldEvidence: {},
  tone: "Direto, técnico e cordial", audience: "Escritórios de advocacia parceiros", positioning: "Retaguarda jurídica para escritórios parceiros",
  pillars: "Pesquisa jurisprudencial\nPrazos claros\nParceria de longo prazo", say: "Parceria\nPrazo combinado", avoid: "Prometer resultado de causa", examples: "Atendemos com linguagem direta e prazos claros.", checklist: "Sem promessa de resultado\nPrazo explícito",
  quality: { status: "ready", method: "materials", headings: 0, paragraphs: 0, textCharacters: 900, materials: 2 }, notes: [], excerpt: "",
};
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await context.addInitScript(() => { try { sessionStorage.setItem("memorable-tour-dismissed:demo", "true"); } catch {} });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let sent;
  await page.route("**/api/brand-dna", async (r) => { sent = JSON.parse(r.request().postData()); await r.fulfill({ json: proposal }); });
  await page.goto("http://localhost:5173/#app/configuracoes");
  await page.getByLabel("Papel na demonstração").selectOption("Administrador");
  await page.getByLabel("Escopo: grupo ou marca").selectOption("esfera");
  await page.getByRole("button", { name: /Responder entrevista da marca/ }).click();
  await page.getByLabel("O que vocês fazem e vendem?").fill("Retaguarda jurídica para escritórios parceiros: pesquisa, petições e acompanhamento processual.");
  await page.getByLabel("Para quem? Quem é o cliente ideal e que problema ele traz?").fill("Escritórios que precisam de capacidade extra sem contratar.");
  await page.getByLabel("Como vocês falam com o cliente?").fill("Direto, técnico e cordial. Ex.: combinamos o prazo e entregamos.");
  await page.getByRole("button", { name: "Salvar entrevista" }).click();
  await page.getByText("Entrevista da marca", { exact: true }).waitFor();
  await page.locator(".bs-upload input[type=file]").setInputFiles(file);
  await page.getByText("Material da marca · apresentacao-esfera.txt").waitFor();
  const report = await new AxeBuilder({ page }).include(".bs-panel").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  assert.deepEqual(report.violations.map((v) => v.id), [], "axe on brand materials");
  await page.locator(".bs-panel").screenshot({ path: ".impeccable/review/dna-materials.png" });
  // No website: the extraction button works on materials alone.
  await page.getByRole("button", { name: "Extrair proposta de DNA" }).click();
  await page.getByLabel("Pilares editoriais (um por linha)").first().waitFor();
  assert.equal(sent.url, "");
  assert.equal(sent.brandName, "Esfera Legal");
  assert.equal(sent.materials.length, 2);
  assert.ok(sent.materials.some((m) => m.title === "Entrevista da marca"));
  assert.ok(sent.materials.some((m) => /apresentacao-esfera/.test(m.origin)));
  assert.ok(sent.materials.some((m) => /Retaguarda jurídica/.test(m.text)));
  assert.ok(sent.materials.some((m) => /pesquisa jurisprudencial/.test(m.text)));
  await page.getByText("Materiais da marca lidos.").waitFor();
  await page.getByRole("button", { name: "Validar e aplicar DNA" }).click();
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("esteira-demo-v1")));
  assert.equal(saved.voices.esfera.pillars, proposal.pillars);
  assert.ok(saved.sources.some((s) => s.id === "interview-esfera" && s.editorialRole === "owned"));
  assert.ok(saved.sources.some((s) => s.workspace === "esfera" && s.editorialRole === "owned" && /apresentacao-esfera/.test(s.origin)));
  assert.deepEqual(errors, []);
  console.log("PASS: interview and uploaded file become official acervo sources, feed the DNA with no website, and the approved DNA fills the voice sheet.");
} finally {
  await browser.close();
}
