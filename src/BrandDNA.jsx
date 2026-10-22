import React, { useState, useEffect, useRef, useContext } from "react";
import { AppContext } from "./context";

// Verbal DNA fields map one to one onto the voice sheet (Configurações > Ficha de voz).
const VERBAL = ["tone", "audience", "positioning", "pillars", "say", "avoid", "examples", "checklist"];
export function BrandDNA({ onVoice }) {
  const { state, setState, notify, workspace } = useContext(AppContext);
  const [url, setUrl] = useState(""),
    [documentation, setDocumentation] = useState("");
  const [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef(null),
    requestId = useRef(0);
  useEffect(() => {
    requestId.current++;
    controller.current?.abort();
    setDraft(null);
    setError("");
    setBusy(false);
    setUrl("");
    setDocumentation("");
    return () => {
      requestId.current++;
      controller.current?.abort();
    };
  }, [state.workspace]);
  const saved = state.brandDNA?.[state.workspace];
  const current = draft || saved;
  const admin = state.role === "Administrador";
  const edit = (key, value) =>
    setDraft({
      ...current,
      [key]: value,
      fieldEvidence: {
        ...current.fieldEvidence,
        [key]: {
          status: "edited",
          confidence: "validar",
          origin: "Equipe",
          evidence: "Valor ajustado manualmente pela equipe.",
        },
      },
    });
  async function extract(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    controller.current?.abort();
    const id = ++requestId.current,
      active = new AbortController();
    controller.current = active;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      active.abort();
    }, 75000);
    try {
      const response = await fetch("/api/brand-dna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), documentation, brandName: workspace?.name || "", roles: state.modelRoles || {} }),
        signal: active.signal,
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error(
          "O serviço de extração não respondeu corretamente. Verifique se a aplicação está conectada e tente novamente.",
        );
      }
      if (!response.ok)
        throw new Error(result.error || "Não foi possível ler o material.");
      if (!Array.isArray(result.colors) || !Array.isArray(result.sources))
        throw new Error(
          "O serviço retornou uma proposta incompleta. Tente a extração novamente.",
        );
      if (id === requestId.current) setDraft(result);
    } catch (e) {
      if (id === requestId.current && (e.name !== "AbortError" || timedOut))
        setError(
          timedOut
            ? "A leitura excedeu o tempo de espera. Tente novamente ou inclua a documentação da marca."
            : e instanceof TypeError
              ? "Não foi possível conectar ao serviço de extração. Tente novamente."
              : e.message,
        );
    } finally {
      clearTimeout(timer);
      if (id === requestId.current) setBusy(false);
    }
  }
  function cancel() {
    requestId.current++;
    controller.current?.abort();
    setBusy(false);
    setError(
      "Leitura cancelada. Você pode ajustar o endereço e tentar novamente.",
    );
  }
  function approve() {
    if (!admin || !draft) return;
    const approved = {
      ...draft,
      approvedAt: new Date().toISOString(),
      revision: (saved?.revision || 0) + 1,
    };
    setState((s) => ({
      ...s,
      brandDNA: { ...s.brandDNA, [state.workspace]: approved },
      voices: {
        ...s.voices,
        [state.workspace]: {
          ...s.voices[state.workspace],
          ...Object.fromEntries(
            VERBAL
              .filter((k) => approved[k]?.trim())
              .map((k) => [k, approved[k]]),
          ),
        },
      },
    }));
    onVoice(approved);
    setDraft(null);
    notify("DNA validado. Próximas criações usarão a identidade aprovada.");
  }
  return (
    <section className="r-panel dna-panel">
      <div className="dna-heading">
        <h2>Comece pelo que já é seu.</h2>
        <p>
          Seu site e sua documentação dão origem a uma ficha visual e verbal que
          a equipe pode conferir e ajustar.
        </p>
      </div>
      <form onSubmit={extract}>
        <fieldset disabled={!admin || busy}>
          <label>
            Site da marca
            <input
              aria-label="Site da marca"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://sua-marca.com.br"
            />
          </label>
          <label>
            Documentação da marca
            <textarea
              aria-label="Documentação da marca"
              rows={5}
              maxLength={80000}
              value={documentation}
              onChange={(e) => setDocumentation(e.target.value)}
              placeholder={
                "Cole seu manual, CSS ou briefing.\nTom de voz: claro e próximo\nEstética: editorial, com bastante espaço\nPaleta: #214cff, #172027\nFont-family: Sora"
              }
            />
          </label>
          <p className="field-help">
            Extraímos o texto e os estilos públicos do site. Se ele depender de
            JavaScript, tentamos uma leitura renderizada em navegador isolado.
            Você confere a proposta antes de aplicar.
          </p>
          <button
            className="button primary"
            disabled={!url && !documentation.trim()}
          >
            {busy ? "Lendo identidade…" : "Extrair proposta de DNA"}
          </button>
        </fieldset>
      </form>
      {busy && (
        <div className="dna-progress">
          <p role="status">
            Lendo o site, seus estilos e o conteúdo da marca. Sites dinâmicos
            podem levar até um minuto.
          </p>
          <button type="button" className="button secondary" onClick={cancel}>
            Cancelar leitura
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {current && (
        <div className="dna-result">
          <div className="dna-heading">
            <small>
              {draft
                ? "Proposta · aguarda a sua validação"
                : `DNA validado · versão ${saved.revision}`}
            </small>
            <h3>Uma identidade, decisões explícitas.</h3>
          </div>
          {current.quality && (
            <div
              className={`dna-quality ${current.quality.status === "partial" ? "is-partial" : ""}`}
            >
              <strong>
                {current.quality.status === "partial"
                  ? "Leitura parcial — confira os campos antes de aplicar."
                  : current.quality.method === "rendered"
                    ? "Página renderizada e lida."
                    : current.quality.method === "documentation"
                      ? "Documentação lida."
                      : "Página e estilos lidos."}
              </strong>
              <p>
                {current.quality.textCharacters.toLocaleString("pt-BR")}{" "}
                caracteres de texto · {current.quality.headings} títulos ·{" "}
                {current.fonts.length} famílias de fontes identificadas
              </p>
              <span>
                Cores e fontes vêm dos materiais. Voz, público e composição
                podem conter sugestões para sua revisão.
              </span>
            </div>
          )}
          <div className="dna-swatches">
            {current.colors.map((c) => (
              <div key={c.value}>
                <span style={{ backgroundColor: c.value }} />
                <b>{c.value}</b>
                <small>Encontrada no material</small>
                <details>
                  <summary>Ver evidência</summary>
                  <p>{c.origin}</p>
                  <code>{c.evidence}</code>
                </details>
              </div>
            ))}
          </div>
          {!current.colors.length && (
            <p>
              Nenhuma cor hexadecimal encontrada. Você pode definir a paleta
              abaixo.
            </p>
          )}
          <details>
            <summary>Fontes e materiais encontrados</summary>
            {current.fonts.map((f) => (
              <p key={f.value}>
                <b>{f.value}</b> · {f.origin}
              </p>
            ))}
            {!current.fonts.length && (
              <p>Nenhuma declaração de fonte encontrada.</p>
            )}
            {current.sources.map((s) => (
              <p key={s}>{s}</p>
            ))}
          </details>
          {current.excerpt && (
            <details>
              <summary>Texto extraído do site ou da documentação</summary>
              <div className="dna-excerpt">{current.excerpt}</div>
            </details>
          )}
          <fieldset disabled={!admin || busy}>
            <div className="r-two-columns">
              {[
                ["primary", "Cor principal"],
                ["secondary", "Cor secundária"],
                ["background", "Cor de fundo"],
                ["headingFont", "Fonte dos títulos"],
                ["bodyFont", "Fonte do texto"],
                ["aesthetic", "Estética e composição"],
                ["tone", "Tom de voz"],
                ["audience", "Público e dores"],
                ["positioning", "Posicionamento e ponto de vista"],
                ["pillars", "Pilares editoriais (um por linha)"],
                ["say", "O que dizemos / preferimos"],
                ["avoid", "Expressões que evitamos (uma por linha)"],
                ["examples", "Exemplos de escrita aprovados"],
                ["checklist", "Checklist de revisão (um por linha)"],
              ].map(([key, label]) => {
                const evidence = current.fieldEvidence?.[key];
                const Field = VERBAL.includes(key) || key === "aesthetic"
                  ? "textarea"
                  : "input";
                return (
                  <div className="dna-field" key={key}>
                    <label>
                      {label}
                      <Field
                        aria-label={label}
                        rows={["examples", "pillars", "avoid", "checklist", "say"].includes(key) ? 5 : 3}
                        value={current[key] || ""}
                        maxLength={4000}
                        onChange={(e) => edit(key, e.target.value)}
                        placeholder={
                          key.toLowerCase().includes("font")
                            ? "Escolha entre as fontes encontradas"
                            : "Não definido — preencher ou deixar vazio"
                        }
                      />
                    </label>
                    {evidence && (
                      <details>
                        <summary>
                          {evidence.status === "suggested"
                            ? "Sugestão para revisão"
                            : evidence.status === "edited"
                              ? "Ajustado pela equipe"
                              : "Encontrado no material"}{" "}
                          · ver evidência
                        </summary>
                        <p>{evidence.origin}</p>
                        <p>{evidence.evidence}</p>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="field-help">
              Escolher ou editar um campo registra uma decisão da equipe. Campos
              verbais vazios preservam a ficha de voz existente.
            </p>
            <button
              type="button"
              className="button primary"
              disabled={!draft}
              onClick={approve}
            >
              Validar e aplicar DNA
            </button>
            {draft && (
              <button
                type="button"
                className="button"
                onClick={() => setDraft(null)}
              >
                Descartar proposta
              </button>
            )}
          </fieldset>
          <details>
            <summary>Como esta extração funciona</summary>
            {current.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </details>
        </div>
      )}
    </section>
  );
}
