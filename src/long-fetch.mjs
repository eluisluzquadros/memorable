// fetch() for requests that may take minutes (AI generation, reading files and sites).
// The service accepts the work at once (202 + task id) and the screen asks for the result every few
// seconds, so no proxy in between waits on an open connection. The caller gets an ordinary Response
// with the route's own status and JSON, as if the request had answered directly.
const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Solicitação cancelada.", "AbortError")); }, { once: true });
  });

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

async function runLong(url, init = {}, { onProgress, maxMinutes = 15 } = {}) {
  const headers = { ...(init.headers || {}), "X-Memoravel-Async": "1" };
  const first = await fetch(url, { ...init, headers });
  if (first.status !== 202) return first;
  const { task } = await first.json();
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    await wait(attempt < 3 ? 1500 : 3000, init.signal);
    const poll = await fetch(`/api/tasks/${task}`, { signal: init.signal });
    const body = await poll.json().catch(() => ({}));
    if (!poll.ok) return new Response(JSON.stringify(body), { status: poll.status, headers: { "Content-Type": "application/json" } });
    if (body.state === "done") return new Response(JSON.stringify(body.data), { status: body.status, headers: { "Content-Type": "application/json" } });
    onProgress?.(body.seconds);
    if (Date.now() - started > maxMinutes * 60000)
      return new Response(JSON.stringify({ error: "A geração passou do tempo esperado. Confira em alguns minutos ou tente de novo." }), { status: 504, headers: { "Content-Type": "application/json" } });
  }
}
