// Pilot of a portfolio case through the real platform, driven in a visible browser while watching what a person
// would experience: how long each step takes, what the screen says, every console error, failed request and
// API error, and what each generation cost in plan credits. The person only logs in (the password stays with
// them); everything after that is driven here.
//   node scripts/pilot-case.mjs [--site https://www.memoravel.org] [--formats "LinkedIn,Carrossel,Artigo"] [--max-credits 3000]
// Log: scratchpad/pilot/pilot.jsonl, screenshots next to it.
import fs from "node:fs";
import path from "node:path";
const { chromium } = await import(new URL("../node_modules/playwright/index.mjs", import.meta.url));

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const SITE = opt("site", "https://www.memoravel.org");
const FORMATS = opt("formats", "Artigo,Newsletter,Reels").split(",").map((f) => f.trim());
const MAX_CREDITS = Number(opt("max-credits", 3000));
const ACCOUNT = opt("account", "mktmemoravel@gmail.com");
const BRAND = opt("brand", "Escritório de advocacia");
const SOURCE = opt("source", "Escritório Conecta");
const SUBJECT = opt("subject", "O que um evento da advocacia ensina sobre crescer sem perder a autonomia");
const DIR = path.resolve(opt("out", ".runtime/pilot"));
fs.mkdirSync(DIR, { recursive: true });

const t0 = Date.now();
const clock = () => `${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s`;
const events = [];
const say = (kind, text, extra = {}) => {
  const line = { at: new Date().toISOString(), t: Math.round((Date.now() - t0) / 1000), kind, text, ...extra };
  events.push(line);
  fs.appendFileSync(path.join(DIR, "pilot.jsonl"), JSON.stringify(line) + "\n");
  console.log(`[${clock()}] ${kind.padEnd(8)} ${text}`);
};

