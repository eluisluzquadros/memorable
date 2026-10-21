// A channel is a source that publishes many items: a YouTube channel, a blog/news feed or an
// Instagram profile. Discovery lists the items; import turns each selected item into a reference.
import { fetchPublic, extractPage } from "./collector.mjs";
import { analyseText, ingestUrl, sourceKind } from "./ingestion.mjs";
import { safeUrl } from "../src/operations.mjs";

const MAX_ITEMS = 30;
const decode = (s = "") => extractPage(String(s).replace(/<!\[CDATA\[([^]*?)\]\]>/g, "$1"));
const tag = (xml, name) => xml.match(new RegExp(`<${name}\\b[^>]*>([^]*?)<\\/${name}>`, "i"))?.[1];
const attr = (xml, name, key) => xml.match(new RegExp(`<${name}\\b[^>]*\\b${key}=["']([^"']+)`, "i"))?.[1];

export function parseFeed(xml, base) {
  const entries = [...xml.matchAll(/<(item|entry)\b[^>]*>([^]*?)<\/\1>/gi)].map((m) => m[2]);
  const items = [];
  for (const entry of entries) {
    const rawLink = tag(entry, "link")?.trim() || attr(entry, "link", "href") || tag(entry, "guid");
    let url;
    try { url = safeUrl(new URL(decode(rawLink), base).href); } catch { continue; }
    items.push({
      url,
      title: decode(tag(entry, "title") || "").slice(0, 200) || url,
      publishedAt: decode(tag(entry, "pubDate") || tag(entry, "published") || tag(entry, "updated") || tag(entry, "dc:date") || "") || null,
      description: decode(tag(entry, "media:description") || tag(entry, "description") || tag(entry, "summary") || tag(entry, "content") || "").slice(0, 2000),
    });
  }
  return items;
}

function embeddedJson(html, name) {
  const start = html.search(new RegExp(`(?:var\\s+)?${name}\\s*=\\s*\\{`));
  if (start < 0) return null;
  const from = html.indexOf("{", start);
  let depth = 0, inString = false, escaped = false;
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (inString) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { try { return JSON.parse(html.slice(from, i + 1)); } catch { return null; } }
  }
  return null;
}
const text = (v) => v?.simpleText || v?.runs?.map((r) => r.text).join("") || v?.content || "";

// YouTube renders the channel's latest uploads into ytInitialData; the RSS feed is used when it answers.
export const youtubeVideosFromPage = (html) => youtubeVideosFromData(embeddedJson(html, "ytInitialData"));
export function youtubeVideosFromData(data) {
  const found = new Map();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const video = node.videoRenderer || node.gridVideoRenderer || node.reelItemRenderer;
    if (video?.videoId && !found.has(video.videoId))
      found.set(video.videoId, { url: `https://www.youtube.com/watch?v=${video.videoId}`, title: text(video.title || video.headline).slice(0, 200), publishedAt: text(video.publishedTimeText) || null, description: text(video.descriptionSnippet).slice(0, 2000), views: text(video.viewCountText) || null });
    const lockup = node.lockupViewModel;
    if (lockup?.contentId && lockup.contentType === "LOCKUP_CONTENT_TYPE_VIDEO" && !found.has(lockup.contentId)) {
      const meta = lockup.metadata?.lockupMetadataViewModel;
      found.set(lockup.contentId, { url: `https://www.youtube.com/watch?v=${lockup.contentId}`, title: text(meta?.title).slice(0, 200), publishedAt: null, description: "", views: null });
    }
    for (const child of Array.isArray(node) ? node : Object.values(node)) walk(child);
  };
  walk(data);
  return [...found.values()].filter((v) => v.title);
}

