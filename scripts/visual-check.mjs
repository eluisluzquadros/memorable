import { chromium } from "playwright";
import fs from "node:fs";
fs.mkdirSync("qa", { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const errors = [];
for (const [name, size] of [
  ["desktop", { width: 1440, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `qa/${name}-landing.png`, fullPage: true });
  for (const route of [
    "painel",
    "guardar",
    "vigiar",
    "escrever",
    "aprovar",
    "publicar",
    "caderno",
    "configuracoes",
  ]) {
    await page.goto(`http://localhost:5173/#app/${route}`, {
      waitUntil: "networkidle",
    });
    await page.screenshot({ path: `qa/${name}-${route}.png`, fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    if (overflow) errors.push(`${name}/${route}: page overflow`);
  }
  await context.close();
}
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.screenshot({ path: "qa/desktop-hero-motion.png" });
for (const [i, y] of [800, 1150, 1500, 1850].entries()) {
  await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `qa/scroll-${i}.png` });
}
await browser.close();
fs.writeFileSync("qa/visual-errors.json", JSON.stringify(errors, null, 2));
console.log(JSON.stringify({ errors }));
