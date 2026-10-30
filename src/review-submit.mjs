import { runCouncil } from "./operations.mjs";
import { transition } from "./workflow.mjs";

// One step for "send to review": the piece is checked again with the current rules (its text, its sources and the
// brand's other names may have changed since the last check) and, if it passes, goes to human review. A piece that
// does not pass stays where it is with the new check attached, so the person sees exactly what to fix.
export function submitForReview(state, id) {
  const piece = state.pieces.find((p) => p.id === id);
  if (!piece) throw new Error("Conteúdo não encontrado.");
  const reviewed = runCouncil(state, piece);
  const checked = { ...state, pieces: state.pieces.map((p) => (p.id === id ? reviewed.piece : p)) };
  if (!reviewed.piece.council.passed) return { state: checked, passed: false, council: reviewed.piece.council };
  return { state: transition(checked, id, "review"), passed: true, council: reviewed.piece.council };
}
