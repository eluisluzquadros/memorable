// Shared by the service and the team inbox: accepted ideas follow the content made from their reference.
export const SUGGESTION_STATUS = { received: "Recebida", accepted: "Aceita", production: "Em produção", published: "Publicada", declined: "Não seguiu" };
export function suggestionStatus(suggestion, pieces = []) {
  if (suggestion.status !== "accepted") return { label: SUGGESTION_STATUS[suggestion.status], link: null };
  const made = pieces.filter((p) => suggestion.sourceId && p.sourceIds?.includes(suggestion.sourceId));
  const published = made.find((p) => p.status === "Publicado");
  if (published) return { label: SUGGESTION_STATUS.published, link: published.liveUrl || null };
  return { label: made.length ? SUGGESTION_STATUS.production : SUGGESTION_STATUS.accepted, link: null };
}
