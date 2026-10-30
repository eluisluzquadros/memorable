import { longFetch, pollTask } from "./long-fetch.mjs";

// A generation keeps going while the person opens other screens, switches tabs or the page reloads:
// the service runs it as a task, and here the screen remembers which task belongs to which brand and
// brief (in memory, and in sessionStorage for a reload) so the result is picked up on the way back
// instead of being paid for and lost. One generation per browser tab at a time.
const KEY = "memoravel-generation";
const KEEP_MS = 30 * 60000; // the service keeps a finished task this long
let current = null;

const saved = {
  read() { try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch { return null; } },
  write(value) { try { value ? sessionStorage.setItem(KEY, JSON.stringify(value)) : sessionStorage.removeItem(KEY); } catch { /* private mode: memory only */ } },
};
// The promise never rejects: a request that got no answer at all reads like any other failed result.
const settle = (request) => request.then(
  (response) => response.json().catch(() => ({})).then((data) => ({ ok: response.ok, status: response.status, data })),
  (error) => ({ ok: false, status: 0, data: { error: error.message } }),
);

export function startGeneration(workspace, brief, url, init, writer = null) {
  const job = { workspace, brief, writer, startedAt: Date.now() };
  job.promise = settle(longFetch(url, init, { onTask: (task) => saved.write({ task, workspace, brief, writer, startedAt: job.startedAt }) }));
  current = job;
  return job;
}

// The generation running (or finished, not yet shown) for this brand, if any.
export function pendingGeneration(workspace) {
  if (current) return current.workspace === workspace ? current : null;
  const stored = saved.read();
  if (!stored?.task || stored.workspace !== workspace || Date.now() - stored.startedAt > KEEP_MS) return null;
  current = { workspace, brief: stored.brief, writer: stored.writer || null, startedAt: stored.startedAt, resumed: true, promise: settle(pollTask(stored.task)) };
  return current;
}

// Called once the result was shown (or failed for good). A lost connection keeps the task on record,
// so the next visit asks the service again.
export function finishGeneration(job, result) {
  if (current === job) current = null;
  if (!result?.data?.pending) saved.write(null);
}
