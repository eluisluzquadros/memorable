// Every LLM call is recorded: agent role, model, latency, tokens, cost and outcome.
// Benchmarks reuse the same table through a run tag.
import { openDb } from "./sql.mjs";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { catalogModel, estimateCost } from "../src/llm-catalog.mjs";

const ROLES = [
  [/Content Planner|Trend Hunter/i, "Planejador"],
  [/estrategista de marca/i, "DNA da marca"],
  [/bibliotecário de referências/i, "Leitura de referência"],
  [/compliance e de arquitetura de marca/i, "Coerência do grupo"],
  [/Revisor de refino/i, "Revisor (refino)"],
  [/aplicando as recomendações do revisor/i, "Redator (refino)"],
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
  [/juiz|avaliador cego/i, "Juiz cego"],
];
export const roleOf = (system) => ROLES.find(([pattern]) => pattern.test(system))?.[1] || "Outro";

const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

// context() may return { workspace } for the request being served, so spend can be read per brand.
export function createObservability(dir, { context = () => null } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const db = openDb(path.join(dir, "observability.sqlite"), `PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS llm_calls (id TEXT PRIMARY KEY, at TEXT, owner TEXT, route TEXT, role TEXT, provider TEXT, model TEXT,
      ms INTEGER, input_tokens INTEGER, output_tokens INTEGER, cost REAL, cost_source TEXT, ok INTEGER, error TEXT, run_tag TEXT);
    CREATE INDEX IF NOT EXISTS llm_calls_at ON llm_calls(at);`);
  // Installs created before the brand column get it on first start (Postgres has it from a migration).
  if (db.dialect === "sqlite") db.run("ALTER TABLE llm_calls ADD COLUMN workspace TEXT").catch(() => {});

  // Wraps a model function (system, data, observe) => object; the third argument receives usage.
  function instrument(model, { owner = null, route = "", provider = "server", runTag = null, workspace = undefined } = {}) {
    const name = model.modelName || "desconhecido";
    // A caller may also want the usage (the model lab stores it per output); it is passed through.
    const wrapped = async (system, data, observe) => {
      const started = performance.now();
      let usage = {};
      const brand = workspace !== undefined ? workspace : context()?.workspace ?? null;
      const record = (ok, error) => {
        const priced = usage.cost ?? estimateCost(catalogModel(name), usage.inputTokens, usage.outputTokens);
        // Recording never blocks or breaks the call it measures.
        db.run("INSERT INTO llm_calls (id, at, owner, route, role, provider, model, ms, input_tokens, output_tokens, cost, cost_source, ok, error, run_tag, workspace) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", randomUUID(), new Date().toISOString(), owner, route, roleOf(system), provider, name, Math.round(performance.now() - started),
          usage.inputTokens ?? null, usage.outputTokens ?? null, priced ?? null, usage.cost != null ? "provider" : priced != null ? "estimate" : null,
          ok ? 1 : 0, error ? String(error).slice(0, 300) : null, runTag, brand).catch((e) => console.error("Registro de custo falhou:", e.message));
      };
      try {
        const result = await model(system, data, (u) => { usage = { ...usage, ...u }; observe?.(u); });
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

  // Real spend of one account since a moment, in total and per brand.
  async function spend(owner, since) {
    const rows = await db.all("SELECT workspace, cost FROM llm_calls WHERE owner IS ? AND at >= ?", owner, since);
    const byWorkspace = {};
    for (const r of rows) byWorkspace[r.workspace || ""] = (byWorkspace[r.workspace || ""] || 0) + (r.cost || 0);
    return { total: rows.reduce((s, r) => s + (r.cost || 0), 0), calls: rows.length, byWorkspace };
  }
  // What one whole generation cost (plan or script, committee, writer, editor and rewrites), not one call.
  // Calls carry no request id, so a generation is read from the sequence of one account on one route: it
  // starts with the Planner or the Script writer (always the first step), or after 10 minutes of silence.
  // A generation that never reached the critical editor was an attempt that stopped (an error, a closed tab).
  async function generations({ since, route = "/api/squad" } = {}) {
    const rows = await db.all("SELECT owner, at, ms, role, model, cost, ok FROM llm_calls WHERE route = ? AND at >= ? ORDER BY owner, at", route, since);
    const list = [];
    let current = null;
    for (const r of rows) {
      const end = new Date(r.at).getTime(), start = end - (r.ms || 0);
      if (!current || current.owner !== r.owner || ["Planejador", "Roteirista"].includes(r.role) || start - current.end > 600000) {
        current = { owner: r.owner, start, end, cost: 0, calls: 0, models: {}, edited: false };
        list.push(current);
      }
      current.end = Math.max(current.end, end);
      current.cost += r.cost || 0;
      current.calls++;
      if (r.ok && r.role === "Editor crítico") current.edited = true;
      (current.models[r.role] ||= new Set()).add(r.model);
    }
    const pick = (g, roles) => [...new Set(roles.flatMap((role) => [...(g.models[role] || [])]))];
    return list.map((g) => ({
      at: new Date(g.start).toISOString(), cost: g.cost, calls: g.calls, seconds: Math.round((g.end - g.start) / 1000), complete: g.edited,
      writers: pick(g, ["Planejador", "Roteirista", "Redator"]), reviewers: pick(g, ["Comitê de roteiro", "Editor crítico"]),
    }));
  }
  async function summary({ owner = null, days = 30, runTag } = {}) {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const where = ["at >= ?"], params = [since];
    if (owner !== "*") { where.push("owner IS ?"); params.push(owner); }
    if (runTag) { where.push("run_tag = ?"); params.push(runTag); }
    const rows = await db.all(`SELECT * FROM llm_calls WHERE ${where.join(" AND ")} ORDER BY at DESC`, ...params);
    const group = (key) => Object.values(rows.reduce((acc, r) => {
      const k = r[key];
      const g = (acc[k] ||= { [key]: k, calls: 0, ok: 0, ms: [], inputTokens: 0, outputTokens: 0, cost: 0, estimated: false });
      g.calls++; g.ok += r.ok ? 1 : 0; g.ms.push(r.ms);
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
  // Everything recorded since a moment, split by where it came from (for the check against the provider's bill).
  async function recorded(since = "1970-01-01T00:00:00.000Z") {
    const rows = await db.all("SELECT route, owner, cost FROM llm_calls WHERE at >= ?", since);
    const sum = (f) => rows.filter(f).reduce((n, r) => n + (r.cost || 0), 0);
    return { lab: sum((r) => r.route === "lab"), accounts: sum((r) => r.route !== "lab" && r.owner), unowned: sum((r) => r.route !== "lab" && !r.owner), calls: rows.length };
  }
  return { instrument, summary, spend, generations, recorded, close: () => db.close() };
}
