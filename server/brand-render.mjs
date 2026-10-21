import { chromium } from "playwright";
import { fetchPublic, publicAddress } from "./collector.mjs";

async function samplePage(page) {
  return page.evaluate(() => {
    const visible = (e) => {
      const s = getComputedStyle(e);
      return (
        s.display !== "none" &&
        s.visibility !== "hidden" &&
        e.getClientRects().length > 0
      );
    };
    const sample = (selector, limit) =>
      [...document.querySelectorAll(selector)]
        .filter(
          (e) =>
            visible(e) &&
            e.textContent.trim() &&
            !e.closest('footer,[role="dialog"],.cookie-notice'),
        )
        .slice(0, limit)
        .map((e) => {
          const s = getComputedStyle(e);
          return {
            tag: e.tagName,
            text: (e.innerText || e.textContent)
              .trim()
              .replace(/\s+/g, " ")
              .slice(0, 220),
            color: s.color,
            background: s.backgroundColor,
            font: s.fontFamily,
            size: s.fontSize,
            weight: s.fontWeight,
          };
        });
    const backgroundElements = [
      document.body,
      document.querySelector("#root > *"),
      document.querySelector("main"),
    ].filter(Boolean);
    const background =
      backgroundElements
        .map((e) => getComputedStyle(e).backgroundColor)
        .find((c) => c !== "rgba(0, 0, 0, 0)" && c !== "transparent") ||
      getComputedStyle(document.body).backgroundColor;
    return {
      headings: sample("h1,h2,h3,.ld-fh-element", 24),
      body: sample(
        "main p,.elementor-widget-text-editor p,p,.ld-fh-element",
        50,
      ).filter((s) => parseFloat(s.size) <= 26),
      typography: sample(
        "h1 span,h2 span,h3 span,p span,blockquote,em,strong,button",
        80,
      ),
      buttons: sample(
        '.elementor-button,.btn,button,a[class*="button"],a[class*="btn"]',
        20,
      ),
      background,
      title: document.title,
      description:
        document.querySelector('meta[name="description"]')?.content || "",
      visibleText: (document.querySelector("main") || document.body).innerText
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 40000),
    };
  });
}
export const needsHydration = (sample) =>
  !sample.headings.length || (sample.visibleText || "").length < 180;
export function publicResourceUrl(raw) {
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port)) ||
    /^(localhost|.*\.localhost|.*\.local)$/i.test(host) ||
    (/^\d+\.\d+\.\d+\.\d+$|:/.test(host) && !publicAddress(host))
  )
    throw new Error("Recurso não público bloqueado.");
  return url.href;
}

// All browser traffic is fulfilled by the same DNS-pinned public fetcher used
// for ingestion. This isolated browser has no account cookies or credentials.
export async function inspectDynamicStyles(
  initial,
  { getPublic = fetchPublic, timeout = 24000 } = {},
) {
  let browser, deadline;
  const resources = new Map([[initial.url, Promise.resolve(initial)]]),
    materials = [],
    warnings = [];
  let requests = 0,
    totalBytes = Buffer.byteLength(initial.html),
    closed = false;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    deadline = setTimeout(() => {
      closed = true;
      browser.close().catch(() => {});
    }, timeout);
    const context = await browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
      viewport: { width: 1440, height: 1000 },
    });
    await context.routeWebSocket("**/*", (socket) => socket.close());
    await context.addInitScript(() => {
      window.WebSocket = class {
        constructor() {
          throw new Error("WebSocket desativado nesta leitura.");
        }
      };
      window.EventSource = class {
        constructor() {
          throw new Error("EventSource desativado nesta leitura.");
        }
      };
      window.open = () => null;
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      try {
        if (
          closed ||
          request.method() !== "GET" ||
          !["document", "script", "stylesheet", "xhr", "fetch"].includes(
            request.resourceType(),
          )
        )
          return await route.abort();
        const url = publicResourceUrl(request.url());
        if (
          /cloudflareinsights|google-analytics|googletagmanager|doubleclick|hotjar|facebook\.net/i.test(
            new URL(url).hostname,
          )
        )
          return await route.abort();
        if (!resources.has(url)) {
          if (++requests > 45 || totalBytes > 12 * 1024 * 1024)
            return await route.abort();
          resources.set(
            url,
            getPublic(url, 0, { asset: true, maxBytes: 6 * 1024 * 1024 }).then(
              (result) => {
                totalBytes += Buffer.byteLength(result.html);
                if (totalBytes > 12 * 1024 * 1024)
                  throw new Error("Limite de recursos da página atingido.");
                if (/css/i.test(result.type || ""))
                  materials.push({
                    text: result.html,
                    origin: result.url,
                    kind: "css",
                  });
                return result;
              },
            ),
          );
        }
        const resource = await resources.get(url);
        if (closed) return;
        const html =
          request.resourceType() === "document"
            ? resource.html.replace(
                /<script\b[^>]*src=["'][^"']*(?:cloudflareinsights|googletagmanager|google-analytics)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
                "",
              )
            : resource.html;
        await route.fulfill({
          status: 200,
          headers: {
            "content-type": resource.type || "text/html; charset=utf-8",
            "access-control-allow-origin": "*",
            "cache-control": "no-store",
          },
          body: html,
        });
      } catch (error) {
        if (warnings.length < 5) warnings.push(error.message);
        try {
          await route.abort();
        } catch {}
      }
    });
    const page = await context.newPage();
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));
    page.setDefaultTimeout(timeout);
    await page.goto(initial.url, { waitUntil: "domcontentloaded", timeout });
    await page
      .waitForFunction(
        () =>
          document.querySelector("h1,h2") &&
          document.body.innerText.trim().length > 180,
        {},
        { timeout: Math.min(timeout, 10000) },
      )
      .catch(() => {});
    // Layout and computed styles must settle after the app mounts.
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    const sample = await samplePage(page);
    if (needsHydration(sample))
      throw new Error(
        "O site não disponibilizou conteúdo legível após a renderização.",
      );
    return {
      sample,
      materials,
      warnings: [...new Set(warnings)],
      requests,
      bytes: totalBytes,
    };
  } finally {
    closed = true;
    clearTimeout(deadline);
    await browser?.close();
  }
}

// Render only already-fetched public material. No page scripts or network requests run.
export async function inspectAppliedStyles(html, materials) {
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    const source = html.replace(/<link\b[^>]*>/gi, (tag) => {
      const href = tag.match(/\bhref\s*=\s*["']([^"']+)/i)?.[1];
      if (!href) return "";
      let absolute;
      try {
        absolute = new URL(href.replace(/&amp;/g, "&"), materials[0].origin)
          .href;
      } catch {
        return "";
      }
      const sheet = materials.find(
        (m) => m.kind === "css" && m.origin === absolute,
      );
      return sheet
        ? `<style>${sheet.text.replace(/<\/style/gi, "")}</style>`
        : "";
    });
    const clean = source
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<(?:link|iframe|object|embed|base)\b[^>]*>/gi, "")
      .replace(/<meta\b[^>]*http-equiv[^>]*>/gi, "");
    await page.setContent(clean, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    return await samplePage(page);
  } finally {
    await browser?.close();
  }
}
