import { assertEditor, sourceValid } from "./operations.mjs";
import { visibleTo } from "./visibility.mjs";
export function queueIdea(state, title, sourceId, extra = {}) {
  assertEditor(state);
  const source = state.sources.find(
    (s) =>
      s.id === sourceId &&
      visibleTo(s, state.workspace) &&
      sourceValid(s),
  );
  if (!source) throw new Error("Escolha uma referência válida desta marca.");
  const queue = state.writingQueue || [],
    previous = queue.find(
      (q) =>
        q.workspace === state.workspace &&
        q.sourceId === sourceId &&
        (q.id === extra.queueId ||
          (q.topicId || null) === (extra.topicId || null)),
    );
  const item = {
    ...extra,
    id: previous?.id || crypto.randomUUID(),
    sourceId,
    title: title.trim(),
    origin: extra.origin || "source",
    workspace: state.workspace,
    selectedAt: new Date().toISOString(),
  };
  return {
    item,
    state: {
      ...state,
      writingQueue: [item, ...queue.filter((q) => q.id !== item.id)],
    },
  };
}
