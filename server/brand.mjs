import { fetchPublic, extractPage } from "./collector.mjs";
import {
  inspectAppliedStyles,
  inspectDynamicStyles,
  needsHydration,
} from "./brand-render.mjs";

export function normalizeColor(value) {
  if (/^#[\da-f]{3}$/i.test(value))
    return (
      "#" +
      [...value.slice(1)]
        .map((c) => c + c)
        .join("")
        .toLowerCase()
    );
  const rgb = value.match(
    /^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i,
  );
  if (rgb)
    return rgb[4] === "0"
      ? ""
      : "#" +
          rgb
            .slice(1, 4)
            .map((n) => Number(n).toString(16).padStart(2, "0"))
            .join("");
  return /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : "";
}
export function inspectBrandMaterial(materials) {
  const colors = new Map(),
    fonts = new Map();
  for (const { text, origin } of materials) {
    // Gutenberg presets and unused Elementor globals are not a brand palette.
    const clean = text
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/--(?:wp--preset|e-global-color)[^;{}]+;?/gi, "");
    for (const match of clean.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
      const value = normalizeColor(match[0]);
      if (!colors.has(value))
        colors.set(value, {
          value,
          origin,
          evidence: clean
            .slice(Math.max(0, match.index - 65), match.index + 85)
            .replace(/\s+/g, " "),
          status: "observed",
        });
    }
    for (const match of clean.matchAll(
      /(?:font-family|fontes?|tipografia)\s*:\s*([^;\n}<]{2,160})/gi,
    )) {
      const value = match[1].trim().replace(/["']/g, "");
      if (!/awesome|icon|inherit|var\(/i.test(value) && !fonts.has(value))
        fonts.set(value, {
          value,
          origin,
          evidence: match[0],
          status: "observed",
        });
    }
  }
  const documentation = materials
    .filter((m) => m.origin === "Documentação fornecida")
    .map((m) => m.text)
    .join("\n");
  const explicit = (label) =>
    documentation
      .match(
        new RegExp(`(?:^|\\n)\\s*(?:${label})\\s*:\\s*([^\\n]+)`, "i"),
      )?.[1]
      ?.trim() || "";
  const result = {
    colors: [...colors.values()].slice(0, 12),
    fonts: [...fonts.values()].slice(0, 10),
    tone: explicit("tom de voz|voz"),
    audience: explicit("público|publico"),
    aesthetic: explicit("estética|estetica|direção visual|direcao visual"),
    positioning: explicit("posicionamento"),
    primary: explicit("cor principal|primária|primaria"),
    secondary: explicit("cor secundária|cor secundaria"),
    background: explicit("cor de fundo"),
    headingFont: explicit("fonte dos títulos|fonte dos titulos"),
    bodyFont: explicit("fonte do texto"),
    sources: materials.map((m) => m.origin),
    extractedAt: new Date().toISOString(),
    fieldEvidence: {},
    notes: [
      "A proposta exige validação humana. Observado significa encontrado no material; sugerido significa interpretação editorial, não uma declaração da marca.",
    ],
  };
  for (const key of [
    "tone",
    "audience",
    "aesthetic",
    "positioning",
    "primary",
    "secondary",
    "background",
    "headingFont",
    "bodyFont",
  ])
    if (result[key])
      result.fieldEvidence[key] = {
        status: "observed",
        confidence: "alta",
        origin: "Documentação fornecida",
        evidence: result[key],
      };
  return result;
}
const most = (values) =>
  [...new Set(values.filter(Boolean))].sort(
    (a, b) =>
      values.filter((v) => v === b).length -
      values.filter((v) => v === a).length,
  )[0] || "";
export function applyRenderedEvidence(dna, sample, origin) {
  const set = (
    key,
    value,
    evidence,
    status = "observed",
    confidence = "alta",
  ) => {
    if (!dna[key] && value) {
      dna[key] = value;
      dna.fieldEvidence[key] = { status, confidence, origin, evidence };
    }
  };
  const primary = most(
    sample.buttons
      .map((s) => normalizeColor(s.background))
      .filter((c) => c && !["#ffffff", "#000000"].includes(c)),
  );
  const headingColor = most(
    sample.headings.map((s) => normalizeColor(s.color)),
  );
  set(
    "primary",
    primary || headingColor,
    primary
      ? "Cor de fundo aplicada aos botões principais."
      : "Cor aplicada aos títulos; sugerida como cor principal.",
    primary ? "observed" : "suggested",
    primary ? "alta" : "média",
  );
  set(
    "secondary",
    headingColor !== dna.primary
      ? headingColor
      : most(
          sample.body
            .map((s) => normalizeColor(s.color))
            .filter((c) => c !== dna.primary),
        ),
    "Cor aplicada aos títulos ou ao texto; papel secundário sugerido.",
    "suggested",
    "média",
  );
  set(
    "background",
    normalizeColor(sample.background),
    "Cor de fundo calculada do elemento body.",
  );
  set(
    "headingFont",
    most(sample.headings.map((s) => s.font.replace(/["']/g, ""))),
    "Família tipográfica aplicada aos títulos.",
  );
  set(
    "bodyFont",
    most(sample.body.map((s) => s.font.replace(/["']/g, ""))),
    "Família tipográfica aplicada aos parágrafos.",
  );
  const evidence = [...sample.headings.slice(0, 7), ...sample.body.slice(0, 8)]
    .map((s) => s.text)
    .join(" | ");
  if (sample.headings.length)
    set(
      "aesthetic",
      `Hierarquia de títulos em ${dna.headingFont || "fonte do site"}. Título principal em ${(sample.headings.find((s) => s.tag === "H1") || sample.headings[0]).size}. ${primary ? `Chamadas de ação em ${primary}.` : ""} Validar composição e uso de imagens com a equipe.`,
      "Interpretação dos estilos aplicados; imagens e animações não foram analisadas.",
      "suggested",
      "média",
    );
  const legal = /advoca|jurídic|juridic|direito|trabalhista/i.test(
    evidence + sample.description,
  );
  if (legal) {
    set(
      "tone",
      "Informativo, profissional e orientado a esclarecer questões jurídicas.",
      evidence.slice(0, 500),
      "suggested",
      "média",
    );
    const groups = ["bancários", "trabalhadores", "empresas"].filter((_, i) =>
      [/bancári|bancári/i, /trabalhador|trabalhist/i, /empresa|empresari/i][
        i
      ].test(evidence + sample.description),
    );
    set(
      "audience",
      groups.length
        ? groups.join(", ") +
            " interessados nos temas jurídicos apresentados no site."
        : "Pessoas e organizações que buscam orientação sobre os temas jurídicos do site.",
      evidence.slice(0, 500),
      "suggested",
      "média",
    );
  }
  const visibleText = sample.visibleText || evidence;
  const audienceSection = visibleText.match(
    /(?:para quem|quem atendemos|nosso público|público-alvo)\s+(.{40,650})/i,
  )?.[1];
  if (audienceSection)
    set(
      "audience",
      audienceSection
        .split(/(?<=[.!?])\s+/)
        .slice(0, 3)
        .join(" ")
        .slice(0, 500),
      "Trecho da seção de público do site: " + audienceSection.slice(0, 550),
      "suggested",
      "média",
    );
  if (!dna.tone && sample.body.length)
    set(
      "tone",
      /ciência|técnic|dados|plataforma|pesquisa|inteligência/i.test(visibleText)
        ? "Informativo e explicativo, com vocabulário técnico relacionado às soluções apresentadas."
        : "Institucional e explicativo, orientado às soluções apresentadas no site.",
      sample.body
        .slice(0, 3)
        .map((s) => s.text)
        .join(" | ")
        .slice(0, 600),
      "suggested",
      "baixa",
    );
  if (sample.description)
    set(
      "positioning",
      sample.description.slice(0, 600),
      "Descrição editorial publicada nos metadados do site.",
      "observed",
      "média",
    );
  else if (sample.headings[0])
    set(
      "positioning",
      sample.headings[0].text,
      "Primeiro título do site; validar se representa o posicionamento.",
      "suggested",
      "baixa",
    );
  const documentedColors = dna.colors.filter(
    (c) => c.origin === "Documentação fornecida",
  );
  const applied = [
    normalizeColor(sample.background),
    ...sample.headings.map((s) => normalizeColor(s.color)),
    ...sample.buttons.map((s) => normalizeColor(s.background)),
    ...sample.body.map((s) => normalizeColor(s.color)),
  ].filter(Boolean);
  const palette = new Map(documentedColors.map((c) => [c.value, c]));
  for (const value of applied)
    if (!palette.has(value))
      palette.set(value, {
        value,
        origin,
        evidence: "Cor calculada em elementos visíveis da página.",
        status: "observed",
      });
  dna.colors = [...palette.values()].slice(0, 8);
  dna.fonts = [
    ...new Set(
      [...sample.headings, ...sample.body, ...(sample.typography || [])].map(
        (s) => s.font.replace(/["']/g, ""),
      ),
    ),
  ]
    .filter(Boolean)
    .slice(0, 8)
    .map((value) => ({
      value,
      origin,
      evidence:
        "Família declarada nos estilos calculados de elementos visíveis; arquivo remoto da fonte não foi carregado.",
      status: "observed",
    }));
  return dna;
}
export async function extractBrand(
  { url, documentation = "" },
  {
    getPublic = fetchPublic,
    renderStatic = inspectAppliedStyles,
    renderDynamic = inspectDynamicStyles,
  } = {},
) {
  if (typeof documentation !== "string" || documentation.length > 80000)
    throw new Error("Documentação deve conter até 80 mil caracteres.");
  if (url && typeof url !== "string") throw new Error("URL inválida.");
  if (!url && !documentation.trim())
    throw new Error("Informe um site ou documentação.");
  const materials = [],
    warnings = [];
  let page,
    sample,
    method = "documentation";
  if (url) {
    page = await getPublic(url);
    materials.push({ text: page.html, origin: page.url, kind: "html" });
    const links = [...page.html.matchAll(/<link\b[^>]*>/gi)].filter((m) =>
      /\brel\s*=\s*["'][^"']*stylesheet/i.test(m[0]),
    );
    const score = (href) =>
      /uploads.*(?:elementor|post-)|hub-child|custom/i.test(href)
        ? 4
        : /themes|typography|elementor.*frontend/i.test(href)
          ? 3
          : /font.*css|googleapis/i.test(href)
            ? 2
            : 1;
    const urls = [
      ...new Set(
        links
          .map((m) => m[0].match(/\bhref\s*=\s*["']([^"']+)/i)?.[1])
          .filter(Boolean),
      ),
    ]
      .filter(
        (h) =>
          !/wp-includes|font-awesome|fontawesome|job-board|swiper|redux|revslider/i.test(
            h,
          ),
      )
      .sort((a, b) => score(b) - score(a))
      .slice(0, 10);
    const results = await Promise.allSettled(
      urls.map((href) =>
        getPublic(new URL(href.replace(/&amp;/g, "&"), page.url).href),
      ),
    );
    for (const result of results) {
      if (result.status === "fulfilled")
        materials.push({
          text: result.value.html,
          origin: result.value.url,
          kind: "css",
        });
      else
        warnings.push(
          "Uma folha de estilo não pôde ser lida: " + result.reason.message,
        );
    }
  }
  if (documentation.trim())
    materials.push({ text: documentation, origin: "Documentação fornecida" });
  if (page) {
    method = "static";
    try {
      sample = await renderStatic(page.html, materials);
    } catch {
      warnings.push("A leitura estática de estilos não ficou disponível.");
    }
    if (!sample || needsHydration(sample)) {
      try {
        const rendered = await renderDynamic(page, { getPublic });
        sample = rendered.sample;
        materials.push(...rendered.materials);
        method = "rendered";
        warnings.push(...rendered.warnings);
      } catch {
        warnings.push(
          "A página depende de JavaScript, mas a renderização não disponibilizou conteúdo suficiente.",
        );
      }
    }
    if (
      (!sample || needsHydration(sample)) &&
      !documentation.trim() &&
      extractPage(page.html).length < 120
    )
      throw new Error(
        "O site depende de JavaScript e não trouxe conteúdo suficiente após a tentativa de renderização. Tente novamente ou forneça a documentação da marca. Nenhuma proposta vazia foi criada.",
      );
  }
  const dna = inspectBrandMaterial(materials);
  if (sample) applyRenderedEvidence(dna, sample, page.url);
  dna.sources = [...new Set(dna.sources)];
  const partial = Boolean(page && (!sample || needsHydration(sample)));
  return {
    ...dna,
    quality: {
      status: partial ? "partial" : "ready",
      method,
      headings: sample?.headings.length || 0,
      paragraphs: sample?.body.length || 0,
      textCharacters: sample?.visibleText?.length || documentation.length,
    },
    notes: [
      ...dna.notes,
      method === "rendered"
        ? "Página renderizada em navegador isolado. Scripts públicos foram executados para montar o conteúdo; todos os recursos de rede passaram pelo leitor de endereços públicos."
        : "Estilos calculados a partir do HTML/CSS público ou da documentação fornecida.",
      "Imagens não foram analisadas e arquivos remotos de fontes não foram carregados. Voz e público sugeridos são interpretações heurísticas do texto, sem geração por modelo de IA.",
      ...warnings,
    ],
    excerpt: (
      sample?.visibleText ||
      materials
        .filter((m) => m.kind !== "css")
        .map((m) => extractPage(m.text))
        .join("\n")
    ).slice(0, 12000),
  };
}
