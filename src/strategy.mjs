import { assertEditor } from './operations.mjs';

export function saveCampaign(state, input) {
  assertEditor(state);
  for (const key of ['name', 'audience', 'problem', 'hypothesis', 'success'])
    if (!input[key]?.trim()) throw new Error('Preencha nome, público, problema, hipótese e critério de sucesso.');
  const previous = (state.campaigns || []).find(c => c.id === input.id);
  if (input.id && (!previous || previous.workspace !== state.workspace)) throw new Error('Campanha indisponível neste espaço.');
  const campaign = { ...input, id: previous?.id || crypto.randomUUID(), workspace: state.workspace, revision: (previous?.revision || 0) + 1, updatedAt: new Date().toISOString() };
  return { ...state, campaigns: [campaign, ...(state.campaigns || []).filter(c => c.id !== campaign.id)] };
}
export function relationships(state, input) {
  const campaign = input.campaignId ? (state.campaigns || []).find(c => c.id === input.campaignId && c.workspace === state.workspace) : null;
  if (input.campaignId && !campaign) throw new Error('A campanha precisa pertencer a este espaço.');
  const parent = input.parentId ? state.pieces.find(p => p.id === input.parentId && p.workspace === state.workspace) : null;
  if (input.parentId && !parent) throw new Error('O conteúdo principal precisa pertencer a este espaço.');
  if (parent && (parent.campaignId || '') !== (input.campaignId || '')) throw new Error('O desdobramento deve manter a campanha do conteúdo principal.');
  return { campaignId: campaign?.id || null, campaignRevision: campaign?.revision || null, campaignSnapshot: campaign ? { ...campaign } : null, parentId: parent?.id || null, parentRevision: parent?.revision || null };
}
export function affectedDescendants(pieces, id) {
  const root = pieces.find(p => p.id === id), ids = new Set();
  if (!root) return ids;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of pieces) if (p.workspace === root.workspace && p.id !== id && !ids.has(p.id) && (p.parentId === id || ids.has(p.parentId))) { ids.add(p.id); changed = true; }
  }
  return ids;
}
export function propagateChange(pieces, id) {
  const affected = affectedDescendants(pieces, id);
  return pieces.map(p => !affected.has(p.id) ? p : ({ ...p, lineageReview: true, lineageReason: 'O conteúdo de origem mudou. Confira este desdobramento.', council: null, approvedRevision: null, approver: null, scheduledAt: null, channel: null, status: p.status === 'Publicado' ? 'Publicado' : 'Em conferência' }));
}
export function confirmLineage(state, id) {
  assertEditor(state);
  const piece = state.pieces.find(p => p.id === id && p.workspace === state.workspace);
  const parent = state.pieces.find(p => p.id === piece?.parentId && p.workspace === state.workspace);
  if (!piece || !parent) throw new Error('Vínculo de origem indisponível.');
  if (parent.lineageReview) throw new Error('Confira primeiro o conteúdo de origem.');
  return { ...state, pieces: state.pieces.map(p => p.id !== id ? p : { ...p, parentRevision: parent.revision, lineageReview: false, lineageReason: null }), events: [{ id: crypto.randomUUID(), pieceId: id, workspace: state.workspace, title: piece.title, action: 'lineage-check', event: `Relação conferida com a versão ${parent.revision} de ${parent.title}.`, author: state.role, revision: piece.revision, at: new Date().toISOString() }, ...state.events] };
}
export function invalidateSourceDependents(pieces, sourceIds) {
  const roots = pieces.filter(p => p.sourceIds?.some(id => sourceIds.has(id)));
  let result = pieces.map(p => !roots.some(r => r.id === p.id) ? p : { ...p, council: null, approvedRevision: null, approver: null, scheduledAt: null, channel: null, status: p.status === 'Publicado' ? 'Publicado' : 'Em conferência', sourceReview: true, revision: p.revision + 1 });
  for (const root of roots) result = propagateChange(result, root.id);
  return result;
}
export function campaignMetrics(state, id) {
  const pieces = state.pieces.filter(p => p.workspace === state.workspace && p.campaignId === id);
  const ids = new Set(pieces.map(p => p.id));
  const rows = (state.outcomes || []).filter(r => r.workspace === state.workspace && ids.has(r.pieceId));
  return { pieces: pieces.length, measured: rows.length, conversations: rows.reduce((s,r) => s + Number(r.conversations || 0),0), reviewMinutes: rows.reduce((s,r) => s + Number(r.reviewMinutes || 0),0), cost: rows.reduce((s,r) => s + Number(r.actualCost || 0),0) };
}
