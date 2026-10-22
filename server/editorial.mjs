import { editorialIssues } from "../src/editorial-quality.mjs";
import { productionSettings, scriptTiming } from "../src/production.mjs";
export const BRAND_WRITING =
  "O anunciante é packet.brand.name, nunca o veículo da referência. Escreva marketing original para esse cliente: problema do público, ponto de vista ou benefício relevante da marca e próximo passo. Fontes externas fundamentam fatos; não repita seu título, não promova seus produtos e não transforme o post numa resenha da fonte. Use packet.brandKnowledge e packet.voice para afirmações sobre a marca. Sem evidência da capacidade ou da oferta, não invente benefícios, números, cases nem promessas. Atribuições factuais podem aparecer de forma discreta, sem ocupar a chamada principal. Não copie blocos da fonte. Cada parágrafo, tela ou cena deve desenvolver uma ideia nova; falas devem ter frases completas, naturais e caber na duração. Carrossel: 4 a 10 telas numeradas TELA 1 etc., com abertura, desenvolvimento concreto e fechamento. Artigo e newsletter: desenvolvimento, exemplos sustentados e conclusão. Retorne sourceIds válidos, incluindo a referência selecionada; fatos com {sourceId,excerpt} literal quando usados. Sem instruções internas nem placeholders no texto final.";
export function validateGenerated(packet, variant) {
  const brief = {
    ...packet.brief,
    brandName: packet.brand?.name || packet.brief.brandName,
  };
  const settings = productionSettings(brief);
  const issues = editorialIssues({
    body: variant.body,
    format: brief.format,
    brief: { ...brief, ...settings },
    brand: packet.brand,
    sources: packet.sources,
  });
  const allowed = new Set(
    [...(packet.sources || []), ...(packet.brandKnowledge || [])].map(
      (s) => s.id,
    ),
  );
  if (
    !Array.isArray(variant.sourceIds) ||
    !variant.sourceIds.length ||
    variant.sourceIds.some((id) => !allowed.has(id))
  )
    issues.push({
      message: "A versão não identifica fontes válidas do contexto.",
    });
  if (
    settings.video &&
    !scriptTiming(variant.body, { ...brief, ...settings }).passed
  )
    issues.push({
      message: "As falas ou os tempos não correspondem à duração solicitada.",
    });
  for (const fact of variant.facts || []) {
    const source = [...packet.sources, ...(packet.brandKnowledge || [])].find(
      (s) => s.id === fact.sourceId,
    );
    if (
      !source ||
      typeof fact.excerpt !== "string" ||
      !fact.excerpt.trim() ||
      !source.text.includes(fact.excerpt)
    )
      issues.push({
        message:
          "Uma evidência citada não foi encontrada no texto da fonte indicada.",
      });
  }
  if (issues.length)
    throw new Error(
      "Conteúdo rejeitado na checagem: " +
        issues.map((i) => i.message).join(" "),
    );
}
const CRITERIA = ["coherent", "brandAligned", "evidenceSupported", "complete"];
const mechanicalIssues = (packet, variant) => {
  try {
    validateGenerated(packet, variant);
    return [];
  } catch (e) {
    return [e.message.replace(/^Conteúdo rejeitado na checagem: /, "")];
  }
};
const reviewIssues = (review) =>
  review.issues.length ? review.issues : CRITERIA.some((k) => !review[k]) ? [review.reason] : [];

// The writer rewrites against the editor's notes; a revision that comes back malformed is ignored.
async function revise(packet, variant, issues, model) {
  const video = Array.isArray(variant.scenes);
  const result = await model(
    "Atue como Copywriter/Ghostwriter revisando a própria peça. " +
      BRAND_WRITING +
      ` Corrija exatamente os problemas apontados pelo editor, sem criar outros: remova ou atenue afirmações que a fonte não sustenta, mantenha formato, estratégia${video ? ", número de cenas e soma das durações" : ""}. Retorne ${video ? "{scenes:[{duration:number,speech,visual}],sourceIds:string[],facts:[{sourceId,excerpt}]}" : "{body,sourceIds:string[],facts:[{sourceId,excerpt}]}"}.`,
    { packet, peca: variant, problemas: issues },
  );
  const next = { ...variant, sourceIds: Array.isArray(result.sourceIds) && result.sourceIds.length ? result.sourceIds : variant.sourceIds, facts: Array.isArray(result.facts) ? result.facts : variant.facts };
  if (video) {
    const scenes = result.scenes;
    const valid = Array.isArray(scenes) && scenes.length && scenes.every((c) => Number.isFinite(c.duration) && c.duration > 0 && c.speech?.trim() && c.visual?.trim());
    return valid ? { ...next, scenes, body: scenes.map((c, i) => `CENA ${i + 1} · ${c.duration}s\nFala: ${c.speech}\nDireção: ${c.visual}`).join("\n\n") } : variant;
  }
  return typeof result.body === "string" && result.body.trim() ? { ...next, body: result.body } : variant;
}

export async function reviewGenerated(packet, versions, model, { rounds = 2, critic = model } = {}) {
  let current = versions;
  for (let round = 0; ; round++) {
    const reviews = await critique(packet, current, critic);
    const pending = current.map((v, i) => [...mechanicalIssues(packet, v), ...reviewIssues(reviews[i])]);
    if (pending.every((p) => !p.length) || round === rounds) {
      // Mechanical failures that survive every rewrite are never handed over as AI work.
      const broken = current.map((v) => mechanicalIssues(packet, v)).find((m) => m.length);
      if (broken) throw new Error("Conteúdo rejeitado na checagem: " + broken.join(" "));
      return current.map((variant, i) => ({
        ...variant,
        editorialReview: { ...reviews[i], mode: "provider", rounds: round + 1, passed: !pending[i].length, pending: pending[i], humanReviewPending: true },
      }));
    }
    current = await Promise.all(current.map((v, i) => (pending[i].length ? revise(packet, v, pending[i], model) : v)));
  }
}

async function critique(packet, versions, model) {
  const result = await model(
    "Atue como editor crítico independente do redator. " +
      BRAND_WRITING +
      " Avalie as versões recebidas: coerência e progressão, alinhamento ao cliente, sustentação de afirmações nas fontes e completude para o formato/tempo. Rejeite recortes de frases, repetição do título da referência, marketing do veículo externo, ideias vagas ou promessas inventadas. Não aprove apenas porque há fontes ou campos preenchidos. Retorne {reviews:[{index:number,coherent:boolean,brandAligned:boolean,evidenceSupported:boolean,complete:boolean,reason:string,issues:string[]}]}, uma revisão por versão, índices a partir de zero. Um critério sem evidência suficiente deve ser false. Esta revisão é consultiva, nunca autorização para publicar.",
    { packet, versions },
  );
  if (
    !Array.isArray(result.reviews) ||
    result.reviews.length !== versions.length ||
    new Set(result.reviews.map((r) => r.index)).size !== versions.length
  )
    throw new Error(
      "A revisão editorial não avaliou todas as versões. Nenhum conteúdo foi liberado.",
    );
  return versions.map((_, index) => {
    const review = result.reviews.find((r) => r.index === index);
    if (
      !review ||
      CRITERIA.some((k) => typeof review[k] !== "boolean") ||
      !review.reason?.trim() ||
      !Array.isArray(review.issues) ||
      review.issues.some((i) => typeof i !== "string")
    )
      throw new Error(
        "Parecer editorial incompleto. Nenhum conteúdo foi liberado.",
      );
    return review;
  });
}
