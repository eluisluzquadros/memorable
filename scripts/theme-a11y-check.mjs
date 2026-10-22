import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const routes = ["app/painel","app/kanban","app/vigiar","app/escrever","app/aprovar","app/publicar","app/guardar","app/campanhas","app/cerebro","app/caderno","app/agentes","app/resultados","app/portfolio","app/grupo","app/configuracoes","auth","sugerir"];
const b = await chromium.launch({ channel: "chrome", headless: true });
const seen = new Map();
for (const scheme of ["light","dark"]) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("memorable-tour-dismissed:demo", "true"); } catch {} });
  const p = await ctx.newPage();
  for (const r of routes) {
    await p.goto("http://localhost:5173/#" + r); await p.waitForTimeout(700);
    const rep = await new AxeBuilder({ page: p }).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    for (const v of rep.violations) for (const n of v.nodes) {
      const key = `${v.id} | ${n.target.join(" ")} | ${(n.any[0]?.message || "").replace(/\s+/g," ").slice(0,140)}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push(`${scheme}:${r}`);
    }
  }
  await ctx.close();
}
await b.close();
for (const [k, v] of seen) console.log(k, "::", [...new Set(v)].slice(0,4).join(","));
console.log("TOTAL", seen.size);
