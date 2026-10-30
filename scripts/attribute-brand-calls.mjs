// Attributes AI calls made before per-brand tracking (workspace NULL) to the brand of the piece they produced.
// Proof used, nothing guessed: a piece is saved moments after the last call of the generation that wrote it,
// by the same account, and the piece records its own brand. Only the generation that ends within
// WINDOW_S seconds before the piece's creation is attributed; every other unbranded call stays unbranded.
//   node --env-file=.env scripts/attribute-brand-calls.mjs           → dry run: shows what would change
//   node --env-file=.env scripts/attribute-brand-calls.mjs --apply   → writes workspace on those calls
// Undo: UPDATE memoravel.llm_calls SET workspace = NULL WHERE id IN (<ids printed by the run>).
process.env.MEMORAVEL_DB = "postgres";
const { openDb, closePool } = await import("../server/sql.mjs");
const WINDOW_S = 60;
const apply = process.argv.includes("--apply");
const pg = openDb();
const states = await pg.all("SELECT user_id, document FROM account_state");
const plan = [];
for (const { user_id: owner, document } of states) {
  const pieces = (JSON.parse(document).pieces || []).filter((p) => p.workspace && p.createdAt);
  if (!pieces.length) continue;
  const calls = await pg.all("SELECT id, at, ms, role, cost FROM llm_calls WHERE owner = ? AND route = '/api/squad' AND workspace IS NULL ORDER BY at", owner);
  // Split the unbranded calls into generations: a new one starts at the planner or script writer.
  const generations = [];
  for (const c of calls) {
    const end = new Date(c.at).getTime(), start = end - (c.ms || 0), last = generations.at(-1);
    if (!last || ["Planejador", "Roteirista"].includes(c.role) || start - last.end > 600000) generations.push({ start, end, calls: [] });
    const g = generations.at(-1);
    g.end = Math.max(g.end, end);
    g.calls.push(c);
  }
  for (const piece of pieces) {
    const created = new Date(piece.createdAt).getTime();
    const match = generations.filter((g) => created - g.end >= 0 && created - g.end <= WINDOW_S * 1000);
    if (match.length !== 1) { if (match.length > 1) console.log(`Ambíguo, ignorado: "${piece.title}" combina com ${match.length} gerações.`); continue; }
    plan.push({ owner, piece, generation: match[0], gap: Math.round((created - match[0].end) / 1000) });
  }
}
if (!plan.length) console.log("Nada a atribuir.");
for (const { owner, piece, generation, gap } of plan) {
  const usd = generation.calls.reduce((n, c) => n + (c.cost || 0), 0);
  console.log(`conta ${owner.slice(0, 8)} · "${piece.title}" (marca ${piece.workspace}) salva ${gap}s depois da última chamada de uma geração de ${generation.calls.length} chamadas, US$ ${usd.toFixed(4)}`);
  console.log("  ids:", generation.calls.map((c) => c.id).join(","));
  if (apply) for (const c of generation.calls) await pg.run("UPDATE llm_calls SET workspace = ? WHERE id = ? AND workspace IS NULL", piece.workspace, c.id);
}
console.log(apply ? "Gravado." : "Simulação: nada foi gravado. Rode com --apply para gravar.");
await closePool();
