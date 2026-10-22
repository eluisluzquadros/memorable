import React, { useContext, useEffect, useState } from "react";
import { Check, X, ExternalLink, UserPlus } from "lucide-react";
import { AppContext } from "./context";
import { RequestForm } from "./Continuity";
import { queueIdea } from "./writing-queue.mjs";
import { suggestionStatus } from "./suggestion-status.mjs";

async function api(url, body) {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Serviço local indisponível.");
  return data;
}
const day = (d) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

// The contributor's own words become an internal reference: citable by the team, never presented as public.
export function suggestionSource(s) {
  return {
    id: crypto.randomUUID(),
    workspace: s.workspace,
    title: s.title,
    url: s.referenceUrl || "",
    type: "Texto",
    text: [s.why, s.referenceText].filter(Boolean).join("\n\n"),
    summary: s.why.slice(0, 280),
    origin: `Sugestão interna · ${s.author.name}${s.author.area ? ` · ${s.author.area}` : ""}`,
    citable: true,
    internal: true,
    internalArea: s.author.area,
    suggestionId: s.id,
    shared: false,
    editorialRole: "reference",
    date: new Date().toISOString(),
    feedback: "",
    demo: false,
    tags: ["sugestão interna"],
  };
}

function Received({ s, onAccept, onDecline }) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <article className="sg-item">
      <header>
        <b>{s.author.name}</b>
        <span>{s.author.area} · {day(s.createdAt)}</span>
      </header>
      <h3>{s.title}</h3>
      <p>{s.why}</p>
      {s.referenceUrl ? (
        <a href={s.referenceUrl} target="_blank" rel="noreferrer">
          {s.referenceUrl} <ExternalLink size={14} aria-hidden="true" />
        </a>
      ) : (
        <small className="sg-origin">Sem link: relato da experiência de quem sugeriu.</small>
      )}
      {s.referenceText && <details><summary>Detalhes enviados</summary><p>{s.referenceText}</p></details>}
      {declining ? (
        <form
          className="sg-decline"
          onSubmit={(e) => {
            e.preventDefault();
            onDecline(reason);
          }}
        >
          <label>
            Por que não segue? O colaborador vai ler esta resposta.
            <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} required placeholder="Ex.: já publicamos sobre isso em setembro." />
          </label>
          <div className="r-actions">
            <button type="button" className="text-button" onClick={() => setDeclining(false)}>Cancelar</button>
            <button className="button dark">Enviar resposta</button>
          </div>
        </form>
      ) : (
        <div className="r-actions">
          <button className="button secondary" onClick={() => setDeclining(true)}>
            <X size={16} /> Não seguir
          </button>
          <button className="button primary" onClick={onAccept}>
            <Check size={16} /> Aceitar e levar à escrita
          </button>
        </div>
      )}
    </article>
  );
}

export function SuggestionInbox() {
  const { state, setState, account, notify, goto, workspace } = useContext(AppContext);
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const load = () =>
    api("/api/team/suggestions")
      .then((d) => setList(d.suggestions))
      .catch((e) => setError(e.message));
  useEffect(() => {
    if (account) load();
  }, [account?.id]);
  const here = (list || []).filter((s) => s.workspace === state.workspace);
  const received = here.filter((s) => s.status === "received");
  const decided = here.filter((s) => s.status !== "received");
  const elsewhere = (list || []).filter((s) => s.status === "received" && s.workspace !== state.workspace).length;
  async function accept(s) {
    const source = suggestionSource(s);
    let queued;
    try {
      // The reference and the queued idea exist in the brand before the service records the decision.
      queued = queueIdea({ ...state, sources: [source, ...state.sources] }, s.title, source.id, { origin: "suggestion", author: s.author.name, suggestionId: s.id, thesis: s.why });
      setState(queued.state);
      await api("/api/team/suggestions/decide", { id: s.id, decision: "accepted", sourceId: source.id });
      notify(`Ideia aceita. A referência entrou no acervo e a ideia está em Escrever. ${s.author.name} verá o andamento.`);
      load();
    } catch (e) {
      if (queued)
        setState((current) => ({
          ...current,
          sources: current.sources.filter((x) => x.id !== source.id),
          writingQueue: (current.writingQueue || []).filter((q) => q.id !== queued.item.id),
        }));
      notify(e.message, true);
    }
  }
  async function decline(s, reason) {
    try {
      await api("/api/team/suggestions/decide", { id: s.id, decision: "declined", reason });
      notify(`Resposta enviada para ${s.author.name}.`);
      load();
    } catch (e) {
      notify(e.message, true);
    }
  }
  return (
    <div className="sg-inbox">
      <section className="r-panel">
        <div className="sg-head">
          <div>
            <h2>Sugestões de colaboradores</h2>
            <p>
              Pessoas de outras áreas sugerem assuntos para {workspace.name}. Elas não veem o Kanban, o acervo nem os rascunhos;
              acompanham só o andamento das próprias ideias.
            </p>
          </div>
          {account && state.role === "Administrador" && (
            <button className="button secondary" onClick={() => goto("organizacao")}>
              <UserPlus size={16} /> Convidar colaborador
            </button>
          )}
        </div>
        {!account && <p className="r-note-inline">Sugestões de colaboradores exigem uma conta: cada colaborador recebe um acesso próprio e restrito.</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {account && list && !received.length && (
          <p className="sg-empty">
            Nenhuma sugestão aguardando nesta marca.{elsewhere ? ` ${elsewhere} em outras marcas.` : ""}
          </p>
        )}
        <div className="sg-list">
          {received.map((s) => (
            <Received key={s.id} s={s} onAccept={() => accept(s)} onDecline={(reason) => decline(s, reason)} />
          ))}
        </div>
        {decided.length > 0 && (
          <details className="sg-history">
            <summary>Decididas ({decided.length})</summary>
            <ul>
              {decided.map((s) => {
                const status = suggestionStatus(s, state.pieces);
                return (
                  <li key={s.id}>
                    <b>{s.title}</b>
                    <span>{s.author.name} · {day(s.createdAt)}</span>
                    <em className={`sg-status sg-${s.status}`}>{status.label}</em>
                    {s.status === "declined" && <small>{s.reason}</small>}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
        <p className="field-help">
          Ao aceitar, o relato vira uma referência interna no acervo (marcada como não pública) e a ideia entra em Escrever.
          Antes de publicar, confirme os fatos com uma fonte pública quando houver.
        </p>
      </section>
      <RequestForm />
    </div>
  );
}
