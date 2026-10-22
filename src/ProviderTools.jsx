import React, { useEffect, useRef, useState, useContext } from "react";
import { AppContext } from "./context";
import { assertEditor } from "./operations.mjs";
import { defaultTextModel, textProviderLabel } from "./text-providers.mjs";
export function ProviderTools({
  packet,
  variant,
  onGenerated,
  onCouncil,
  onBusy,
}) {
  const { state, notify } = useContext(AppContext);
  const [providers, setProviders] = useState([]);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState(defaultTextModel("anthropic"));
  const [connectionError, setConnectionError] = useState("");
  const [error, setError] = useState("");
  const ready = providers.includes(provider);
  const [busy, setBusy] = useState("");
  const controller = useRef(null);
  const alive = useRef(true);
  const currentContext = useRef("");
  currentContext.current = JSON.stringify({
    packet,
    variant,
    role: state.role,
  });
  useEffect(() => {
    alive.current = true;
    fetch("/api/text/status")
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
        }
      })
      .catch(() => {
        if (alive.current)
          setConnectionError(
            "Serviço de escrita indisponível. Confira se a plataforma local está iniciada.",
          );
      });
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  async function call(kind) {
    try {
      setError("");
      assertEditor(state);
      if (!packet.brief.title || !packet.sources.length)
        throw new Error("Preencha o briefing e escolha uma fonte.");
      if (kind === "squad" && !packet.brief.deadline)
        throw new Error("Defina um prazo antes de produzir.");
      if (!ready)
        throw new Error("Conecte um provedor de escrita em Configurações.");
      if (
        kind === "squad" &&
        state.pieces
          .filter((p) => p.workspace === state.workspace)
          .reduce((s, p) => s + p.cost, 0) +
          0.18 >
          state.budgets[state.workspace]
      )
        throw new Error("Teto estimado atingido nesta marca.");
      setBusy(kind);
      onBusy?.(true);
      const requestedContext = currentContext.current;
      controller.current = new AbortController();
      const r = await fetch("/api/" + kind, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.current.signal,
        body: JSON.stringify({
          packet,
          provider,
          model,
          variant,
          threshold: state.agentConfig.threshold,
          maxRounds: state.agentConfig.maxRounds,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      if (!alive.current) return;
      if (requestedContext !== currentContext.current)
        throw new Error(
          "O briefing ou a versão mudou durante a execução. O retorno não foi aplicado; execute novamente com o contexto atual.",
        );
      if (kind === "squad") onGenerated(data.versions);
      else onCouncil(data);
      notify(
        kind === "squad"
          ? "Pacote produzido pelo provedor de IA. Confira fontes e conteúdo."
          : "Refino concluído. Confira as notas e a síntese.",
      );
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
        {ready
          ? "Planejamento, redação e revisão editorial usam o contexto da sua marca e as referências escolhidas."
          : "Conecte Claude, OpenAI ou Gemini uma vez para os agentes escreverem o conteúdo. Escolher uma ideia não inicia a geração."}
      </p>
      {connectionError && (
        <p role="alert" className="form-error">
          {connectionError}
        </p>
      )}
      {!ready && (
        <a className="button primary" href="#app/configuracoes">
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
          A execução pode levar alguns minutos. Os resultados só aparecem após a
          resposta do provedor.
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
