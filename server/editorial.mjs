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
export async function reviewGenerated(packet, versions, model) {
  for (const variant of versions) validateGenerated(packet, variant);
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
  return versions.map((variant, index) => {
    const review = result.reviews.find((r) => r.index === index);
    if (
      !review ||
      ["coherent", "brandAligned", "evidenceSupported", "complete"].some(
        (k) => typeof review[k] !== "boolean",
      ) ||
      !review.reason?.trim() ||
      !Array.isArray(review.issues) ||
      review.issues.some((i) => typeof i !== "string")
    )
      throw new Error(
        "Parecer editorial incompleto. Nenhum conteúdo foi liberado.",
      );
    if (
      ["coherent", "brandAligned", "evidenceSupported", "complete"].some(
        (k) => !review[k],
      ) ||
      review.issues.length
    )
      throw new Error(
        "A revisão editorial pediu ajustes: " +
          [review.reason, ...review.issues].join(" "),
      );
    return {
      ...variant,
      editorialReview: {
        ...review,
        mode: "provider",
        humanReviewPending: true,
      },
    };
  });
}
