import { BANNED_CLICHES } from "./playbooks.mjs";
// Deterministic rejection rules, not a measurement of creative or factual quality.
export const EDITORIAL_STANDARD = 2;
const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const words = (value) => normalize(value).split(" ").filter(Boolean);
export function contentSections(body, format) {
  if (/Fala:/i.test(body))
    return [
      ...body.matchAll(/Fala:\s*([\s\S]*?)(?=\nDireção:|\nCENA\s+\d|$)/gi),
    ].map((m) => m[1].trim());
  if (format === "Carrossel")
    return body
      .split(/(?:TELA|SLIDE)\s+\d+[^\n]*\n/gi)
      .slice(1)
      .map((s) => s.trim());
  return body
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}
export function editorialIssues({
  body = "",
  format,
  brief = {},
  brand,
  sources = [],
}) {
  const issues = [];
  const add = (code, message) => {
    if (!issues.some((i) => i.code === code)) issues.push({ code, message });
  };
  const sections = contentSections(body, format);
  const copy = sections.join(" "),
    count = words(copy).length;
  if (!copy.trim()) add("empty", "O conteúdo está vazio.");
  if (
    /\[(?:desenvolver|escreva|inserir|insira|complete|redigir|evidência|exemplo|pergunta|gancho|ação|cta)[^\]]*\]/i.test(
      body,
    )
  )
    add(
      "placeholder",
      "Há campos de estrutura ainda sem redação. Complete o conteúdo antes de revisar.",
    );
  const minimum = brief.video
    ? Math.max(12, Number(brief.durationSeconds || 30) * 0.9)
    : format === "Artigo"
      ? 160
      : format === "Newsletter"
        ? 100
        : format === "Carrossel"
          ? 60
          : format === "Produto digital"
            ? 300
            : format === "Site para negócio local"
              ? 150
              : ["Fotos de produto", "Fotos de imóvel e tour", "Thumbnail"].includes(format)
                ? 60
                : 35;
  if (brief.scriptMode !== "outline" && count < minimum)
    add(
      "underdeveloped",
      `O conteúdo não desenvolve o formato solicitado (${count} palavras).`,
    );
  if (
    format === "Carrossel" &&
    (sections.length < 4 ||
      sections.length > 10 ||
      sections.some((s) => words(s).length < 5))
  )
    add(
      "carousel",
      "O carrossel precisa de 4 a 10 telas, com progressão de ideia e texto desenvolvido em cada uma.",
    );
  if (format === "Podcast completo" && Number(brief.durationSeconds) < 300)
    add(
      "podcast-duration",
      "Um episódio completo não pode ter menos de 5 minutos; use um formato de corte.",
    );
  if (
    brief.scriptMode === "outline" &&
    (count <
      Math.min(360, Math.max(20, Number(brief.durationSeconds || 30) * 0.1)) ||
      (format === "Podcast completo" && sections.length < 3))
  )
    add(
      "outline",
      "A estrutura precisa desenvolver blocos, perguntas e condução suficientes para o episódio.",
    );
  if (
    /skip to content|assessoria de imprensa|notícias recomendadas|compartilhe conteúdo/i.test(
      copy,
    )
  )
    add(
      "boilerplate",
      "O texto contém navegação ou metadados do site de referência, em vez de redação própria.",
    );
  for (let i = 0; i < sections.length; i++)
    for (let j = i + 1; j < sections.length; j++) {
      const a = normalize(sections[i]),
        b = normalize(sections[j]);
      const wa = words(a),
        wb = words(b),
        sa = new Set(wa),
        sb = new Set(wb);
      const overlap =
        [...sa].filter((w) => sb.has(w)).length /
        Math.max(1, Math.min(sa.size, sb.size));
      if (
        (Math.min(wa.length, wb.length) >= 4 &&
          (a === b || a.includes(b) || b.includes(a))) ||
        (Math.min(wa.length, wb.length) >= 10 && overlap > 0.9)
      )
        add(
          "repetition",
          `Há repetição entre os blocos ${i + 1} e ${j + 1}; cada bloco precisa acrescentar algo.`,
        );
    }
  if (/Fala:/i.test(body) && brief.scriptMode !== "outline") {
    if (
      sections.some(
        (s) =>
          !/[.!?…][”"']?$/.test(s) ||
          /\b(o|a|os|as|de|do|da|e|com|para|pelo|pela|gostaria)$/i.test(s),
      )
    )
      add(
        "fragment",
        "Há falas interrompidas ou frases sem conclusão. Não corte frases para ajustar o tempo.",
      );
  }
  const name = brand?.name || brief.brandName;
  if (name && brief.brandName && !normalize(copy).includes(normalize(name)))
    add(
      "brand",
      "A mensagem não conecta o tema à marca que está produzindo o conteúdo. A fonte é referência, não o anunciante.",
    );
  for (const source of sources.filter(
    (s) => !["owned", "product"].includes(s.editorialRole),
  )) {
    const title = normalize(source.title);
    if (
      title.length > 30 &&
      sections.filter((s) => normalize(s).includes(title)).length > 1
    )
      add(
        "source-repetition",
        "O título da referência foi repetido como conteúdo. Desenvolva uma mensagem própria para a marca.",
      );
  }
  if (
    /\b(resultado garantido|garantimos resultados|100% garantido)\b/i.test(copy)
  )
    add("promise", "Há promessa absoluta de resultado sem sustentação.");
  const cliche = BANNED_CLICHES.find((c) =>
    ` ${normalize(copy)} `.includes(` ${normalize(c)} `),
  );
  if (cliche)
    add(
      "cliche",
      `Troque o clichê "${cliche}" por um momento concreto que mostre o benefício.`,
    );
  return issues;
}