const context = await chromium.launchPersistentContext(path.join(DIR, "profile"), { channel: "chrome", headless: false, viewport: { width: 1440, height: 950 } });
const page = context.pages()[0] || (await context.newPage());
page.setDefaultTimeout(12000);
let step = "início";
const noise = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) { const text = m.text().slice(0, 240); noise.push(`${m.type()}: ${text}`); say(m.type() === "error" ? "ERRO-JS" : "aviso-js", `[${step}] ${text}`); } });
page.on("pageerror", (e) => { noise.push(`pageerror: ${e.message}`); say("ERRO-JS", `[${step}] exceção: ${e.message.slice(0, 240)}`); });
page.on("requestfailed", (r) => { if (!/\/api\/tasks\//.test(r.url()) || true) say("REDE", `[${step}] ${r.method()} ${r.url().replace(SITE, "")} falhou: ${r.failure()?.errorText}`); });
page.on("response", (r) => {
  const url = r.url().replace(SITE, "");
  if (!url.startsWith("/api/")) return;
  if (r.status() >= 400) say("API", `[${step}] ${r.request().method()} ${url} → HTTP ${r.status()}`);
  else if (/\/api\/(squad|production|refine|council)\b/.test(url) && r.request().method() === "POST") say("api", `[${step}] POST ${url} → ${r.status()}`);
});
const shot = (name) => page.screenshot({ path: path.join(DIR, `${String(events.length).padStart(3, "0")}-${name}.png`) }).catch(() => {});
const api = async (url) => { try { const r = await context.request.get(SITE + url); return r.ok() ? await r.json() : { error: r.status() }; } catch (e) { return { error: e.message }; } };
const visible = (selector) => page.locator(selector).first().isVisible().catch(() => false);
const text = (selector) => page.locator(selector).first().innerText({ timeout: 2000 }).then((t) => t.replace(/\s+/g, " ").trim()).catch(() => "");

try {
  // 1. login: the person types; we only wait and check it is the right account
  step = "login";
  await page.goto(`${SITE}/#auth`);
  say("passo", `Abri ${SITE}. Entre com a conta ${ACCOUNT} na janela do navegador; eu continuo sozinho depois do login.`);
  let user = null;
  for (let i = 0; i < 450 && !user; i++) {
    const s = await api("/api/auth/session");
    if (s.user) user = s.user; else await page.waitForTimeout(2000);
  }
  if (!user) throw new Error("Ninguém entrou em 15 minutos.");
  if (user.email.toLowerCase() !== ACCOUNT) throw new Error(`Entrou como ${user.email}, não como ${ACCOUNT}. Não vou gerar nessa conta.`);
  say("passo", `Login ok: ${user.name} (${user.email}) · administrador da plataforma: ${user.platformAdmin}`);
  await page.waitForTimeout(1500);

  // 2. the experience from the dashboard
  step = "painel";
  await page.goto(`${SITE}/#app/grupo`);
  await page.getByRole("button", { name: /Pular tour/i }).click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(2500);
  say("tela", `Visão do grupo: ${await text(".group-metrics")}`);
  await shot("grupo");
  const usage0 = await api("/api/budget");
  say("plano", `Uso do plano antes: ${usage0.used} de ${usage0.allowance} créditos · marcas: ${JSON.stringify(usage0.byWorkspace)}`);

  // 3. open the brand
  step = "marca";
  const switcher = page.getByLabel(/Grupo ou marca|^Marca$/i).first();
  const options = await switcher.locator("option").allInnerTexts().catch(() => []);
  say("tela", `Seletor de marca: ${options.join(" | ")}`);
  const brandOption = options.find((o) => o.includes(BRAND));
  if (!brandOption) throw new Error(`Marca "${BRAND}" não aparece no seletor.`);
  await switcher.selectOption({ label: brandOption });
  await page.waitForTimeout(1200);
  await page.goto(`${SITE}/#app/escrever`);
  await page.waitForTimeout(2000);
  await shot("escrever-inicio");
  say("tela", `Escrever: ${await text("main")}`.slice(0, 400));

  const results = [];
  for (const [index, format] of FORMATS.entries()) {
    step = `${format}`;
    const before = await api("/api/budget");
    if (before.used - usage0.used > MAX_CREDITS) { say("PARADA", `Teto do piloto atingido (${MAX_CREDITS} créditos).`); break; }
    const row = { format, ok: false };
    results.push(row);
    say("passo", `── ${format} (${index + 1}/${FORMATS.length})`);
    // back to the first step, new idea (sending to review can move the person to Aprovar)
    await page.goto(`${SITE}/#app/escrever`);
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: /^1\s*Ideia/ }).click({ timeout: 4000 }).catch(() => {});
    await page.getByRole("button", { name: "Nova ideia" }).click({ timeout: 8000 }).catch((e) => say("UX", `Não achei "Nova ideia": ${e.message.split("\n")[0]}`));
    await page.getByLabel("O que vamos comunicar?").fill(SUBJECT).catch((e) => say("UX", `Campo do assunto indisponível: ${e.message.split("\n")[0]}`));
    await page.getByLabel("Formato").selectOption({ label: format }).catch((e) => say("UX", `Formato "${format}" indisponível: ${e.message.split("\n")[0]}`));
    const sourceOptions = await page.getByLabel("Referência do acervo").locator("option").allInnerTexts().catch(() => []);
    const pick = sourceOptions.find((o) => o.includes(SOURCE));
    if (!pick) { say("UX", `Fonte "${SOURCE}" não aparece. Opções: ${sourceOptions.join(" | ")}`); row.error = "fonte ausente"; continue; }
    await page.getByLabel("Referência do acervo").selectOption({ label: pick });
    await page.waitForTimeout(600);
    const provider = await text(".r-provider");
    say("tela", `Bloco de geração antes de clicar: ${provider}`.slice(0, 360));
    await shot(`${format}-pronto`);
    const button = page.getByRole("button", { name: /Gerar \d+ versão|Gerar \d+ versões/ });
    if (!(await button.count())) { say("UX", "Botão de gerar não apareceu (a tela pediria conectar IA?)."); row.error = "sem botão de gerar"; continue; }
    const started = Date.now();
    await button.click();
    say("passo", "Cliquei em Gerar.");
    // the first generation also tests what a person does: leave the screen and come back
    if (index === 0) {
      await page.waitForTimeout(6000);
      say("tela", `Durante a geração: botão = "${await button.innerText().catch(() => "?")}" · aviso: ${await text(".r-provider [role=status]")}`);
      await shot(`${format}-gerando`);
      step = `${format} (saiu da tela)`;
      await page.goto(`${SITE}/#app/kanban`);
      await page.waitForTimeout(7000);
      await page.goto(`${SITE}/#app/escrever`);
      await page.waitForTimeout(2500);
      say("tela", `Ao voltar para Escrever: ${(await text(".r-provider")).slice(0, 220)} · etapa marcada: ${await text(".ws-steps [aria-current]")}`);
      await shot(`${format}-voltou`);
      step = format;
    }
    // wait for the draft or an error
    const outcome = await Promise.race([
      page.locator(".ws-edit").waitFor({ state: "visible", timeout: 420000 }).then(() => "pronto"),
      page.locator(".r-provider .form-error").waitFor({ state: "visible", timeout: 420000 }).then(() => "erro"),
    ]).catch(() => "tempo");
    row.seconds = Math.round((Date.now() - started) / 1000);
    const after = await api("/api/budget");
    row.credits = after.used - before.used;
    if (outcome !== "pronto") {
      row.error = outcome === "erro" ? await text(".r-provider .form-error") : "sem resposta em 7 min";
      say("FALHA", `${format}: ${row.error} (após ${row.seconds}s, ${row.credits} créditos)`);
      await shot(`${format}-falha`);
      continue;
    }
    const draft = await page.evaluate(() => [...document.querySelectorAll(".ws-edit textarea")].map((t) => t.value).sort((a, b) => b.length - a.length)[0] || "");
    const panel = await text(".ws-edit");
    row.chars = draft.length;
    row.review = (panel.match(/O editor ainda aponta[^.]*\./) || panel.match(/Revisão editorial[^.]*\./) || [""])[0];
    row.warnings = (await page.locator(".ws-edit .r-warning, .ws-edit .mr-warning, .ws-edit [role=alert]").allInnerTexts().catch(() => [])).map((w) => w.replace(/\s+/g, " ").slice(0, 200));
    say("ok", `${format} pronto em ${row.seconds}s · ${draft.length} caracteres · ${row.credits} créditos · ${row.review || "sem pendência do editor"}`);
    if (row.warnings.length) say("aviso", `Avisos na tela: ${row.warnings.join(" | ")}`);
    say("texto", draft.slice(0, 700).replace(/\s+/g, " "));
    await shot(`${format}-texto`);
    // send it to review, as a person would
    await page.getByRole("button", { name: /Enviar para revisão/ }).click({ timeout: 6000 }).catch((e) => say("UX", `Botão "Enviar para revisão" indisponível: ${e.message.split("\n")[0]}`));
    await page.waitForTimeout(1800);
    const toasts = (await page.locator("[role=status], [role=alert]").allInnerTexts().catch(() => [])).map((t) => t.replace(/s+/g, " ").trim()).filter(Boolean);
    const onApprove = (await page.evaluate(() => location.hash)).startsWith("#app/aprovar");
    say("tela", `Depois de enviar: avisos = ${JSON.stringify(toasts)} · foi para Aprovar: ${onApprove} · etapa: ${await text(".ws-steps [aria-current]")}`);
    row.sent = onApprove;
    if (!onApprove) {
      // blocked by the basic checks: what does the person see, and what exactly must be fixed?
      const checks = await page.evaluate(() => { const h = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && /Corrigir antes de seguir/.test(e.textContent)); return h ? h.closest("section,div")?.parentElement?.innerText || "" : ""; });
      row.pending = checks.replace(/s+/g, " ").slice(0, 900);
      say("PENDÊNCIA", `${format} não foi para a aprovação. Checagens: ${row.pending}`);
    }
    await shot(`${format}-enviado`);
    row.ok = onApprove;
  }

  // 4. the end state: Kanban and plan usage
  step = "fim";
  await page.goto(`${SITE}/#app/kanban`);
  await page.waitForTimeout(2500);
  say("tela", `Kanban: ${await text("main")}`.slice(0, 400));
  await shot("kanban-final");
  const usage1 = await api("/api/budget");
  say("plano", `Uso do plano depois: ${usage1.used} (+${usage1.used - usage0.used}) de ${usage1.allowance} · marcas: ${JSON.stringify(usage1.byWorkspace)}`);
  console.log("\n===== RESUMO =====");
  for (const r of results) console.log(`${r.ok ? "OK   " : "FALHA"} ${r.format.padEnd(10)} ${String(r.seconds ?? "-").padStart(4)}s ${String(r.chars ?? "-").padStart(6)} car. ${String(r.credits ?? "-").padStart(5)} créditos ${r.error ? "· " + r.error : r.review ? "· " + r.review : ""}`);
  console.log(`Erros de JS: ${noise.filter((n) => n.startsWith("error") || n.startsWith("pageerror")).length} · avisos: ${noise.filter((n) => n.startsWith("warning")).length}`);
  fs.writeFileSync(path.join(DIR, "resumo.json"), JSON.stringify({ results, noise, usage0, usage1 }, null, 2));
} catch (e) {
  say("ABORTOU", e.message);
  await shot("abortou");
} finally {
  say("passo", "Fim do piloto. A janela fica aberta 20 s para você conferir.");
  await page.waitForTimeout(20000).catch(() => {});
  await context.close().catch(() => {});
}
