// Model lab: benchmark rounds whose every paid answer is stored as it arrives (bench_items), so a
// rerun resumes instead of paying again, and whose results feed the quality × cost profiles.
import { openDb } from "./sql.mjs";

const SCHEMA = `PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS bench_runs (id TEXT PRIMARY KEY, experiment TEXT NOT NULL, title TEXT NOT NULL, task TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running', budget_usd REAL, spent_usd REAL NOT NULL DEFAULT 0, config TEXT NOT NULL DEFAULT '{}', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS bench_items (key TEXT PRIMARY KEY, run_id TEXT NOT NULL, brief_id TEXT, role TEXT NOT NULL, model TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'openrouter', output TEXT, checks TEXT, scores TEXT, mean REAL, cost_usd REAL, credits REAL, seconds REAL, input_tokens INTEGER, output_tokens INTEGER, status TEXT NOT NULL DEFAULT 'done', error TEXT, created_at TEXT NOT NULL);`;

// Quality floor agreed for the platform (docs/BENCHMARK_STRATEGY.md): a model is qualified for a
// task with a mean ≥ 4.0, no evidence score below 3, ≥ 90% of outputs passing the mechanical checks,
// over at least 3 judged outputs, and breaking the format in at most 10% of the attempts (approved
// 2026-10-29, after round 3: a model that fails every Reels must not qualify on its carousels alone).
export const FLOOR = { mean: 4.0, evidence: 3, checks: 0.9, minItems: 3, failures: 0.1 };
// "Balanced" = the cheapest qualified model within this distance of the best mean.
export const BALANCED_GAP = 0.25;

const parse = (v) => (v == null ? null : typeof v === "string" ? JSON.parse(v) : v);
const json = (v) => (v == null ? null : JSON.stringify(v));

export function createLabStore(filename) {
  const db = openDb(filename, SCHEMA);
  const runRow = (r) => r && { ...r, config: parse(r.config) || {}, budget_usd: r.budget_usd == null ? null : Number(r.budget_usd), spent_usd: Number(r.spent_usd || 0) };
  const itemRow = (r) => r && { ...r, output: parse(r.output), checks: parse(r.checks), scores: parse(r.scores), mean: r.mean == null ? null : Number(r.mean), cost_usd: r.cost_usd == null ? null : Number(r.cost_usd) };
  return {
    async saveRun(run) {
      const now = new Date().toISOString();
      await db.run(
        "INSERT INTO bench_runs (id, experiment, title, task, status, budget_usd, spent_usd, config, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, status=excluded.status, budget_usd=excluded.budget_usd, spent_usd=excluded.spent_usd, config=excluded.config, notes=excluded.notes, updated_at=excluded.updated_at",
        run.id, run.experiment, run.title, run.task, run.status || "running", run.budget_usd ?? null, run.spent_usd || 0, json(run.config || {}), run.notes || null, run.created_at || now, now,
      );
    },
    async run(id) { return runRow(await db.get("SELECT * FROM bench_runs WHERE id=?", id)); },
    async runs() { return (await db.all("SELECT * FROM bench_runs ORDER BY created_at DESC")).map(runRow); },
    async item(key) { return itemRow(await db.get("SELECT * FROM bench_items WHERE key=?", key)); },
    async items(runId) { return (await db.all("SELECT * FROM bench_items WHERE run_id=? ORDER BY created_at", runId)).map(itemRow); },
    async allItems() { return (await db.all("SELECT * FROM bench_items")).map(itemRow); },
    async saveItem(i) {
      await db.run(
        "INSERT INTO bench_items (key, run_id, brief_id, role, model, provider, output, checks, scores, mean, cost_usd, credits, seconds, input_tokens, output_tokens, status, error, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET output=excluded.output, checks=excluded.checks, scores=excluded.scores, mean=excluded.mean, cost_usd=excluded.cost_usd, credits=excluded.credits, seconds=excluded.seconds, input_tokens=excluded.input_tokens, output_tokens=excluded.output_tokens, status=excluded.status, error=excluded.error",
        i.key, i.run_id, i.brief_id || null, i.role, i.model, i.provider || "openrouter", json(i.output), json(i.checks), json(i.scores), i.mean ?? null, i.cost_usd ?? null, i.credits ?? null, i.seconds ?? null, i.input_tokens ?? null, i.output_tokens ?? null, i.status || "done", i.error || null, i.created_at || new Date().toISOString(),
      );
    },
    close: () => db.close(),
  };
}

