import { BRAND_WRITING } from "./editorial.mjs";
import { editorialIssues } from "../src/editorial-quality.mjs";

// Refino: a reviewer never only criticises. It lists the problems and closes with one general
// recommendation; a writer applies it into a new version, and a blind judge from another model
// family compares both versions.
export const RUBRIC = [
  ["clareza", "Clareza"],
  ["evidencia", "Evidência"],
  ["voz", "Voz da marca"],
  ["utilidade", "Utilidade para o público"],
];
const SEVERITY = ["alta", "média", "baixa"];

const issuesOf = (packet, body) =>
  editorialIssues({
    body,
    format: packet.brief.format,
    brief: { ...packet.brief, brandName: packet.brand?.name || packet.brief.brandName },
    brand: packet.brand,
    sources: packet.sources,
  }).map((i) => i.message);

async function review(packet, piece, model) {
  const result = await model(
    "Atue como Revisor de refino, independente do redator, como um parecerista de revista científica: depois de listar os problemas, diz numa recomendação geral como resolvê-los. " +
      BRAND_WRITING +
      " Avalie o conteúdo com o contexto completo da marca (packet.brand, packet.voice, packet.brandDNA, packet.brandKnowledge) e as fontes da peça. Liste só o que muda a qualidade para o público e para a marca. " +
      'Retorne json {"problemas": [{"problema": string, "trecho": string, "gravidade": "alta"|"média"|"baixa"}], "recomendacao": string}. "problema" é uma frase curta; "trecho" cita literalmente o pedaço do texto em questão, ou fica vazio; "recomendacao" é UM parágrafo curto (2 a 4 frases) que orienta a reescrita como um todo. Máximo de 6 problemas.',
    { packet, peca: { titulo: piece.title, formato: piece.format, texto: piece.body } },
  );
  const problems = Array.isArray(result.problemas) ? result.problemas : [];
  if (!result.recomendacao?.trim() || problems.some((p) => !p?.problema?.trim()))
    throw new Error("O revisor não devolveu a recomendação geral. Nada foi alterado.");
  return {
    recommendation: result.recomendacao.trim(),
    problems: problems.slice(0, 6).map((p) => ({
      problem: p.problema.trim(),
      excerpt: typeof p.trecho === "string" ? p.trecho.trim() : "",
      severity: SEVERITY.includes(p.gravidade) ? p.gravidade : "média",
    })),
  };
}

async function rewrite(packet, piece, reviewed, model) {
  const result = await model(
    "Atue como redator da marca. Reescreva aplicando as recomendações do revisor: resolva os problemas listados seguindo a recomendação geral, sem criar problemas novos. " +
      BRAND_WRITING +
      ' Mantenha formato, tamanho aproximado e as fontes da peça; não invente fatos, números ou promessas que as fontes não sustentam. Retorne json {"body": string, "mudancas": string[]} com o texto final completo e uma frase por mudança feita.',
    { packet, peca: { titulo: piece.title, formato: piece.format, texto: piece.body }, problemas: reviewed.problems, recomendacao: reviewed.recommendation },
  );
  if (typeof result.body !== "string" || result.body.trim().length < 40)
    throw new Error("O redator não devolveu uma versão revisada completa. Nada foi alterado.");
  return {
    body: result.body.trim(),
    changes: (Array.isArray(result.mudancas) ? result.mudancas : []).filter((c) => typeof c === "string" && c.trim()).slice(0, 8),
  };
}

// The judge sees two unlabeled versions in random order and never learns which model wrote them.
async function judge(packet, original, revised, model) {
  const revisedFirst = Math.random() < 0.5;
  const [a, b] = revisedFirst ? [revised, original] : [original, revised];
  const result = await model(
    "Você é um avaliador cego. Compare duas versões do mesmo conteúdo para a marca packet.brand, com a voz em packet.voice e o DNA em packet.brandDNA. Não sabe quem escreveu nenhuma. " +
      'Dê nota de 1 a 5 em cada critério para A e B: clareza, evidencia (afirmações sustentadas pelas fontes), voz (soa como a marca), utilidade (ajuda o público a agir). Retorne json {"A": {"clareza": n, "evidencia": n, "voz": n, "utilidade": n}, "B": {...}, "preferida": "A"|"B"|"empate", "motivo": string}.',
    {
      packet: { brand: packet.brand, voice: packet.voice, brandDNA: packet.brandDNA, brief: packet.brief, sources: (packet.sources || []).map((s) => ({ title: s.title, origin: s.origin, text: String(s.text || "").slice(0, 6000) })) },
      A: a,
      B: b,
    },
  );
  const scores = (side) => {
    const s = result[side] || {};
    const out = Object.fromEntries(RUBRIC.map(([k]) => [k, Number(s[k])]));
    if (Object.values(out).some((n) => !Number.isFinite(n) || n < 1 || n > 5)) throw new Error("O juiz cego devolveu notas incompletas.");
    return out;
  };
  const [scoreA, scoreB] = [scores("A"), scores("B")];
  const winnerLabel = ["A", "B"].includes(result.preferida) ? result.preferida : "empate";
  const winner = winnerLabel === "empate" ? "empate" : (winnerLabel === "A") === revisedFirst ? "revisada" : "original";
  return {
    original: revisedFirst ? scoreB : scoreA,
    revised: revisedFirst ? scoreA : scoreB,
    winner,
    reason: String(result.motivo || "").trim(),
  };
}

export async function refinePiece(packet, piece, { reviewer, writer, judge: judgeModel }) {
  if (!piece?.body?.trim()) throw new Error("Não há texto para refinar.");
  const reviewed = await review(packet, piece, reviewer.model);
  const revised = await rewrite(packet, piece, reviewed, writer.model);
  let verdict = null;
  try {
    verdict = await judge(packet, piece.body, revised.body, judgeModel.model);
  } catch (error) {
    // A judge failure never discards the paid review and rewrite.
    verdict = { error: error.message };
  }
  return {
    ...reviewed,
    revised: { ...revised, issues: issuesOf(packet, revised.body) },
    originalIssues: issuesOf(packet, piece.body),
    judge: verdict,
    models: { reviewer: reviewer.name, writer: writer.name, judge: judgeModel.name },
    at: new Date().toISOString(),
  };
}
