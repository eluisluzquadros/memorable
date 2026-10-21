// The cinematic landing is the home page; the classic one lives at #classica with its own anchors.
export const CLASSIC_HASHES = ["#classica", "#como-funciona", "#seu-time", "#modelos", "#main-content", "#landing-questions-title"];
export const isClassicHash = (hash) => CLASSIC_HASHES.some((h) => hash.startsWith(h));
