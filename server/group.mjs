// Group coherence: the group's rules and every brand's DNA read together, as a compliance reviewer
// would. Problems name the brands involved; one general recommendation closes the review.
const KINDS = ["conflito", "sobreposição", "dado divergente", "compliance", "lacuna"];
const SEVERITY = ["alta", "média", "baixa"];

export async function checkGroupCoherence({ group, brands }, model) {
  if (!group?.name) throw new Error("Informe o grupo.");
  const ready = (brands || []).filter((b) => b?.name && Object.values(b.voice || {}).some((v) => String(v || "").trim()));
  if (ready.length < 2) throw new Error("A coerência compara ao menos duas marcas com ficha de voz preenchida.");
  const result = await model(
    "Atue como revisor de compliance e de arquitetura de marca de um grupo empresarial. Leia as regras do grupo e a ficha de voz e o DNA de cada marca. " +
      "Aponte conflitos entre marcas, públicos ou promessas que se sobrepõem, números e provas que divergem entre marcas, riscos regulatórios (por exemplo, a publicidade da advocacia pelo Provimento 205/2021 da OAB, captação de clientela, oferta de crédito) e lacunas nas regras do grupo. Use apenas o que está no material; não invente fatos. " +
      'Retorne json {"problemas": [{"tipo": "conflito"|"sobreposição"|"dado divergente"|"compliance"|"lacuna", "marcas": string[], "problema": string, "gravidade": "alta"|"média"|"baixa"}], "recomendacao": string, "regrasSugeridas": string[]}. "recomendacao" é um parágrafo curto para o grupo como um todo; "regrasSugeridas" são regras curtas que valeriam para todas as marcas. Máximo de 8 problemas.',
    { grupo: group, marcas: ready.map((b) => ({ nome: b.name, papel: b.role || "", voz: b.voice, dna: b.dna || null })) },
  );
  const problems = Array.isArray(result.problemas) ? result.problemas : [];
  if (!String(result.recomendacao || "").trim() || problems.some((p) => !p?.problema?.trim()))
    throw new Error("A revisão do grupo veio sem recomendação. Nada foi alterado.");
  const names = new Set(ready.map((b) => b.name));
  return {
    problems: problems.slice(0, 8).map((p) => ({
      kind: KINDS.includes(p.tipo) ? p.tipo : "conflito",
      brands: (Array.isArray(p.marcas) ? p.marcas : []).filter((n) => names.has(n)),
      problem: p.problema.trim(),
      severity: SEVERITY.includes(p.gravidade) ? p.gravidade : "média",
    })),
    recommendation: result.recomendacao.trim(),
    suggestedRules: (Array.isArray(result.regrasSugeridas) ? result.regrasSugeridas : []).filter((r) => typeof r === "string" && r.trim()).slice(0, 8),
    brands: ready.map((b) => b.name),
    at: new Date().toISOString(),
  };
}
