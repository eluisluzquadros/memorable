import React, { useEffect, useRef, useState, useContext } from "react";
import { AppContext } from "./context";
import { assertEditor } from "./operations.mjs";
import { defaultTextModel, textProviderLabel } from "./text-providers.mjs";
import { longFetch, fetchWithRetry } from "./long-fetch.mjs";
import { startGeneration, pendingGeneration, finishGeneration } from "./pending-generation.mjs";
export function ProviderTools({
  packet,
  variant,
  onGenerated,
  onCouncil,
  onBusy,
}) {
  const { state, notify, brief, setBrief } = useContext(AppContext);
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState(defaultTextModel("anthropic"));
  // null while checking, "ok" once the service answered, "failed" when it could not be reached.
  const [check, setCheck] = useState(null);
  const [error, setError] = useState("");
  const ready = providers.includes(provider);
  const [busy, setBusy] = useState("");
  const controller = useRef(null);
  const alive = useRef(true);
  const currentContext = useRef("");
  const currentBrief = useRef(brief);
  currentBrief.current = brief;
  currentContext.current = JSON.stringify({
    packet,
    variant,
    role: state.role,
  });
  function loadStatus() {
    setCheck(null);
    fetchWithRetry("/api/text/status")
      .then((r) => {
        if (!r.ok) throw new Error("Serviço indisponível.");
        return r.json();
      })
      .then((d) => {
        if (alive.current) {
          setProviders(d.providers || []);
          setProvider((p) =>
            (d.providers || []).includes(p) ? p : d.providers?.[0] || "",
          );
          setModel(defaultTextModel(d.providers?.[0]));
          setCheck("ok");
        }
      })
      .catch(() => {
        if (alive.current) setCheck("failed");
      });
  }
  useEffect(() => {
    alive.current = true;
    loadStatus();
    return () => {
      alive.current = false;
      // A generation keeps running in the service; only a refinement in progress is dropped.
      controller.current?.abort();
    };
  }, []);
  // Coming back to this screen (or after a reload) picks up the generation still running for this brand.
  useEffect(() => {
    const job = pendingGeneration(state.workspace);
    if (job) follow(job);
  }, [state.workspace]);
  async function follow(job) {
    setBusy("squad");
    onBusy?.(true);
    setError("");
    const result = await job.promise;
    // Left the screen again: the result waits for the next visit.
    if (!alive.current || job.handled) return;
    job.handled = true;
    finishGeneration(job, result);
    onBusy?.(false);
    setBusy("");
    if (!result.ok || !Array.isArray(result.data.versions)) {
      const message = result.data.error || `A geração não foi concluída (HTTP ${result.status}).`;
      setError(message);
      notify(message, true);
      return;
    }
    // The versions answer the brief they were asked with; if the form changed (or the page reloaded), bring it back.
    if (JSON.stringify(job.brief) !== JSON.stringify(currentBrief.current))
      setBrief((b) => ({ ...job.brief, handoffKey: b.handoffKey }));
    onGenerated(result.data.versions.map((v) => ({ ...v, writer: job.writer })));
    notify(
      job.resumed
        ? "A geração que estava em andamento terminou. Confira fontes e conteúdo."
        : "Pacote produzido pelo provedor de IA. Confira fontes e conteúdo.",
    );
  }
  async function call(kind) {
    try {
      setError("");
      assertEditor(state);
      if (!packet.brief.title || !packet.sources.length)
        throw new Error("Preencha o briefing e escolha uma fonte.");
      if (kind === "squad" && !packet.brief.deadline)
        throw new Error("Defina um prazo antes de produzir.");
      if (!ready)
        throw new Error("Conecte um provedor de escrita em Configurações > Conexões.");
      if (
        kind === "squad" &&
        state.pieces
          .filter((p) => p.workspace === state.workspace)
          .reduce((s, p) => s + p.cost, 0) +
          0.18 >
          state.budgets[state.workspace]
      )
        throw new Error("Teto estimado atingido nesta marca.");
      const request = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packet,
          provider,
          // The text-model field belongs to connected providers; the service picks its own (by role) otherwise.
          model: provider === "server" ? undefined : model,
          variant,
          roles: state.modelRoles || {},
          threshold: state.agentConfig.threshold,
          maxRounds: state.agentConfig.maxRounds,
        }),
      };
      // The Media step later asks the same provider for the production plan of the chosen version.
      if (kind === "squad")
        return await follow(startGeneration(state.workspace, brief, "/api/squad", request, { provider, model: provider === "server" ? undefined : model }));
      setBusy(kind);
      onBusy?.(true);
      const requestedContext = currentContext.current;
      controller.current = new AbortController();
      const r = await longFetch("/api/" + kind, { ...request, signal: controller.current.signal });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (!alive.current) return;
      if (requestedContext !== currentContext.current)
        throw new Error(
          "O briefing ou a versão mudou durante a execução. O retorno não foi aplicado; execute novamente com o contexto atual.",
        );
      onCouncil(data);
      notify("Refino concluído. Confira as notas e a síntese.");
    } catch (e) {
      if (alive.current) {
        setError(
          e.name === "AbortError" ? "Solicitação cancelada." : e.message,
        );
        notify(
          e.name === "AbortError" ? "Solicitação cancelada." : e.message,
          true,
        );
      }
    } finally {
      onBusy?.(false);
      if (alive.current) setBusy("");
    }
  }
  return (
    <section className="r-provider" aria-label="Geração com IA">
      <h3>Gerar com IA</h3>
      <p>
        {ready || check !== "ok"
          ? "Planejamento, redação e revisão editorial usam o contexto da sua marca e as referências escolhidas."
          : "A IA da plataforma não está ativa neste serviço. Conecte Claude, OpenAI ou Gemini para os agentes escreverem o conteúdo."}
      </p>
      {check === null && !ready && <p role="status">Conferindo o serviço de escrita…</p>}
      {check === "failed" && (
        <p role="alert" className="form-error">
          Não foi possível falar com o serviço de escrita agora.{" "}
          <button type="button" className="text-button" onClick={loadStatus}>
            Tentar de novo
          </button>
        </p>
      )}
      {check === "ok" && !ready && (
        <a className="button primary" href="#app/configuracoes/conexoes">
          Conectar IA <span aria-hidden="true">→</span>
        </a>
      )}
      {providers.length > 0 && (
        <details>
          <summary>Provedor e modelo</summary>
          <div className="field-pair">
            <label>
              Provedor de escrita
              <select
                value={provider}
                disabled={!!busy}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setModel(defaultTextModel(e.target.value));
                }}
              >
                {providers.map((id) => (
                  <option value={id} key={id}>
                    {textProviderLabel(id)}
                  </option>
                ))}
              </select>
            </label>
            {provider !== "server" && (
              <label>
                Modelo de texto
                <input
                  value={model}
                  disabled={!!busy}
                  onChange={(e) => setModel(e.target.value)}
                  spellCheck={false}
                />
              </label>
            )}
          </div>
        </details>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="r-actions">
        {ready && (
          <button
            className="button primary"
            disabled={Boolean(busy)}
            onClick={() => call("squad")}
          >
            {busy === "squad"
              ? "Time produzindo…"
              : `Gerar ${packet.brief.versionCount || 1} ${(packet.brief.versionCount || 1) === 1 ? "versão" : "versões"} com IA`}
          </button>
        )}
        {variant && (
          <button
            className="button secondary"
            disabled={!ready || Boolean(busy)}
            onClick={() => call("council")}
          >
            {busy === "council" ? "Refinando…" : "Refinar com IA"}
          </button>
        )}
      </div>
      {busy && (
        <p role="status">
          A execução pode levar alguns minutos. Pode abrir outras telas: a
          geração continua e aparece aqui quando você voltar.
        </p>
      )}
      <p className="field-help">
        Endpoint, chave e modelo ficam no serviço, fora do navegador. Custos
        reais dependem do provedor e não estão incluídos nas estimativas da
        demo.
      </p>
    </section>
  );
}