// A round: call() returns the stored answer when it exists and only pays for what is missing.
// The budget counts what this round already spent, including earlier attempts.
// retryFailed=false keeps a model's own failure as data instead of giving it another try (fairness:
// a retry would hide how often that model breaks the format).
// Network drops, rate limits and timeouts say nothing about the model: they are always tried again. A model's
// own failure (broken JSON, missing fields) is a result and stays recorded when retryFailed is off.
export const transientError = (message = "") => /ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|terminated|socket hang up|limitou as requisições|tempo esgotado|timed? ?out|\b(429|502|503|504)\b/i.test(String(message));

export async function startRound(store, run, { log = console.log, retryFailed = true } = {}) {
  const existing = await store.run(run.id);
  // The stored configuration is kept and the new one merged over it: decisions recorded on the round
  // (briefs out of the totals, briefs under review) must survive every rerun.
  const state = { ...existing, ...run, config: { ...(existing?.config || {}), ...(run.config || {}) }, spent_usd: existing?.spent_usd || 0, status: "running" };
  await store.saveRun(state);
  const save = () => store.saveRun(state);
  return {
    get spent() { return state.spent_usd; },
    async call({ key, role, model, briefId, provider = "openrouter", invoke }) {
      const fullKey = `${run.id}|${key}`;
      const stored = await store.item(fullKey);
      if (stored?.status === "done") { log(`  ${role.padEnd(8)} ${model.padEnd(32)} (já salvo)`); return stored; }
      // A judge that timed out is a transient problem and is asked again; a writer failure is data.
      if (stored?.status === "failed" && !retryFailed && role !== "juiz" && !transientError(stored.error)) { log(`  ${role.padEnd(8)} ${model.padEnd(32)} (falha registrada, mantida)`); return null; }
      if (state.budget_usd != null && state.spent_usd >= state.budget_usd) {
        state.status = "paused"; await save();
        throw Object.assign(new Error(`Teto de US$ ${state.budget_usd} da rodada atingido antes de ${role} (${model}). Nada foi perdido: a rodada retoma daqui.`), { budget: true });
      }
      const started = performance.now();
      let usage = {};
      try {
        const output = await invoke((u) => { usage = { ...usage, ...u }; });
        const item = { key: fullKey, run_id: run.id, brief_id: briefId, role, model, provider, output, cost_usd: usage.cost ?? null, credits: usage.credits ?? null, seconds: Math.round((performance.now() - started) / 100) / 10, input_tokens: usage.inputTokens ?? null, output_tokens: usage.outputTokens ?? null, status: "done" };
        await store.saveItem(item);
        state.spent_usd = Math.round((state.spent_usd + (item.cost_usd || 0)) * 1e6) / 1e6;
        await save();
        log(`  ${role.padEnd(8)} ${model.padEnd(32)} ${String(item.seconds).padStart(6)} s  US$ ${(item.cost_usd ?? 0).toFixed(4)}  (rodada US$ ${state.spent_usd.toFixed(3)})`);
        return item;
      } catch (error) {
        // A failed call is recorded (so the dashboard shows it) and retried on the next run.
        await store.saveItem({ key: fullKey, run_id: run.id, brief_id: briefId, role, model, provider, status: "failed", error: String(error.message).slice(0, 500), cost_usd: usage.cost ?? null, seconds: Math.round((performance.now() - started) / 100) / 10 });
        state.spent_usd = Math.round((state.spent_usd + (usage.cost || 0)) * 1e6) / 1e6;
        await save();
        log(`  ${role.padEnd(8)} ${model.padEnd(32)} FALHOU: ${String(error.message).slice(0, 110)}`);
        return null;
      }
    },
    async update(key, fields) {
      const item = await store.item(`${run.id}|${key}`);
      if (item) await store.saveItem({ ...item, ...fields });
    },
    async finish(status = "done", notes) { state.status = status; if (notes) state.notes = notes; await save(); },
  };
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Per task and model: judged outputs, mean score, cost, speed and how often the checks pass; then the
// three profiles the platform offers. Only scored outputs count toward quality.
function summarize(items, runs, floor = FLOOR) {
  // A round superseded by a later one (same texts, other judges) stays in the history, out of the totals.
  const taskOf = new Map(runs.filter((r) => r.config?.summary !== false).map((r) => [r.id, r.task]));
  const groups = new Map();
  for (const i of items) {
    if (i.role === "plano" || i.role === "juiz" || !taskOf.has(i.run_id)) continue;
    const task = taskOf.get(i.run_id) || i.role;
    const k = `${task}|${i.model}`;
    if (!groups.has(k)) groups.set(k, { task, model: i.model, items: [] });
    groups.get(k).items.push(i);
  }
  const models = [...groups.values()].map(({ task, model, items: list }) => {
    const done = list.filter((i) => i.status === "done");
    const scored = done.filter((i) => Number.isFinite(i.mean));
    const evidence = scored.flatMap((i) => Object.values(i.scores || {}).map((s) => s?.scores?.evidencia ?? s?.evidencia)).filter(Number.isFinite);
    const checksPass = done.filter((i) => i.checks).length ? done.filter((i) => i.checks?.ok).length / done.filter((i) => i.checks).length : null;
    const seconds = done.map((i) => i.seconds).filter(Number.isFinite).sort((a, b) => a - b);
    const row = {
      task, model, outputs: list.length, judged: scored.length, failures: list.length - done.length,
      mean: avg(scored.map((i) => i.mean)), minEvidence: evidence.length ? Math.min(...evidence) : null,
      cost: avg(done.map((i) => i.cost_usd).filter(Number.isFinite)), p50: seconds.length ? seconds[Math.floor(seconds.length / 2)] : null,
      checksPass, runs: [...new Set(list.map((i) => i.run_id))],
    };
    row.failureRate = list.length ? (list.length - done.length) / list.length : 0;
    row.qualified = row.failureRate <= floor.failures && row.judged >= floor.minItems && row.mean >= floor.mean && (row.minEvidence == null || row.minEvidence >= floor.evidence) && (row.checksPass == null || row.checksPass >= floor.checks);
    // The reason is written for the person deciding, not for the engineer: what failed, how often, what it means.
    const n = (v, d = 2) => v.toFixed(d).replace(".", ",");
    const weakEvidence = scored.filter((i) => Object.values(i.scores || {}).some((s) => (s?.scores?.evidencia ?? s?.evidencia) < floor.evidence)).length;
    const failedChecks = done.filter((i) => i.checks && !i.checks.ok).length;
    row.why = row.qualified ? ""
      : row.failureRate > floor.failures ? `Quebrou o formato em ${list.length - done.length} de ${list.length} tentativas (roteiro incompleto ou fonte inexistente). O piso aceita no máximo ${Math.round(floor.failures * 100)}%.`
      : row.judged < floor.minItems ? `Ainda não dá para julgar: só ${row.judged} de ${floor.minItems} textos avaliados.`
      : row.mean < floor.mean ? `Nota média ${n(row.mean)}, abaixo do piso de ${n(floor.mean, 1)}.`
      : row.minEvidence < floor.evidence ? `Em ${weakEvidence} de ${row.judged} textos, um juiz deu ${row.minEvidence} de 5 em evidência: o texto afirma algo que a fonte não sustenta. O piso exige pelo menos ${floor.evidence} em todos.`
      : `A checagem automática reprovou ${failedChecks} de ${done.length} textos (fonte, citação literal ou ligação com a marca). O piso exige ${Math.round(floor.checks * 100)}% aprovados.`;
    return row;
  });
  const tasks = [...new Set(models.map((m) => m.task))];
  const profiles = Object.fromEntries(tasks.map((task) => {
    const ok = models.filter((m) => m.task === task && m.qualified && Number.isFinite(m.cost));
    if (!ok.length) return [task, null];
    const best = Math.max(...ok.map((m) => m.mean));
    const cheapest = (list) => [...list].sort((a, b) => a.cost - b.cost)[0];
    return [task, {
      essencial: cheapest(ok).model,
      equilibrado: cheapest(ok.filter((m) => m.mean >= best - BALANCED_GAP)).model,
      excelencia: [...ok].sort((a, b) => b.mean - a.mean || a.cost - b.cost)[0].model,
    }];
  }));
  return { floor, balancedGap: BALANCED_GAP, models, profiles };
}

// The overall view and one view per content type (LinkedIn, Carrossel, Reels…): the best writer can change
// with the format, so each format gets its own ranking and profiles. Briefs a round marks as excluded
// (e.g. a source of another brand) stay in the history and out of every total.
// Which items count in the totals (briefs excluded or under review stay in the history only) and the
// content type of each item.
function scope(items, runs) {
  const formatOf = new Map(), excluded = [];
  for (const r of runs) {
    for (const b of r.config?.briefs || []) formatOf.set(`${r.id}|${b.id}`, b.format);
    for (const e of r.config?.excludedBriefs || []) excluded.push({ run: r.id, ...e });
    for (const e of r.config?.flaggedBriefs || []) excluded.push({ run: r.id, ...e, reason: `Em revisão: ${e.reason}` });
  }
  const out = new Set(excluded.map((e) => `${e.run}|${e.id}`));
  const counted = new Set(runs.filter((r) => r.config?.summary !== false).map((r) => r.id));
  return {
    excluded,
    kept: items.filter((i) => !out.has(`${i.run_id}|${i.brief_id}`)),
    counts: (i) => counted.has(i.run_id) && !out.has(`${i.run_id}|${i.brief_id}`),
    format: (i) => formatOf.get(`${i.run_id}|${i.brief_id}`) || "Outros",
  };
}

// What the benchmark itself cost and reached, overall and per content type. Spending counts every paid call
// (plans, writers, judges), including pieces later left out of the totals: that money was spent. Quality,
// cost per text and speed count only the texts in the ranking, so they agree with it.
export function labStats(items, runs) {
  const { counts, format } = scope(items, runs);
  const median = (xs) => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  // A text a later round reused from an earlier one (checks.reusedFrom) keeps its cost for cost per text,
  // but that money was paid once: it counts in the round that produced it.
  const paid = (i) => !i.checks?.reusedFrom;
  const stat = (list) => {
    const texts = list.filter((i) => i.role === "redator" && counts(i));
    const done = texts.filter((i) => i.status === "done");
    const judged = done.filter((i) => Number.isFinite(i.mean));
    return {
      spent: list.filter(paid).reduce((n, i) => n + (Number.isFinite(i.cost_usd) ? i.cost_usd : 0), 0),
      calls: list.filter((i) => i.status === "done" && paid(i)).length,
      texts: texts.length, judged: judged.length, failures: texts.length - done.length,
      judgeCalls: list.filter((i) => i.role === "juiz" && i.status === "done").length,
      mean: avg(judged.map((i) => i.mean)),
      costPerText: avg(done.map((i) => i.cost_usd).filter(Number.isFinite)),
      p50: median(done.map((i) => i.seconds)),
      writers: new Set(done.map((i) => i.model)).size,
    };
  };
  const formats = [...new Set(items.filter((i) => i.role === "redator").map(format))];
  // Each round also adds up every call it paid for, including attempts that were retried and replaced and
  // plans kept outside the items: the overall spend is that sum, which is what the provider charged.
  const overall = stat(items);
  const charged = runs.reduce((n, r) => n + (Number(r.spent_usd) || 0), 0);
  if (charged > overall.spent) Object.assign(overall, { unassigned: charged - overall.spent, spent: charged });
  return { overall, byFormat: Object.fromEntries(formats.map((f) => [f, stat(items.filter((i) => format(i) === f))])) };
}

export function labSummary(items, runs, floor = FLOOR) {
  const { excluded, kept, format } = scope(items, runs);
  const formats = [...new Set(kept.filter((i) => i.role !== "plano" && i.role !== "juiz").map(format))];
  return {
    ...summarize(kept, runs, floor),
    excluded,
    formats,
    byFormat: Object.fromEntries(formats.map((fmt) => [fmt, summarize(kept.filter((i) => format(i) === fmt), runs, floor)])),
  };
}

// What the platform team sees: every round with its texts, the totals and what the benchmark cost.
// The benchmark is internal to Memorável (calibration, pricing, investors): the route that serves this
// view is open only to platform administrators, so nothing here is trimmed for other readers.
export function labView(items, runs) {
  const summary = labSummary(items, runs);
  const outputs = (id) => items.filter((i) => i.run_id === id).length;
  return {
    runs: runs.map((r) => ({ ...r, outputs: outputs(r.id), open: true })),
    summary: { ...summary, excludedCount: summary.excluded.length },
    stats: labStats(items, runs),
  };
}

// Whole generations on the platform grouped by the models that ran them (writer side | review side):
// what a content costs end to end, next to the writer-only cost the benchmark measures. Attempts that
// stopped before the editor are counted apart (real spend, no content).
export function generationSetups(list = []) {
  const median = (xs) => { const v = [...xs].sort((a, b) => a - b), m = Math.floor(v.length / 2); return !v.length ? null : v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const groups = new Map();
  for (const g of list.filter((g) => g.complete)) {
    const key = `${g.writers.join(" + ")}|${g.reviewers.join(" + ")}`;
    const group = groups.get(key) || { writers: g.writers, reviewers: g.reviewers, costs: [], seconds: [], last: g.at };
    group.costs.push(g.cost); group.seconds.push(g.seconds);
    if (g.at > group.last) group.last = g.at;
    groups.set(key, group);
  }
  const stopped = list.filter((g) => !g.complete);
  return {
    setups: [...groups.values()].map(({ costs, seconds, last, ...g }) => ({ ...g, count: costs.length, medianCost: median(costs), minCost: Math.min(...costs), maxCost: Math.max(...costs), medianSeconds: median(seconds), lastDay: last.slice(0, 10) }))
      .sort((a, b) => b.lastDay.localeCompare(a.lastDay) || b.count - a.count),
    attempts: { count: stopped.length, cost: stopped.reduce((n, g) => n + g.cost, 0) },
  };
}

// The platform's records against what OpenRouter charged the key: the benchmark counts what each round paid,
// the rest is every recorded call of the accounts and of reads without an account. What is left was charged
// without a detailed record (scripts that called the models directly before the record existed, the local
// app, which keeps its own record on the developer's machine).
export function billCheck(usage, runs, all) {
  if (!usage || !Number.isFinite(usage.total)) return null;
  const benchmark = runs.reduce((n, r) => n + (Number(r.spent_usd) || 0), 0);
  const recorded = benchmark + all.accounts + all.unowned;
  return {
    charged: usage.total, benchmark, accounts: all.accounts, unowned: all.unowned, recorded,
    unrecorded: Math.max(0, usage.total - recorded),
    checkedAt: usage.checkedAt,
  };
}
