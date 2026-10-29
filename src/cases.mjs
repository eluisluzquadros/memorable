// A case packages finished work for a prospect or investor: the challenge, the sources,
// the approved pieces and only the results someone registered with evidence.
import { assertEditor } from "./operations.mjs";

export const CASE_READY = ["Aprovado", "Agendado", "Publicado"];

export function eligiblePieces(state) {
  return state.pieces.filter((p) => p.workspace === state.workspace && CASE_READY.includes(p.status));
}

export function saveCase(state, input) {
  assertEditor(state);
  const title = String(input.title || "").trim();
  const challenge = String(input.challenge || "").trim();
  if (!title) throw new Error("Dê um título ao case.");
  if (challenge.length < 20) throw new Error("Descreva o desafio do cliente em pelo menos uma frase.");
  const ids = [...new Set(input.pieceIds || [])];
  if (!ids.length) throw new Error("Escolha ao menos um conteúdo aprovado.");
  const ready = new Set(eligiblePieces(state).map((p) => p.id));
  if (ids.some((id) => !ready.has(id))) throw new Error("Um case só reúne conteúdos aprovados, agendados ou publicados desta marca.");
  const existing = input.id && (state.cases || []).find((c) => c.id === input.id && c.workspace === state.workspace);
  if (input.id && !existing) throw new Error("Case não encontrado nesta marca.");
  const item = {
    id: existing?.id || crypto.randomUUID(),
    workspace: state.workspace,
    title,
    challenge,
    approach: String(input.approach || "").trim(),
    pieceIds: ids,
    published: !!input.published,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { ...state, cases: [item, ...(state.cases || []).filter((c) => c.id !== item.id)] };
}

export function removeCase(state, id) {
  assertEditor(state);
  return { ...state, cases: (state.cases || []).filter((c) => !(c.id === id && c.workspace === state.workspace)) };
}

// Everything shown in a case is derived from the operation, never typed as a claim.
export function caseStory(state, item) {
  const pieces = item.pieceIds.map((id) => state.pieces.find((p) => p.id === id)).filter(Boolean);
  const sourceIds = [...new Set(pieces.flatMap((p) => p.sourceIds || []))];
  const sources = sourceIds.map((id) => state.sources.find((s) => s.id === id)).filter(Boolean);
  const outcomes = (state.outcomes || []).filter((o) => item.pieceIds.includes(o.pieceId));
  const evidenced = outcomes.filter((o) => String(o.evidence || "").trim());
  const sum = (key) => evidenced.reduce((n, o) => n + (Number(o[key]) || 0), 0);
  return {
    pieces,
    sources,
    formats: [...new Set(pieces.map((p) => p.format))],
    approvals: pieces.filter((p) => p.approver).map((p) => ({ title: p.title, approver: p.approver, revision: p.approvedRevision })),
    outcomes: evidenced,
    totals: evidenced.length ? { views: sum("views"), clicks: sum("clicks"), conversations: sum("conversations"), reviewMinutes: sum("reviewMinutes") } : null,
    learnings: evidenced.map((o) => o.learning).filter((l) => String(l || "").trim()),
    stale: item.pieceIds.length !== pieces.length || pieces.some((p) => !CASE_READY.includes(p.status)),
  };
}

const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// A self-contained one-pager to send to a prospect; numbers appear only with registered evidence.
export function caseDocument(state, item, brandName) {
  const story = caseStory(state, item);
  const excerpt = (body) => escape(String(body || "").slice(0, 600)).replace(/\n/g, "<br>");
  const totals = story.totals
    ? `<ul class="t">${[["Visualizações", story.totals.views], ["Cliques", story.totals.clicks], ["Conversas", story.totals.conversations], ["Minutos de revisão", story.totals.reviewMinutes]].filter(([, v]) => v).map(([k, v]) => `<li><b>${v.toLocaleString("pt-BR")}</b>${k}</li>`).join("")}</ul><p class="n">Resultados registrados manualmente pela equipe, com evidência anexada na plataforma.</p>`
    : `<p class="n">Resultados ainda não registrados com evidência.</p>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(item.title)} · Case Memorável</title><style>
body{margin:0;background:#08090c;color:#f4efe6;font:16px/1.55 system-ui,sans-serif}main{max-width:860px;margin:auto;padding:56px 24px}
h1{font-size:44px;line-height:1.05;margin:8px 0 16px}h2{font-size:14px;letter-spacing:.12em;text-transform:uppercase;color:#d9c6a3;margin:40px 0 12px}
.b{color:#ff7a1a;font-weight:700}.p{border:1px solid #2a2b30;border-radius:14px;padding:18px 20px;margin:12px 0;background:#111318}.p small{color:#b3aca2}
.t{display:flex;flex-wrap:wrap;gap:24px;list-style:none;padding:0}.t b{display:block;font-size:34px;color:#ff7a1a}.n{color:#b3aca2;font-size:14px}footer{margin-top:48px;color:#b3aca2;font-size:13px}
</style></head><body><main><div class="b">${escape(brandName)}</div><h1>${escape(item.title)}</h1><p>${escape(item.challenge)}</p>
${item.approach ? `<h2>Como fizemos</h2><p>${escape(item.approach)}</p>` : ""}
<h2>Fontes de origem</h2>${story.sources.map((s) => `<div class="p"><b>${escape(s.title)}</b><br><small>${escape(s.origin)}</small></div>`).join("") || "<p class='n'>Sem fontes registradas.</p>"}
<h2>Conteúdos produzidos · ${escape(story.formats.join(", "))}</h2>${story.pieces.map((p) => `<div class="p"><small>${escape(p.format)} · ${escape(p.status)}${p.approver ? ` · aprovada por ${escape(p.approver)} (v${escape(p.approvedRevision)})` : ""}</small><h3>${escape(p.title)}</h3><p>${excerpt(p.body)}</p></div>`).join("")}
<h2>Resultados</h2>${totals}${story.learnings.length ? `<h2>Aprendizados</h2><ul>${story.learnings.map((l) => `<li>${escape(l)}</li>`).join("")}</ul>` : ""}
<footer>Produzido com a Memorável · fluxo com revisão humana e fontes rastreáveis.</footer></main></body></html>`;
}
