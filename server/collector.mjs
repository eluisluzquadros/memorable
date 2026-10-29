import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { createHash } from "node:crypto";
import { safeUrl } from "../src/operations.mjs";
export function publicAddress(address) {
  if (address.includes(":"))
    return (
      /^2[0-9a-f]{3}:/i.test(address) &&
      !address.toLowerCase().startsWith("2001:db8:")
    );
  const a = address.split(".").map(Number);
  return (
    a.length === 4 &&
    a.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
    ![0, 10, 127].includes(a[0]) &&
    a[0] < 224 &&
    !(a[0] === 169 && a[1] === 254) &&
    !(a[0] === 172 && a[1] >= 16 && a[1] <= 31) &&
    !(a[0] === 192 && (a[1] === 168 || a[1] === 0)) &&
    !(a[0] === 100 && a[1] >= 64 && a[1] <= 127) &&
    !(a[0] === 198 && (a[1] === 18 || a[1] === 19))
  );
}
export async function fetchPublic(raw, redirects = 0, {asset=false,maxBytes=2*1024*1024}={}) {
  const url = new URL(safeUrl(raw));
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error(
      "A coleta aceita somente as portas padrão de páginas públicas.",
    );
  let addresses;
  try {
    addresses = await dns.lookup(url.hostname, { all: true });
  } catch (error) {
    // Many sites only publish DNS for the www host (esferalegal.com.br → www.esferalegal.com.br).
    if (error.code !== "ENOTFOUND" || url.hostname.startsWith("www.") || url.hostname.split(".").length > 3)
      throw new Error(`Não encontramos o endereço "${url.hostname}". Confira o link.`);
    url.hostname = `www.${url.hostname}`;
    try {
      addresses = await dns.lookup(url.hostname, { all: true });
    } catch {
      throw new Error(`Não encontramos o endereço "${url.hostname.replace(/^www\./, "")}". Confira o link.`);
    }
  }
  const blocked = addresses.find((a) => !publicAddress(a.address));
  if (!addresses.length || blocked)
    throw new Error(
      `Endereços locais e redes privadas não são fontes públicas. "${url.hostname}" resolveu para ${blocked?.address || "nenhum endereço"}; se o site é público, verifique VPN, proxy ou filtro de DNS.`,
    );
  const ip = addresses[0];
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.get(
      url,
      {
        headers: {
          "User-Agent": "Memoravel-MVP/0.2 (public page reader)",
          Accept:
            "text/html,application/rss+xml,application/atom+xml,text/plain",
        },
        lookup: (_host, options, cb) =>
          options.all ? cb(null, [ip]) : cb(null, ip.address, ip.family),
      },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          if (redirects >= 3)
            return reject(new Error("Muitos redirecionamentos."));
          fetchPublic(
            new URL(res.headers.location, url).href,
            redirects + 1,
            {asset,maxBytes},
          ).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`A fonte respondeu HTTP ${res.statusCode}.`));
        }
        const type = res.headers["content-type"] || "";
        if (!/(text\/|xml)/i.test(type) && !(asset && /javascript|json/i.test(type))) {
          res.resume();
          return reject(
            new Error("Formato não suportado: use página, texto ou feed RSS."),
          );
        }
        let size = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > Math.min(maxBytes,6*1024*1024)) {
            res.destroy();
            reject(new Error(`O recurso excede o limite de leitura de ${Math.min(maxBytes,6*1024*1024)/(1024*1024)} MB.`));
          } else chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            html: Buffer.concat(chunks).toString("utf8"),
            url: url.href,
            type,
          }),
        );
        res.on("error", reject);
      },
    );
    req.setTimeout(25000, () =>
      req.destroy(
        new Error("A fonte demorou mais de 25 segundos para responder. Tente de novo em instantes."),
      ),
    );
    req.on("error", reject);
  });
}
const decode = (s) =>
  s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) =>
      Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : "",
    );
export function extractPage(html) {
  return decode(
    html
      .replace(/<(script|style|nav|footer|header)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[^]*?-->/g, " ")
      .replace(/<!\[CDATA\[([^]*?)\]\]>/g, "$1")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}
export async function collectSources(workspace, monitors) {
  const sources = [];
  const errors = [];
  for (const monitor of monitors.slice(0, 20)) {
    try {
      if (["Instagram", "LinkedIn", "TikTok", "X"].includes(monitor.kind))
        throw new Error(
          "Esta rede não entrega publicações úteis por leitura pública. Conecte a conta autorizada ou cole/import e o texto no acervo.",
        );
      if (monitor.mode === "channel" || monitor.kind === "YouTube") {
        // A channel monitor imports the newest publications; ids derive from each item URL.
        const { discoverChannel, importChannelItems } = await import("./channels.mjs");
        const channel = await discoverChannel({ url: monitor.url });
        const { sources: items, errors: itemErrors } = await importChannelItems({ items: channel.items.slice(0, 5), channelTitle: channel.title, channelUrl: channel.url });
        for (const captured of items)
          sources.push({
            ...captured,
            id: "web-" + createHash("sha256").update(workspace + "|" + captured.url).digest("hex").slice(0, 20),
            workspace,
            origin: `${monitor.name} · ${captured.origin}`,
            citable: true,
            shared: false,
            date: new Date().toISOString(),
            validUntil: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
            category: monitor.category,
            monitorId: monitor.id,
            tags: [],
            demo: false,
            feedback: "",
            needsVerification: true,
          });
        for (const e of itemErrors) errors.push({ name: `${monitor.name} · ${e.title || e.url}`, error: e.error });
        continue;
      }
      const {ingestUrl}=await import('./ingestion.mjs');
      const captured=await ingestUrl({url:monitor.url});
      sources.push({
        ...captured,
        id:
          "web-" +
          createHash("sha256")
            .update(workspace + "|" + monitor.url)
            .digest("hex")
            .slice(0, 20),
        workspace,
        title: captured.title,
        type: "Notícia",
        origin: `${monitor.name} · consulta pública em ${new Date().toLocaleDateString("pt-BR")}`,
        url: captured.url,
        text: captured.text,
        citable: true,
        shared: false,
        date: new Date().toISOString(),
        validUntil: new Date(Date.now() + 90 * 86400000)
          .toISOString()
          .slice(0, 10),
        category: monitor.category,
        monitorId: monitor.id,
        tags: [],
        demo: false,
        feedback: "",
        needsVerification: true,
      });
    } catch (e) {
      errors.push({ name: monitor.name, error: e.message });
    }
  }
  return { sources, errors };
}
