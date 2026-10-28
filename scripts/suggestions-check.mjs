// Contributor journey: invite, restricted login, suggestion, team triage, status loop and isolation.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import AxeBuilder from "@axe-core/playwright";

const base = "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const team = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const guest = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
const page = await team.newPage();
const other = await guest.newPage();
page.setDefaultTimeout(20000);
other.setDefaultTimeout(20000);
const errors = [];
for (const p of [page, other]) p.on("pageerror", (e) => errors.push(e.message));
const stamp = Date.now();
const password = "qa-only-long-password-123";
const teamState = async () => (await (await team.request.get(base + "/api/account/state")).json()).state;
async function skipTour() {
  const skip = page.getByRole("button", { name: "Pular tour", exact: true });
  await skip.waitFor();
  await page.getByLabel("Não mostrar automaticamente novamente").check();
  await skip.click();
}
async function axe(p, name) {
  const report = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  assert.deepEqual(report.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), [], `${name} axe`);
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow`);
}
async function suggest(title, why, link = "") {
  await other.getByLabel("O assunto, em uma frase").fill(title);
  await other.getByLabel("Por que isso importa agora?").fill(why);
  if (link) {
    await other.getByLabel("Tenho um link (notícia, decisão, artigo)").check();
    await other.getByLabel("Link da referência").fill(link);
  }
  await other.getByRole("button", { name: "Enviar sugestão" }).click();
  await other.getByText("Sugestão enviada.", { exact: false }).waitFor();
}
try {
  // Team account with one brand; the owner is Administrador.
  await page.goto(base + "/#auth");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await page.getByLabel("Seu nome", { exact: true }).fill("Gestora QA");
  await page.getByLabel("E-mail", { exact: true }).fill(`qa-team-${stamp}@example.test`);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel("Nome do negócio / marca", { exact: true }).fill("Escritório QA");
  await page.getByRole("button", { name: "Criar minha conta", exact: true }).click();
  await page.waitForURL("**/#app/painel");
  await skipTour();

  // The Kanban no longer creates ideas.
  await page.goto(base + "/#app/kanban");
  assert.equal(await page.getByText("Anotar uma ideia do time", { exact: false }).count(), 0);

  // Invite a contributor and read the one-time password.
  await page.goto(base + "/#app/organizacao/colaboradores");
  const email = `qa-contrib-${stamp}@example.test`;
  await page.getByLabel("Nome", { exact: true }).fill("Ana Tributário");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Área", { exact: true }).fill("Tributário");
  await page.getByRole("button", { name: "Criar acesso" }).click();
  const secret = (await page.locator(".ct-created code").textContent()).trim();
  assert.ok(secret.length >= 12);

  // The contributor session cannot read the organization or the team inbox.
  await other.goto(base + "/#sugerir");
  await other.getByLabel("E-mail").fill(email);
  await other.getByLabel("Senha").fill("senha-errada-123");
  await other.getByRole("button", { name: "Entrar" }).click();
  await other.getByText("E-mail ou senha incorretos.").waitFor();
  await axe(other, "contributor login");
  await other.getByLabel("Senha").fill(secret);
  await other.getByRole("button", { name: "Entrar" }).click();
  await other.getByRole("heading", { name: /Que assunto Escritório QA deveria contar/ }).waitFor();
  for (const route of ["/api/account/state", "/api/team/suggestions", "/api/team/contributors"])
    assert.equal((await guest.request.get(base + route)).status(), 401, route);
  await axe(other, "contributor form");

  await suggest("Nova decisão do STJ sobre ITCMD no exterior", "Muda o planejamento sucessório de clientes com imóveis fora do Brasil.", "https://www.stj.jus.br/");
  await suggest("Dúvida recorrente sobre holding familiar", "Todo cliente novo pergunta se a holding ainda compensa depois da reforma.");
  assert.equal(await other.locator(".cb-mine li").count(), 2);
  assert.equal(await other.locator(".cb-status", { hasText: "Recebida" }).count(), 2);

  // Team triage in Vigiar: accept one, decline the other with a reason.
  await page.goto(base + "/#app/vigiar");
  await page.getByRole("tab", { name: "Sugestões" }).click();
  const first = page.locator(".sg-item", { hasText: "ITCMD" });
  await first.getByRole("button", { name: "Aceitar e levar à escrita" }).click();
  await page.getByText("Ideia aceita.", { exact: false }).waitFor();
  const second = page.locator(".sg-item", { hasText: "holding" });
  await second.getByRole("button", { name: "Não seguir" }).click();
  await second.getByLabel(/Por que não segue/).fill("Já publicamos sobre holding em setembro.");
  await second.getByRole("button", { name: "Enviar resposta" }).click();
  await page.getByText("Resposta enviada para Ana Tributário.").waitFor();
  await page.getByText("Salvo", { exact: true }).waitFor();
  const saved = await teamState();
  const source = saved.sources.find((s) => s.internal);
  assert.ok(source, "internal source in the acervo");
  assert.match(source.origin, /Sugestão interna · Ana Tributário · Tributário/);
  assert.ok(saved.writingQueue.some((q) => q.sourceId === source.id && q.origin === "suggestion"));
  await page.goto(base + "/#app/escrever");
  await page.getByText("Sugestão de Ana Tributário").first().waitFor();

  // The contributor sees the outcome of each idea.
  await other.reload();
  await other.locator(".cb-status", { hasText: "Aceita" }).waitFor();
  await other.getByText("Resposta do time: Já publicamos sobre holding em setembro.").waitFor();

  // Ending the access ends the session.
  await page.goto(base + "/#app/organizacao/colaboradores");
  await page.getByRole("button", { name: "Encerrar acesso de Ana Tributário" }).click();
  await page.getByText("Acesso de Ana Tributário encerrado.", { exact: false }).waitFor();
  assert.equal((await guest.request.get(base + "/api/contributor/me")).status(), 401);
  assert.deepEqual(errors, []);
  console.log("PASS: invite with one-time password; restricted contributor login (401 on team routes); optional reference; accept → internal source + writing queue; decline with reason; status loop; access revocation; Axe/overflow at 390.");
} finally {
  await browser.close();
}