// Older uploads come from the grid's continuation tokens; the host is fixed, never user-supplied.
async function youtubeMore(html, items, limit, fetchImpl = fetch) {
  const key = html.match(/"INNERTUBE_API_KEY":"([\w-]+)"/)?.[1];
  const version = html.match(/"INNERTUBE_CLIENT_VERSION":"([\d.]+)"/)?.[1];
  if (!key || !version) return items;
  const found = new Map(items.map((i) => [i.url, i]));
  const queue = [], seen = new Set();
  const collect = (node) => {
    for (const item of youtubeVideosFromData(node)) if (!found.has(item.url)) found.set(item.url, item);
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      const token = n.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (token && !seen.has(token)) { seen.add(token); queue.push(token); }
      for (const child of Array.isArray(n) ? n : Object.values(n)) walk(child);
    };
    walk(node);
  };
  collect(embeddedJson(html, "ytInitialData"));
  for (let page = 0; queue.length && found.size < limit && page < 12; page++) {
    try {
      const response = await fetchImpl(`https://www.youtube.com/youtubei/v1/browse?key=${key}&prettyPrint=false`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(20000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: version, hl: "pt-BR" } }, continuation: queue.shift() }) });
      if (!response.ok) break;
      collect(await response.json());
    } catch { break; }
  }
  return [...found.values()];
}

