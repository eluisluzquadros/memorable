// fetch() for requests that may take minutes (AI generation, reading files and sites).
// The service accepts the work at once (202 + task id) and the screen asks for the result every few
// seconds, so no proxy in between waits on an open connection. The caller gets an ordinary Response
// with the route's own status and JSON, as if the request had answered directly.
const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Solicitação cancelada.", "AbortError")); }, { once: true });
  });

export async function longFetch(url, init = {}, { onProgress, maxMinutes = 15 } = {}) {
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
