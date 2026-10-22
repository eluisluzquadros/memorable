import React, { useContext, useState } from "react";
import { Briefcase, Download, Plus, Trash2, ArrowRight, Check } from "lucide-react";
import { AppContext } from "./context";
import { statusLabel } from "./workflow.mjs";
import { eligiblePieces, saveCase, removeCase, caseStory, caseDocument } from "./cases.mjs";

const empty = { title: "", challenge: "", approach: "", pieceIds: [] };

function exportCase(state, item, brandName) {
  const url = URL.createObjectURL(new Blob([caseDocument(state, item, brandName)], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `case-${item.title.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function Portfolio() {
  const { state, setState, notify, workspace, goto, setSelectedPiece } = useContext(AppContext);
  const [form, setForm] = useState(null);
  const [open, setOpen] = useState(null);
  const cases = (state.cases || []).filter((c) => c.workspace === state.workspace);
  const ready = eligiblePieces(state);
  const run = (fn, message) => {
    try {
      setState(fn(state));
      notify(message);
      return true;
    } catch (e) {
      notify(e.message, true);
      return false;
    }
  };
  const togglePiece = (id) => setForm((f) => ({ ...f, pieceIds: f.pieceIds.includes(id) ? f.pieceIds.filter((x) => x !== id) : [...f.pieceIds, id] }));
  const active = cases.find((c) => c.id === open);
  const story = active && caseStory(state, active);

  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Seu trabalho vira case.</h1>
          <p>Transforme fluxos concluídos em cases para mostrar a clientes e investidores. Números aparecem só quando registrados com evidência em Resultados.</p>
        </div>
        <button className="button primary" onClick={() => setForm({ ...empty })} disabled={!ready.length} title={ready.length ? undefined : "Aprove ao menos um conteúdo para montar um case."}>
          <Plus size={17} /> Montar case
        </button>
      </div>

      {form && (
        <section className="r-panel pf-form" aria-label="Montar case">
          <h2>{form.id ? "Editar case" : "Novo case"}</h2>
          <label>
            Título do case
            <input value={form.title} maxLength={120} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Um episódio, sete conteúdos" />
          </label>
          <label>
            Desafio do cliente
            <textarea rows={3} value={form.challenge} onChange={(e) => setForm({ ...form, challenge: e.target.value })} placeholder="O que precisava ser resolvido, para quem e por quê." />
          </label>
          <label>
            Como fizemos (opcional)
            <textarea rows={2} value={form.approach} onChange={(e) => setForm({ ...form, approach: e.target.value })} placeholder="Fontes usadas, formatos escolhidos, decisões editoriais." />
          </label>
          <fieldset className="pf-pieces">
            <legend>Conteúdos aprovados que entram no case</legend>
            {ready.map((p) => (
              <label key={p.id} className="checkbox-label">
                <input type="checkbox" checked={form.pieceIds.includes(p.id)} onChange={() => togglePiece(p.id)} />
                <span>
                  <b>{p.title}</b> <small>{p.format} · {statusLabel(p.status)}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="r-actions">
            <button className="button primary" onClick={() => run((s) => saveCase(s, form), "Case salvo no portfólio.") && setForm(null)}>
              <Check size={17} /> Salvar case
            </button>
            <button className="button secondary" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </section>
      )}

      {!cases.length && !form && (
        <section className="r-panel pf-empty">
          <Briefcase size={30} aria-hidden="true" />
          <h2>Seu primeiro case começa com um conteúdo aprovado.</h2>
          <p>{ready.length ? `Você já tem ${ready.length} ${ready.length === 1 ? "conteúdo pronto" : "conteúdos prontos"}. Monte um case para apresentar o fluxo completo: fonte, conteúdos, aprovação e resultados.` : "Escreva, revise e aprove um conteúdo. Depois volte aqui para empacotar o trabalho como case."}</p>
          {!ready.length && (
            <button className="button secondary" onClick={() => goto("escrever")}>
              Ir para Escrever <ArrowRight size={16} />
            </button>
          )}
        </section>
      )}

      {cases.length > 0 && (
        <ul className="pf-grid">
          {cases.map((c) => {
            const s = caseStory(state, c);
            return (
              <li key={c.id}>
                <button className={`pf-card ${open === c.id ? "is-open" : ""}`} onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id}>
                  <strong>{c.title}</strong>
                  <span>{c.challenge}</span>
                  <small>
                    {s.pieces.length} {s.pieces.length === 1 ? "conteúdo" : "conteúdos"} · {s.formats.join(", ")}
                    {s.totals ? " · resultados com evidência" : ""}
                  </small>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {active && (
        <section className="r-panel pf-detail" aria-label={`Case ${active.title}`}>
          <div className="pf-detail-head">
            <div>
              <h2>{active.title}</h2>
              <p>{active.challenge}</p>
              {active.approach && <p className="pf-muted">{active.approach}</p>}
            </div>
            <div className="r-actions">
              <button className="button primary" onClick={() => exportCase(state, active, workspace.name)}>
                <Download size={16} /> Exportar apresentação
              </button>
              <button className="button secondary" onClick={() => setForm({ ...active })}>
                Editar
              </button>
              <button className="icon-button" aria-label="Excluir case" onClick={() => run((s) => removeCase(s, active.id), "Case excluído.") && setOpen(null)}>
                <Trash2 size={17} />
              </button>
            </div>
          </div>
          {story.stale && <p className="validation-warning">Algum conteúdo deste case foi editado ou removido e saiu da aprovação. Revise antes de apresentar.</p>}
          <div className="pf-columns">
            <div>
              <h3>Fontes de origem</h3>
              <ul>
                {story.sources.map((s) => (
                  <li key={s.id}>
                    <b>{s.title}</b>
                    <small>{s.origin}</small>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Conteúdos</h3>
              <ul>
                {story.pieces.map((p) => (
                  <li key={p.id}>
                    <button className="text-button" onClick={() => setSelectedPiece(p.id)}>
                      {p.title}
                    </button>
                    <small>
                      {p.format} · {statusLabel(p.status)}
                      {p.approver ? ` · aprovada por ${p.approver} (v${p.approvedRevision})` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Resultados</h3>
              {story.totals ? (
                <dl className="pf-totals">
                  {[["Visualizações", story.totals.views], ["Cliques", story.totals.clicks], ["Conversas", story.totals.conversations]].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{Number(v).toLocaleString("pt-BR")}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="pf-muted">
                  Nenhum resultado com evidência ainda.{" "}
                  <button className="text-button" onClick={() => goto("resultados")}>
                    Registrar em Resultados
                  </button>
                </p>
              )}
              {story.learnings.map((l) => (
                <p key={l} className="pf-learning">
                  “{l}”
                </p>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
