import React, { useContext, useState } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { AppContext } from "./context";
import { contextPacket } from "./operations.mjs";
import { transition } from "./workflow.mjs";
import { longFetch } from "./long-fetch.mjs";

const RUBRIC = [
  ["clareza", "Clareza"],
  ["evidencia", "Evidência"],
  ["voz", "Voz da marca"],
  ["utilidade", "Utilidade"],
];
const average = (scores) => (RUBRIC.reduce((sum, [k]) => sum + scores[k], 0) / RUBRIC.length).toFixed(1).replace(".", ",");

// The packet is the same one the writing studio sends: brand, voice, DNA, knowledge and this piece's sources.
export function refinePacket(state, piece) {
  return contextPacket(state, {
    ...(piece.brief || {}),
    title: piece.title,
    format: piece.format,
    sourceIds: piece.sourceIds,
    deadline: piece.deadline,
  });
}

export function RefinePanel({ piece, canEdit, onApplied }) {
  const { state, setState, notify } = useContext(AppContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refine = piece.refine?.revision === piece.revision ? piece.refine : null;
  const store = (value) => setState((s) => ({ ...s, pieces: s.pieces.map((p) => (p.id === piece.id ? { ...p, refine: value } : p)) }));
  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await longFetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packet: refinePacket(state, piece), piece: { title: piece.title, format: piece.format, body: piece.body }, roles: state.modelRoles || {} }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Serviço de IA indisponível.");
      store({ ...data, revision: piece.revision });
      notify("Refino pronto: pontos a melhorar, recomendação e uma nova versão para você comparar.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function apply() {
    try {
      const next = transition(state, piece.id, "edit", { body: refine.revised.body, sourceIds: piece.sourceIds });
      setState({
        ...next,
        pieces: next.pieces.map((p) => (p.id === piece.id ? { ...p, refine: { ...refine, accepted: true, revision: p.revision } } : p)),
      });
      onApplied?.(refine.revised.body);
      notify("Versão refinada aplicada como nova versão. Ela segue para a sua aprovação.");
    } catch (e) {
      notify(e.message, true);
    }
  }
  return (
    <section className="rf-panel" aria-label="Refino com IA">
      <header className="rf-head">
        <div>
          <h3>Refinar com IA</h3>
          <p>O revisor lista o que melhorar e resume como resolver. O redator aplica a recomendação numa nova versão, e um juiz cego compara as duas.</p>
        </div>
        <button className="button secondary" disabled={!canEdit || busy || piece.status === "Publicado"} onClick={run}>
          <Sparkles size={16} /> {busy ? "Refinando…" : refine ? "Refinar de novo" : "Refinar com IA"}
        </button>
      </header>
      {busy && <p role="status" className="rf-wait">Revisando com o contexto da marca, reescrevendo e comparando. Leva cerca de um minuto.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {refine && (
        <div className="rf-result">
          {refine.problems?.length > 0 && (
            <div>
              <h4>Pontos a melhorar</h4>
              <ul className="rf-problems">
                {refine.problems.map((p, i) => (
                  <li key={i}>
                    <span className={`rf-sev rf-sev-${p.severity === "alta" ? "high" : p.severity === "baixa" ? "low" : "mid"}`}>{p.severity}</span>
                    <div>
                      {p.problem}
                      {p.excerpt && <q>{p.excerpt}</q>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rf-recommendation">
            <h4>Recomendação</h4>
            <p>{refine.recommendation}</p>
          </div>
          <div className="rf-versions">
            <div>
              <h4>Versão refinada</h4>
              <pre className="rf-text">{refine.revised.body}</pre>
              {refine.revised.changes?.length > 0 && (
                <ul className="rf-changes">
                  {refine.revised.changes.map((c) => <li key={c}>{c}</li>)}
                </ul>
              )}
              {refine.revised.issues?.length > 0 && <p className="form-error">Checagem local: {refine.revised.issues.join(" ")}</p>}
            </div>
            <div className="rf-judge">
              <h4>Juiz cego</h4>
              {refine.judge?.error ? (
                <p className="field-help">O juiz não respondeu ({refine.judge.error}). As recomendações e a versão continuam valendo.</p>
              ) : refine.judge ? (
                <>
                  <table>
                    <thead><tr><th scope="col">Critério</th><th scope="col">Atual</th><th scope="col">Refinada</th></tr></thead>
                    <tbody>
                      {RUBRIC.map(([k, label]) => (
                        <tr key={k}><th scope="row">{label}</th><td>{refine.judge.original[k]}</td><td>{refine.judge.revised[k]}</td></tr>
                      ))}
                      <tr className="rf-avg"><th scope="row">Média</th><td>{average(refine.judge.original)}</td><td>{average(refine.judge.revised)}</td></tr>
                    </tbody>
                  </table>
                  <p className="rf-verdict">
                    {refine.judge.winner === "revisada" ? "Prefere a versão refinada." : refine.judge.winner === "original" ? "Prefere a versão atual." : "Considera as duas equivalentes."} {refine.judge.reason}
                  </p>
                </>
              ) : null}
              <dl className="rf-models">
                <div><dt>Revisor</dt><dd>{refine.models.reviewer}</dd></div>
                <div><dt>Redator</dt><dd>{refine.models.writer}</dd></div>
                <div><dt>Juiz cego</dt><dd>{refine.models.judge}</dd></div>
              </dl>
            </div>
          </div>
          {refine.accepted ? (
            <p className="rf-applied"><Check size={15} aria-hidden="true" /> Aplicada como versão {refine.revision}.</p>
          ) : (
            <div className="r-actions rf-actions">
              <button className="button secondary" disabled={!canEdit} onClick={() => store(null)}>
                <X size={16} /> Descartar sugestão
              </button>
              <button className="button primary" disabled={!canEdit} onClick={apply}>
                <Check size={16} /> Usar versão refinada
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
