// What a judge sees, and the guards that stop a round when the measurement itself looks wrong.
// Lesson of EXP-308 (rounds 1 and 4): twice the judge saw less than the writer (a cut source, then no brand
// material) and punished true statements as invented. The judge's evidence is now built from the very
// packet the writer received, by this one function, and a test holds that line.

// Everything the writer was allowed to use as evidence, in full: the selected sources and the brand's
// official material (approved DNA, site).
export function evidencePack(packet) {
  return {
    brand: packet.brand,
    voice: packet.voice,
    brief: packet.brief,
    sources: (packet.sources || []).map((s) => ({ id: s.id, title: s.title, text: s.text })),
    brandKnowledge: (packet.brandKnowledge || []).map((k) => ({ id: k.id, title: k.title, text: k.text })),
  };
}

export const judgeInstruction = (what, extra = "") =>
  `Você é editor-chefe e avalia versões anônimas de ${what} para a marca do pacote. Julgue só o texto, comparando com as fontes e com o material oficial da marca (brandKnowledge), que o redator também pode usar como evidência sobre a própria marca. Para cada versão dê notas inteiras de 1 a 5: clareza, evidencia (fiel às fontes e ao material da marca, sem inventar), voz (soa como a marca descrita), utilidade (vale o tempo do público${extra}). Depois ordene todas da melhor para a pior e diga em uma frase o motivo do primeiro lugar. Retorne {scores:{A:{clareza,evidencia,voz,utilidade},B:{...}},ranking:string[],reason:string}.`;

// When every writer scores low on evidence for the same piece, the problem is the source or the method,
// not the models: the round stops for a person to look. Two judges far apart on many texts is flagged too.
export function briefAnomaly(scoresByVersion, { evidenceFloor = 2.5, disagreement = 2, disagreementShare = 0.5 } = {}) {
  const versions = Object.values(scoresByVersion).filter((v) => Object.keys(v).length);
  if (!versions.length) return null;
  const evidence = versions.flatMap((v) => Object.values(v).map((s) => s.evidencia)).filter(Number.isFinite);
  const avgEvidence = evidence.reduce((a, b) => a + b, 0) / evidence.length;
  if (avgEvidence < evidenceFloor)
    return { kind: "evidence", message: `Todos os redatores tiveram evidência média ${avgEvidence.toFixed(2)} nesta peça (abaixo de ${evidenceFloor}). Provável problema na fonte ou no que o juiz recebe, não nos modelos.` };
  const apart = versions.filter((v) => { const m = Object.values(v).map((s) => s.mean); return m.length >= 2 && Math.max(...m) - Math.min(...m) >= disagreement; }).length;
  if (apart / versions.length > disagreementShare)
    return { kind: "judges", message: `Os juízes discordaram em ${disagreement} pontos ou mais em ${apart} de ${versions.length} textos desta peça. Precisa de revisão humana.` };
  return null;
}

// The same automatic check failing for most writers on one piece points at the rule or the account (e.g. a
// brand with no other names registered), not at the models. Lesson of EXP-308 round 4: five of six writers
// "did not mention the brand" while saying "Esfera" aloud. Returns the suspect checks with how many failed.
export function sharedCheckFailures(writerItems, { share = 0.5, minWriters = 3 } = {}) {
  const done = writerItems.filter((i) => i.status === "done" && i.checks);
  if (done.length < minWriters) return [];
  const counts = new Map();
  for (const i of done) for (const issue of new Set(i.checks.issues || [])) counts.set(issue, (counts.get(issue) || 0) + 1);
  return [...counts].filter(([, n]) => n / done.length >= share).map(([issue, n]) => ({ issue, failed: n, of: done.length }));
}

// Free pre-flight of a judging pass: what each writer saw, what the judge will see, whether any text
// would be written again (a paid call), how many versions go to the judges and a rough cost.
// Prices per million tokens (input/output); judges answer with long reasoning, estimated per call.
const JUDGE_PRICE = { "x-ai/grok-4.7": [2, 6, 9000], "mistralai/mistral-large-4-0": [1.36, 4.18, 6000] };
export async function auditBrief({ store, runId, brief, packet, writers, judges }) {
  const items = new Map((await store.items(runId)).map((i) => [i.key, i]));
  const pack = evidencePack(packet);
  const writerIds = [...(packet.sources || []), ...(packet.brandKnowledge || [])].map((s) => s.id).sort();
  const judgeIds = [...pack.sources, ...pack.brandKnowledge].map((s) => s.id).sort();
  const parity = JSON.stringify(writerIds) === JSON.stringify(judgeIds) && [...packet.sources, ...(packet.brandKnowledge || [])].every((s) => [...pack.sources, ...pack.brandKnowledge].find((x) => x.id === s.id)?.text === s.text);
  const state = writers.map((w) => ({ w, item: items.get(`${runId}|${brief.id}|redator|${w}`) }));
  const toWrite = state.filter((x) => !x.item || (x.item.status === "failed" && false)).map((x) => x.w);
  const failed = state.filter((x) => x.item?.status === "failed").map((x) => x.w);
  const versions = state.filter((x) => x.item?.status === "done" && x.item.output?.body?.trim());
  const chars = JSON.stringify(pack).length + versions.reduce((n, x) => n + x.item.output.body.length + (x.item.output.title || "").length, 0);
  const tokens = Math.round(chars / 3.6);
  const cost = judges.reduce((s, j) => { const [i, o, out] = JUDGE_PRICE[j] || [2, 8, 6000]; return s + (tokens * i + out * o) / 1e6; }, 0);
  return {
    brief: brief.id, format: brief.format, sources: pack.sources.length, brandKnowledge: pack.brandKnowledge.length,
    brandNames: [packet.brand?.name, ...(packet.brand?.aliases || [])].filter(Boolean),
    parity, toWrite, failed, versions: versions.length, tokens, cost,
    suspectChecks: sharedCheckFailures(state.map((x) => x.item).filter(Boolean)),
  };
}
