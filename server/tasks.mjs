import { randomUUID } from "node:crypto";

// Long AI requests (2–3 minutes) do not fit in one HTTP exchange behind Cloudflare, which closes the
// connection at 100 s. They run here in the background and the screen polls /api/tasks/<id>.
// The registry lives in memory: one service instance; a restart loses the running work and its result,
// and the screen says so.
export function createTasks({ keepMs = 30 * 60000, perOwner = 4 } = {}) {
  const tasks = new Map();
  const sweep = () => {
    const now = Date.now();
    for (const [id, task] of tasks) if (task.finishedAt && now - task.finishedAt > keepMs) tasks.delete(id);
  };
  setInterval(sweep, 60000).unref();
  return {
    // run() resolves to { status, data } exactly as the route would have answered.
    start(owner, route, run) {
      const running = [...tasks.values()].filter((t) => t.owner === owner && !t.finishedAt).length;
      if (running >= perOwner) {
        const error = new Error("Há gerações demais em andamento. Aguarde uma terminar e tente de novo.");
        error.status = 429;
        throw error;
      }
      const id = randomUUID();
      const task = { id, owner, route, startedAt: Date.now(), finishedAt: null, status: null, data: null };
      tasks.set(id, task);
      Promise.resolve()
        .then(run)
        .then(({ status, data }) => Object.assign(task, { status, data }))
        .catch((error) => Object.assign(task, { status: error.status || 500, data: { error: error.message } }))
        .finally(() => { task.finishedAt = Date.now(); });
      return id;
    },
    // Only whoever started the task can read it; an unknown id and someone else's look the same.
    get(id, owner) {
      const task = tasks.get(id);
      if (!task || task.owner !== owner) return null;
      return task.finishedAt
        ? { state: "done", status: task.status, data: task.data, seconds: Math.round((task.finishedAt - task.startedAt) / 1000) }
        : { state: "running", seconds: Math.round((Date.now() - task.startedAt) / 1000) };
    },
  };
}

// The route handlers read the body from the request stream and answer through res.writeHead/end.
// These stand-ins let the same handlers run after the real connection has already been answered.
export function bufferedRequest(req, body) {
  return {
    method: req.method,
    url: req.url,
    headers: { ...req.headers },
    socket: req.socket,
    async *[Symbol.asyncIterator]() { if (body.length) yield body; },
  };
}

export function capturedResponse() {
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const res = {
    statusCode: 200,
    headers: {},
    writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers || {}); return this; },
    setHeader(name, value) { this.headers[name] = value; },
    end(chunk) {
      const text = chunk ? chunk.toString() : "";
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
      resolve({ status: this.statusCode, data });
    },
  };
  return { res, done };
}
