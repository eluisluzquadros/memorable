// Captures the cinematic landing (#motion) at every act, desktop and phone, plus reduced motion and Axe.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";

const base = process.env.BASE || "http://localhost:5173";
const out = "qa/motion";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { overflow: {}, errors: [], axe: {} };
for (const [name, viewport, reducedMotion] of [
  ["desktop", { width: 1440, height: 900 }, "no-preference"],
  ["mobile", { width: 390, height: 844 }, "no-preference"],
  ["reduced", { width: 1440, height: 900 }, "reduce"],
]) {
  const context = await browser.newContext({ viewport, reducedMotion, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(`${name}: ${e.message}`));
  await page.goto(`${base}/#motion`);
  await page.waitForSelector(".mx-root");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
  report.overflow[name] = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  if (reducedMotion === "reduce") {
    await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  } else {
    const stage = await page.evaluate(() => {
      const el = document.querySelector(".mx-stage");
      return { top: el.offsetTop, span: el.offsetHeight - innerHeight };
    });
    for (let act = 0; act < 6; act++) {
      for (const local of act === 5 ? [0.25, 0.8] : [0.45]) {
        await page.evaluate((y) => scrollTo(0, y), stage.top + (stage.span * (act + local)) / 6);
        await page.waitForTimeout(1300);
        await page.screenshot({ path: `${out}/${name}-act${act}${act === 5 ? `-${local}` : ""}.png` });
      }
    }
    for (const id of ["portfolio", "planos"]) {
      await page.evaluate((i) => document.getElementById(i).scrollIntoView(), id);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${out}/${name}-${id}.png` });
    }
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/${name}-close.png` });
  }
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(600);
  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  report.axe[name] = axe.violations.map((v) => ({ id: v.id, nodes: v.nodes.slice(0, 4).map((n) => n.target.join(" ")) }));
  await context.close();
}
await browser.close();
await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
