// fetch() for requests that may take minutes (AI generation, reading files and sites).
// The service accepts the work at once (202 + task id) and the screen asks for the result every few
// seconds, so no proxy in between waits on an open connection. The caller gets an ordinary Response
// with the route's own status and JSON, as if the request had answered directly.
// A generation makes dozens of requests while it runs; one of them failing on the way (a dropped
// connection, a proxy hiccup) must not throw away work the service is still doing and charging for.
const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Solicitação cancelada.", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Solicitação cancelada.", "AbortError")); }, { once: true });
  });

export const OFFLINE_MESSAGE = "Sem conexão com o serviço agora. Confira a internet e tente de novo.";
// fetch() rejects with a TypeError ("Failed to fetch") when the request never got an answer.
export const networkFailure = (error) => error?.name === "TypeError";
const transientStatus = (status) => status === 502 || status === 503 || status === 504;

// Short requests (sign out, status checks): a couple of quick retries on a lost connection.
export async function fetchWithRetry(url, init = {}, { attempts = 3, delayMs = 800 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, init);
      if (!transientStatus(response.status) || attempt >= attempts) return response;
    } catch (error) {
      if (!networkFailure(error)) throw error;
      if (attempt >= attempts) throw new Error(OFFLINE_MESSAGE);
    }
    await wait(delayMs * attempt, init.signal);
  }
}

// Over the account AI budget the service answers 402 with code "budget": the person decides whether
// this one generation goes ahead anyway.
export async function longFetch(url, init = {}, options = {}) {
  const response = await runLong(url, init, options);
  if (response.status !== 402 || typeof init.body !== "string") return response;
  const data = await response.clone().json().catch(() => ({}));
  if (data.code !== "budget" || typeof window === "undefined" || !window.confirm(`${data.error}

Gerar mesmo assim?`)) return response;
  return runLong(url, { ...init, body: JSON.stringify({ ...JSON.parse(init.body), confirmOverBudget: true }) }, options);
}

async function runLong(url, init = {}, options = {}) {
  // The task id travels with the request: resent after a lost answer, it joins the same generation.
  const task = globalThis.crypto?.randomUUID?.();
  const headers = { ...(init.headers || {}), "X-Memoravel-Async": "1", ...(task ? { "X-Memoravel-Task": task } : {}) };
  let first;
  for (let attempt = 1; ; attempt++) {
    try {
      first = await fetch(url, { ...init, headers });
      if (!(task && transientStatus(first.status) && attempt < 4)) break;
    } catch (error) {
      if (!networkFailure(error) || !task || attempt >= 4) throw networkFailure(error) ? new Error(OFFLINE_MESSAGE) : error;
    }
    await wait(1500 * attempt, init.signal);
  }
  if (first.status !== 202) return first;
  const { task: id } = await first.json();
  options.onTask?.(id);
  return pollTask(id, init.signal, options);
}

// Waits for a task already accepted by the service (also used to pick one up after a page reload).
export async function pollTask(task, signal, { onProgress, maxMinutes = 15, offlineMinutes = 2 } = {}) {
  const started = Date.now();
  let offlineSince = null;
  for (let attempt = 0; ; attempt++) {
    await wait(attempt < 3 ? 1500 : 3000, signal);
    let poll;
    try {
      poll = await fetch(`/api/tasks/${task}`, { signal });
      if (transientStatus(poll.status)) throw new TypeError("proxy");
      offlineSince = null;
    } catch (error) {
      if (!networkFailure(error)) throw error;
      offlineSince ??= Date.now();
      if (Date.now() - offlineSince > offlineMinutes * 60000)
        return new Response(JSON.stringify({ error: "A conexão com o serviço caiu durante a geração. Ela continua no servidor: volte a esta tela em alguns minutos para buscar o resultado.", pending: true }), { status: 503, headers: { "Content-Type": "application/json" } });
      continue;
    }
    const body = await poll.json().catch(() => ({}));
    if (!poll.ok) return new Response(JSON.stringify(body), { status: poll.status, headers: { "Content-Type": "application/json" } });
    if (body.state === "done") return new Response(JSON.stringify(body.data), { status: body.status, headers: { "Content-Type": "application/json" } });
    onProgress?.(body.seconds);
    if (Date.now() - started > maxMinutes * 60000)
      return new Response(JSON.stringify({ error: "A geração passou do tempo esperado. Confira em alguns minutos ou tente de novo." }), { status: 504, headers: { "Content-Type": "application/json" } });
  }
}
