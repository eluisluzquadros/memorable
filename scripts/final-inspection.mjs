import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const results = [];
for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({
    viewport,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  for (const route of [
    "landing",
    "painel",
    "guardar",
    "vigiar",
    "escrever",
    "kanban",
    "agentes",
    "resultados",
    "aprovar",
    "publicar",
    "caderno",
    "configuracoes",
  ]) {
    await page.goto(
      "http://localhost:5173/" + (route === "landing" ? "" : `#app/${route}`),
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    if (["landing", "painel"].includes(route)) {
      await page.screenshot({
        path: `qa/final-${name}-${route}.png`,
        fullPage: true,
      });
      if (route === "landing")
        await page.screenshot({ path: `qa/final-${name}-hero.png` });
    }
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.push({
      name,
      route,
      violations: report.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    });
  }
  await context.close();
}
await browser.close();
fs.writeFileSync("qa/accessibility.json", JSON.stringify(results, null, 2));
console.log(
  JSON.stringify(
    results.map((x) => ({
      surface: x.name + "/" + x.route,
      issues: x.violations.map((v) => ({ id: v.id, count: v.nodes.length })),
    })),
    null,
    2,
  ),
);