async function youtubeChannel(url, getPublic, limit = MAX_ITEMS) {
  const u = new URL(url);
  const channelId = u.pathname.match(/\/channel\/(UC[\w-]{22})/)?.[1];
  const base = channelId ? `https://www.youtube.com/channel/${channelId}` : `https://www.youtube.com/${u.pathname.split("/").filter(Boolean).slice(0, 2).join("/").replace(/\/(videos|shorts|streams|featured)$/, "")}`;
  const page = await getPublic(`${base}/videos`, 0, { maxBytes: 6 * 1024 * 1024 });
  const id = channelId || page.html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] || page.html.match(/"channelId":"(UC[\w-]{22})"/)?.[1];
  const title = page.html.match(/<meta property="og:title" content="([^"]+)"/)?.[1] || page.html.match(/<title>([^<]*?)(?: - YouTube)?<\/title>/)?.[1] || "Canal do YouTube";
  let items = [];
  if (id) {
    try { items = parseFeed((await getPublic(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`)).html, "https://www.youtube.com/"); } catch { /* The feed is intermittently unavailable; the page listing below is used instead. */ }
  }
  if (!items.length) items = youtubeVideosFromPage(page.html);
  if (items.length && limit > items.length) items = await youtubeMore(page.html, items, limit);
  if (!items.length) throw new Error("Não encontramos vídeos públicos neste canal.");
  return { kind: "youtube", title: decode(title), url: id ? `https://www.youtube.com/channel/${id}` : base, items: items.slice(0, limit) };
}

async function webChannel(url, getPublic) {
  const page = await getPublic(url);
  if (/<(rss|feed)\b/i.test(page.html.slice(0, 2000))) {
    const items = parseFeed(page.html, page.url);
    if (items.length) return { kind: "feed", title: decode(tag(page.html, "title") || new URL(url).hostname), url: page.url, items: items.slice(0, MAX_ITEMS) };
  }
  const declared = [...page.html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((l) => /rel=["']alternate["']/i.test(l) && /(rss|atom)\+xml/i.test(l)).map((l) => attr(l, "link", "href")).filter(Boolean);
  const origin = new URL(page.url).origin;
  const candidates = [...declared.map((h) => new URL(h, page.url).href), ...["/feed", "/feed/", "/rss.xml", "/feed.xml", "/atom.xml", "/index.xml", "/blog/feed"].map((p) => origin + p)];
  for (const candidate of [...new Set(candidates)].slice(0, 8)) {
    try {
      const feed = await getPublic(candidate);
      const items = parseFeed(feed.html, feed.url);
      if (items.length) return { kind: "feed", title: decode(tag(feed.html, "title") || new URL(url).hostname), url: feed.url, items: items.slice(0, MAX_ITEMS) };
    } catch { /* Try the next conventional feed location. */ }
  }
  for (const sitemapUrl of [origin + "/sitemap.xml", origin + "/post-sitemap.xml", origin + "/sitemap_index.xml"]) {
    try {
      let xml = (await getPublic(sitemapUrl)).html;
      const nested = [...xml.matchAll(/<sitemap>[^]*?<loc>([^<]+)<\/loc>/gi)].map((m) => decode(m[1])).find((loc) => /post|blog|news|artigo|noticia/i.test(loc));
      if (nested) xml = (await getPublic(nested)).html;
      const urls = [...xml.matchAll(/<url>([^]*?)<\/url>/gi)].map((m) => ({ url: decode(tag(m[1], "loc")), publishedAt: decode(tag(m[1], "lastmod") || "") || null })).filter((x) => x.url && x.url !== origin + "/");
      if (urls.length) {
        urls.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
        return { kind: "sitemap", title: new URL(url).hostname, url: sitemapUrl, items: urls.slice(0, MAX_ITEMS).map((x) => ({ ...x, title: decodeURIComponent(new URL(x.url).pathname.split("/").filter(Boolean).pop() || x.url).replace(/[-_]+/g, " "), description: "" })) };
      }
    } catch { /* No sitemap at this location. */ }
  }
  throw new Error("Não encontramos um feed RSS, Atom ou sitemap neste site. Cadastre as páginas individualmente ou informe o endereço do feed.");
}

export async function discoverChannel(input, { getPublic = fetchPublic, instagram } = {}) {
  const url = safeUrl(input?.url || "");
  if (!url) throw new Error("Use uma URL pública com http:// ou https://.");
  const kind = sourceKind(url);
  if (kind === "youtube") {
    if (/[?&]v=|youtu\.be\/|\/shorts\/[\w-]{11}/.test(url)) throw new Error("Este link é de um vídeo. Para importar o canal inteiro, use o endereço do canal (ex.: youtube.com/@nome).");
    return youtubeChannel(url, getPublic, Math.min(200, Math.max(1, Number(input.limit) || 60)));
  }
  if (kind === "social") {
    if (!/instagram\.com$/i.test(new URL(url).hostname) || !instagram) throw new Error("Perfis de redes sociais exigem a conexão oficial da conta em Configurações.");
    const profile = await instagram(url);
    return { kind: "instagram", title: profile.title, url, items: (profile.items || []).slice(0, MAX_ITEMS) };
  }
  return webChannel(url, getPublic);
}

async function youtubeItem(item, getPublic) {
  const page = await getPublic(item.url, 0, { maxBytes: 4 * 1024 * 1024 });
  const player = embeddedJson(page.html, "ytInitialPlayerResponse");
  const details = player?.videoDetails || {};
  const description = details.shortDescription || item.description || "";
  const body = [details.title || item.title, description].filter(Boolean).join("\n\n");
  const analysed = analyseText(body);
  const minutes = Number(details.lengthSeconds) ? Math.round(Number(details.lengthSeconds) / 60) : null;
  return { ...analysed, title: (details.title || item.title).slice(0, 160), type: "Vídeo", origin: `YouTube · ${details.author || "canal"}`, url: item.url, sourceKind: "youtube", publishedAt: player?.microformat?.playerMicroformatRenderer?.publishDate || null, extraction: { status: "ready", method: "título e descrição pública do vídeo · transcrição completa requer o arquivo de áudio", extractedAt: new Date().toISOString(), durationMinutes: minutes } };
}

// Imports run with limited concurrency; a failing item is reported without stopping the rest.
export async function importChannelItems(input, { getPublic = fetchPublic } = {}) {
  const items = Array.isArray(input?.items) ? input.items.slice(0, 12) : [];
  if (!items.length) throw new Error("Escolha ao menos uma publicação para importar.");
  const results = [], errors = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        const url = safeUrl(item?.url || "");
        if (!url) throw new Error("Link inválido.");
        if (item.text && item.kind === "instagram") results.push({ ...analyseText(item.text), title: String(item.title || "Publicação").slice(0, 160), type: "Social", origin: input.channelTitle || "Instagram", url, sourceKind: "social", publishedAt: item.publishedAt || null, extraction: { status: "ready", method: "API oficial do Instagram", extractedAt: new Date().toISOString() } });
        else if (sourceKind(url) === "youtube") results.push(await youtubeItem({ ...item, url }, getPublic));
        else results.push({ ...(await ingestUrl({ url, title: item.title }, { getPublic })), publishedAt: item.publishedAt || null });
      } catch (error) { errors.push({ url: item?.url, title: item?.title, error: error.message }); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { sources: results.map((s) => ({ ...s, channel: { title: input.channelTitle || null, url: input.channelUrl || null } })), errors };
}
