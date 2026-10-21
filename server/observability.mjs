// Every LLM call is recorded: agent role, model, latency, tokens, cost and outcome.
// Benchmarks reuse the same table through a run tag.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { catalogModel, estimateCost } from "../src/llm-catalog.mjs";

const ROLES = [
  [/Content Planner|Trend Hunter/i, "Planejador"],
  [/Copywriter|Ghostwriter/i, "Redator"],
  [/Visual Creator|AV Producer|SEO/i, "Produção e SEO"],
  [/roteirista/i, "Roteirista"],
  [/editor crítico/i, "Editor crítico"],
  [/conselheiro/i, "Conselho"],
  [/pareceres anônimos/i, "Conselho (pares)"],
  [/Sintetize o conselho/i, "Conselho (síntese)"],
  [/Ajuste o conteúdo a partir do conselho/i, "Reescrita"],
  [/Revise o lote pela perspectiva/i, "Comitê de roteiro"],
  [/estrategista editorial/i, "Radar"],
  [/juiz|avaliador cego/i, "Juiz do benchmark"],
];
export const roleOf = (system) => ROLES.find(([pattern]) => pattern.test(system))?.[1] || "Outro";

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

export function createObservability(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "observability.sqlite"));
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS llm_calls (id TEXT PRIMARY KEY, at TEXT, owner TEXT, route TEXT, role TEXT, provider TEXT, model TEXT,
      ms INTEGER, input_tokens INTEGER, output_tokens INTEGER, cost REAL, cost_source TEXT, ok INTEGER, error TEXT, run_tag TEXT);
    CREATE INDEX IF NOT EXISTS llm_calls_at ON llm_calls(at);`);
  const insert = db.prepare("INSERT INTO llm_calls VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");

  // Wraps a model function (system, data, observe) => object; the third argument receives usage.
  function instrument(model, { owner = null, route = "", provider = "server", runTag = null } = {}) {
    const name = model.modelName || "desconhecido";
    const wrapped = async (system, data) => {
      const started = performance.now();
      let usage = {};
      const record = (ok, error) => {
        const priced = usage.cost ?? estimateCost(catalogModel(name), usage.inputTokens, usage.outputTokens);
        insert.run(randomUUID(), new Date().toISOString(), owner, route, roleOf(system), provider, name, Math.round(performance.now() - started),
          usage.inputTokens ?? null, usage.outputTokens ?? null, priced ?? null, usage.cost != null ? "provider" : priced != null ? "estimate" : null,
          ok ? 1 : 0, error ? String(error).slice(0, 300) : null, runTag);
      };
      try {
        const result = await model(system, data, (u) => { usage = { ...usage, ...u }; });
        record(true);
        return result;
      } catch (e) {
        record(false, e.message);
        throw e;
      }
    };
    wrapped.modelName = name;
    return wrapped;
  }

  function summary({ owner = null, days = 30, runTag } = {}) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const where = ["at >= ?"], params = [since];
    if (owner !== "*") { where.push("owner IS ?"); params.push(owner); }
    if (runTag) { where.push("run_tag = ?"); params.push(runTag); }
    const rows = db.prepare(`SELECT * FROM llm_calls WHERE ${where.join(" AND ")} ORDER BY at DESC`).all(...params);
    const group = (key) => Object.values(rows.reduce((acc, r) => {
      const k = r[key];
      const g = (acc[k] ||= { [key]: k, calls: 0, ok: 0, ms: [], inputTokens: 0, outputTokens: 0, cost: 0, estimated: false });
      g.calls++; g.ok += r.ok; g.ms.push(r.ms);
      g.inputTokens += r.input_tokens || 0; g.outputTokens += r.output_tokens || 0; g.cost += r.cost || 0;
      if (r.cost_source === "estimate") g.estimated = true;
      return acc;
    }, {})).map(({ ms, ...g }) => ({ ...g, successRate: g.ok / g.calls, p50: percentile(ms, 50), p95: percentile(ms, 95) }))
      .sort((a, b) => b.calls - a.calls);
    const ms = rows.map((r) => r.ms);
    return {
      totals: { calls: rows.length, ok: rows.filter((r) => r.ok).length, cost: rows.reduce((s, r) => s + (r.cost || 0), 0), p50: percentile(ms, 50) },
      byModel: group("model"),
      byRole: group("role"),
      recent: rows.slice(0, 40).map((r) => ({ at: r.at, role: r.role, model: r.model, ms: r.ms, inputTokens: r.input_tokens, outputTokens: r.output_tokens, cost: r.cost, ok: !!r.ok, error: r.error, route: r.route, runTag: r.run_tag })),
    };
  }
  return { instrument, summary, close: () => db.close() };
}
