// Which references a brand can use: its own, plus the group's shared library minus the shared
// references this brand removed from its view (they stay with their owner and the other brands).
export const visibleTo = (source, workspace) =>
  Boolean(source) && (source.workspace === workspace || (Boolean(source.shared) && !(source.hiddenIn || []).includes(workspace)));
