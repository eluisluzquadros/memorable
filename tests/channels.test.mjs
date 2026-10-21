import test from "node:test";
import assert from "node:assert/strict";
import { parseFeed, youtubeVideosFromData, discoverChannel, importChannelItems } from "../server/channels.mjs";

test("RSS and Atom entries become channel items with absolute links", () => {
  const rss = `<rss><channel><title>Blog</title><item><title><![CDATA[Novo cenário]]></title><link>/novo-cenario/</link><pubDate>Wed, 30 Sep 2026 14:35:39 +0000</pubDate><description>Resumo &amp; contexto</description></item></channel></rss>`;
  const [item] = parseFeed(rss, "https://exemplo.com.br/blog/");
  assert.equal(item.url, "https://exemplo.com.br/novo-cenario/");
  assert.equal(item.title, "Novo cenário");
  assert.equal(item.description, "Resumo & contexto");
  const atom = `<feed><entry><title>Vídeo</title><link rel="alternate" href="https://www.youtube.com/watch?v=abcdefghijk"/><published>2026-10-19</published><media:description>Descrição</media:description></entry></feed>`;
  assert.equal(parseFeed(atom, "https://www.youtube.com/")[0].description, "Descrição");
});

test("YouTube listings are read from both the legacy renderer and the lockup view model", () => {
  const data = { contents: [
    { videoRenderer: { videoId: "AAAAAAAAAAA", title: { runs: [{ text: "Antigo" }] }, viewCountText: { simpleText: "10 views" } } },
    { lockupViewModel: { contentId: "BBBBBBBBBBB", contentType: "LOCKUP_CONTENT_TYPE_VIDEO", metadata: { lockupMetadataViewModel: { title: { content: "Novo" } } } } },
    { lockupViewModel: { contentId: "PLxyz", contentType: "LOCKUP_CONTENT_TYPE_PLAYLIST", metadata: { lockupMetadataViewModel: { title: { content: "Playlist" } } } } },
  ] };
  assert.deepEqual(youtubeVideosFromData(data).map((v) => v.title), ["Antigo", "Novo"]);
});

test("a video link is refused as a channel, and a site without feed explains the alternative", async () => {
  await assert.rejects(discoverChannel({ url: "https://www.youtube.com/watch?v=AAAAAAAAAAA" }), /endereço do canal/);
  const getPublic = async (url) => { if (url === "https://site.exemplo.com.br/") return { html: "<html><head></head><body>Oi</body></html>", url }; throw new Error("404"); };
  await assert.rejects(discoverChannel({ url: "https://site.exemplo.com.br/" }, { getPublic }), /feed RSS, Atom ou sitemap/);
});

test("importing reports failures per item without losing the successful ones", async () => {
  const page = `<html><head><title>Artigo</title></head><body><article>${"Texto do artigo com conteúdo suficiente para virar referência. ".repeat(6)}</article></body></html>`;
  const getPublic = async (url) => { if (url.includes("quebrado")) throw new Error("A fonte respondeu HTTP 500."); return { html: page, url }; };
  const result = await importChannelItems({ items: [{ url: "https://blog.exemplo.com.br/ok" }, { url: "https://blog.exemplo.com.br/quebrado", title: "Quebrado" }], channelTitle: "Blog" }, { getPublic });
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].channel.title, "Blog");
  assert.deepEqual(result.errors.map((e) => e.title), ["Quebrado"]);
});

test("every server module loads (catches syntax errors in files no other test imports)", async () => {
  const fs = await import("node:fs");
  for (const file of fs.readdirSync(new URL("../server/", import.meta.url)).filter((f) => f.endsWith(".mjs") && f !== "runtime.mjs"))
    await import(new URL(`../server/${file}`, import.meta.url));
});
