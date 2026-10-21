import { chromium } from "playwright";
import { extractPage } from "./collector.mjs";
export async function articleText(html) {
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.setContent(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<(?:iframe|object|embed|base)\b[^>]*>/gi, ""),
      { waitUntil: "domcontentloaded", timeout: 10000 },
    );
    const text = await page.evaluate(() => {
      document
        .querySelectorAll(
          'script,style,nav,footer,header,aside,form,[role="navigation"],.post-meta,.entry-meta,.sharedaddy,.share-buttons,.related-posts,.elementor-widget-theme-post-info',
        )
        .forEach((e) => e.remove());
      const candidates = [
        '[itemprop="articleBody"]',
        ".elementor-widget-theme-post-content",
        ".entry-content",
        ".post-content",
        "article",
        "main",
      ];
      const root =
        candidates
          .map((selector) => document.querySelector(selector))
          .find((e) => e?.textContent.trim().length > 180) || document.body;
      const paragraphs = [...root.querySelectorAll("p")]
        .map((p) => p.textContent.replace(/\s+/g, " ").trim())
        .filter(
          (p) =>
            p.length > 60 &&
            !/^Por\s+[^.!?]{1,180}(?:\*|analista|assessoria|autor)/i.test(p) &&
            !/^compartilhe|^notícias recomendadas|^entre em contato/i.test(p),
        );
      return paragraphs.join(" ").length > 240
        ? paragraphs.join("\n\n")
        : root.textContent.replace(/\s+/g, " ").trim();
    });
    return text || extractPage(html);
  } finally {
    await browser?.close();
  }
}
