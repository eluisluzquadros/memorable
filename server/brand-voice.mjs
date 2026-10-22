import { extractPage } from "./collector.mjs";

// The home page rarely says enough about a brand. These are the pages where a business usually
// explains who it is, what it does and how it talks.
const KEY_PAGES = /sobre|quem-somos|quem_somos|escritorio|empresa|institucional|areas|atuacao|servicos|solucoes|especialidades|equipe|socios|missao|valores|diferenciais|metodo|como-trabalhamos/i;
const SKIP = /\.(pdf|jpg|jpeg|png|webp|svg|zip|docx?)(\?|$)|wp-login|wp-admin|feed|tag\/|categoria|category|page\/\d|#|mailto:|tel:|whatsapp|politica|privacidade|cookies|termos/i;

export function keyPageLinks(html, base, limit = 5) {
  const origin = new URL(base).origin;
  const seen = new Set([new URL(base).href.replace(/\/$/, "")]);
  const links = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url;
    try { url = new URL(m[1].replace(/&amp;/g, "&"), base); } catch { continue; }
    const href = url.href.replace(/#.*$/, "").replace(/\/$/, "");
    if (url.origin !== origin || seen.has(href) || SKIP.test(href)) continue;
    const label = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const score = (KEY_PAGES.test(url.pathname) ? 2 : 0) + (KEY_PAGES.test(label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-")) ? 1 : 0);
    if (!score) continue;
    seen.add(href);
    links.push({ href, score });
  }
  return links.sort((a, b) => b.score - a.score).slice(0, limit).map((l) => l.href);
}

export async function readKeyPages(page, getPublic, limit = 5) {
  const urls = keyPageLinks(page.html, page.url, limit);
  const results = await Promise.allSettled(urls.map((u) => getPublic(u)));
  return results
    .map((r, i) => (r.status === "fulfilled" ? { url: urls[i], text: extractPage(r.value.html).slice(0, 8000) } : null))
    .filter((p) => p && p.text.length > 200);
}

const FIELDS = {
  tone: "Tom de voz",
  audience: "Público e dores",
  positioning: "Posicionamento e ponto de vista",
  pillars: "Pilares editoriais",
  say: "O que dizemos / preferimos",
  avoid: "Expressões que evitamos",
  examples: "Exemplos de escrita aprovados",
  checklist: "Checklist de revisão",
};
export const VOICE_FIELDS = Object.keys(FIELDS);
const asText = (value) => (Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim()).join("\n") : typeof value === "string" ? value.trim() : "");
const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toLowerCase();

// The model drafts every voice field from what the brand publishes. Each field carries the passage
// that supports it; examples must be literal passages of the site, never invented copy.
export async function proposeVoice({ brandName, pages }, model) {
  const corpus = pages.map((p) => ({ url: p.url, texto: p.text }));
  const result = await model(
    "Atue como estrategista de marca. A partir só do que a marca publica (corpus), proponha a ficha de voz da marca packet.marca para orientar quem escreve por ela. Não invente fatos, números, serviços ou promessas. " +
      'Retorne json {"tone": string, "audience": string, "positioning": string, "pillars": string[], "say": string[], "avoid": string[], "examples": string[], "checklist": string[], "evidence": {"<campo>": {"quote": string, "url": string, "status": "observado"|"sugerido"}}}. ' +
      '"observado" quando o site afirma aquilo; "sugerido" quando é sua interpretação. "examples" são de 2 a 4 trechos copiados literalmente do corpus que já soam como a marca. "pillars" de 3 a 5 temas. "avoid" inclui o que a marca, pelo seu setor, não pode dizer. "checklist" de 3 a 6 itens verificáveis.',
    { marca: brandName || "", corpus },
  );
  const all = plain(pages.map((p) => p.text).join(" "));
  const voice = {}, evidence = {}, dropped = [];
  for (const key of VOICE_FIELDS) {
    let value = result[key];
    if (key === "examples" && Array.isArray(value)) {
      const kept = value.filter((v) => typeof v === "string" && v.trim().length > 20 && all.includes(plain(v).replace(/[“”"]/g, "").slice(0, 60)));
      if (kept.length < value.length) dropped.push("Exemplos que não estavam no site foram descartados.");
      value = kept;
    }
    const text = asText(value);
    if (!text) continue;
    voice[key] = text;
    const e = result.evidence?.[key] || {};
    evidence[key] = {
      status: e.status === "observado" ? "observed" : "suggested",
      confidence: e.status === "observado" ? "alta" : "média",
      origin: typeof e.url === "string" && e.url ? e.url : pages[0]?.url || "",
      evidence: typeof e.quote === "string" && e.quote.trim() ? e.quote.trim().slice(0, 400) : `${FIELDS[key]} proposto pelo modelo a partir do site.`,
    };
  }
  return { voice, evidence, notes: dropped };
}
