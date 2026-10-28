import React, { useContext, useState } from "react";
import { AppContext } from "./context";
import {
  assertEditor,
  assertAdmin,
  sourceValid,
  sourceCaptureProblem,
  safeUrl,
} from "./operations.mjs";
import { transition } from "./workflow.mjs";
import { invalidateSourceDependents } from './strategy.mjs';
import { workspaceList } from './account-state.mjs';
import { Download, Check, ExternalLink, ArrowRight, Trash2, AlertTriangle } from "lucide-react";
export function RequestForm() {
  const {state,setState,notify} = useContext(AppContext);
  const [form,setForm] = useState({title:'',owner:'Editor',deadline:'',body:''});
  return <details className="r-panel"><summary>Anotar uma ideia do time, mesmo sem referência ainda</summary><form onSubmit={e=>{e.preventDefault();try{assertEditor(state);if(!form.title.trim()||!form.owner.trim()||!form.deadline)throw new Error('Preencha assunto, responsável e prazo.');const piece={...form,id:crypto.randomUUID(),workspace:state.workspace,status:'Pedido',format:'LinkedIn',sourceIds:[],revision:1,approvedRevision:null,approver:null,council:null,scheduledAt:null,channel:null,cost:0,createdAt:new Date().toISOString(),stageAt:new Date().toISOString()};setState(s=>({...s,pieces:[piece,...s.pieces]}));setForm({title:'',owner:'Editor',deadline:'',body:''});notify('Pedido cadastrado. Abra o cartão para desenvolver o texto e vincular fontes.');}catch(e){notify(e.message,true);}}}><label>Assunto do pedido<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label><div className="field-pair"><label>Responsável pelo pedido<input required value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}/></label><label>Prazo do pedido<input required type="date" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})}/></label></div><label>Briefing inicial<textarea rows={3} value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label><button className="button primary">Cadastrar pedido</button></form></details>;
}
export function SourceRefresh({source}) {
  const {state,setState,notify}=useContext(AppContext);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function refresh(){
    setError('');setBusy(true);
    try{
      assertEditor(state);if(source.workspace!==state.workspace)throw new Error('Abra a marca de origem para atualizar esta referência.');
      const response=await fetch('/api/ingest/url',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:source.url})});
      const result=await response.json();if(!response.ok)throw new Error(result.error||'Não foi possível atualizar a leitura.');
      setState(s=>({...s,sources:s.sources.map(x=>x.id===source.id?{...x,...result,title:x.title,origin:x.origin||result.origin,citable:true,manualOverride:false}:x),pieces:invalidateSourceDependents(s.pieces,new Set([source.id]))}));
      notify('Texto e resumo atualizados. Conteúdos vinculados precisam de nova conferência.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return source.url?<div className="source-refresh"><button className="text-button" disabled={busy} onClick={refresh}>{busy?'Atualizando…':'Atualizar leitura'}</button><p className="field-help">Substitui o texto e o resumo pela leitura atual do endereço. Suas etiquetas e a classificação da referência são preservadas.</p>{error&&<p className="form-error" role="alert">{error}</p>}</div>:null;
}
export function SourceMetadata({ source }) {
  const { state, setState, notify, setSelectedSource } = useContext(AppContext);
  const [title, setTitle] = useState(source.title);
  const [url, setUrl] = useState(source.url || "");
  const [type, setType] = useState(source.type || "Texto");
  const [tags, setTags] = useState((source.tags || []).join(", "));
  const [validUntil, setUntil] = useState(source.validUntil || "");
  const [origin, setOrigin] = useState(source.origin);
  const [text, setText] = useState(source.text);
  const [shared, setShared] = useState(source.shared);
  const [whySaved, setWhySaved] = useState(source.whySaved || '');
  const [pattern, setPattern] = useState(source.pattern || '');
  const count = state.pieces.filter((p) =>
    p.sourceIds.includes(source.id),
  ).length;
  return (
    <details className="r-panel" open={Boolean(sourceCaptureProblem(source))}>
      <summary>Editar referência, validade e gestão</summary>
      <p>
        {count} conteúdos citam esta fonte ·{" "}
        {sourceValid(source) ? "Citável" : "Não citável ou vencida"}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            assertEditor(state);
            if (source.workspace !== state.workspace)
              throw new Error(
                "Abra a marca de origem para editar uma fonte compartilhada.",
              );
            if (!title.trim() || !text.trim())
              throw new Error("O conteúdo não pode ficar vazio.");
            if (url && !/^https?:\/\//i.test(url))
              throw new Error("Use um endereço começando com https:// ou http://.");
            setState((s) => ({
              ...s,
              sources: s.sources.map((x) =>
                x.id === source.id
                  ? {
                      ...x,
                      title: title.trim(),
                      url: url.trim(),
                      type,
                      tags: tags
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                      validUntil,
                      origin: origin.trim(),
                      text: text.trim(),
                      ...(text.trim() !== source.text.trim() ? {transcript:text.trim(),summary:'',keywords:[],extraction:{status:'ready',method:'conteúdo revisado pela equipe',extractedAt:new Date().toISOString()}} : {}),
                      citable: Boolean(origin.trim()),
                      captureStatus: undefined,
                      shared,
                      whySaved,
                      pattern,
                      manualOverride: true,
                    }
                  : x,
              ),
              pieces: invalidateSourceDependents(s.pieces, new Set([source.id])),
              events: [
                {
                  id: crypto.randomUUID(),
                  workspace: source.workspace,
                  title: source.title,
                  event:
                    "Fonte revisada; os conteúdos vinculados precisam de nova conferência.",
                  action: "source-edit",
                  author: state.role,
                  at: new Date().toISOString(),
                  revision: 1,
                },
                ...s.events,
              ],
            }));
            notify(
              "Referência atualizada. Os conteúdos vinculados foram enviados à conferência.",
            );
          } catch (e) {
            notify(e.message, true);
          }
        }}
      >
        <div className="field-pair">
        <label>
          Título
          <input value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {["Web", "Vídeo", "Social", "Texto", "Documento", "Podcast", "Notícia"].map(option => <option key={option}>{option}</option>)}
          </select>
        </label>
        </div>
        <label>
          Origem / autoria
          <input value={origin} onChange={(e) => setOrigin(e.target.value)} />
        </label>
        <label>
          Link da fonte (opcional)
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
        </label>
        <label>
          Texto da referência
          <textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="field-pair">
          <label>
            Etiquetas, separadas por vírgula
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
          <label>
            Válida até (vazio = sem vencimento)
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setUntil(e.target.value)}
            />
          </label>
        </div>
        <label>Por que você salvou esta fonte?<textarea rows={2} value={whySaved} onChange={e=>setWhySaved(e.target.value)}/></label>
        <label>Padrão de estrutura a estudar<textarea rows={2} value={pattern} onChange={e=>setPattern(e.target.value)} placeholder="Estrutura, gancho e progressão; preservar autoria."/></label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
          />
          Compartilhar com a biblioteca do grupo
        </label>
        <button className="button secondary">
          Salvar referência e reconferir vínculos
          <Check size={16} />
        </button>
      </form>
    </details>
  );
}
// Deleting a reference is visible in the reference's own footer. A reference shared by another brand
// can only be deleted there, and the footer says whose it is and opens it.
export function SourceDelete({ source }) {
  const { state, setState, notify, setSelectedSource, changeWorkspace } = useContext(AppContext);
  const [confirm, setConfirm] = useState(false);
  const count = state.pieces.filter((p) => p.sourceIds.includes(source.id)).length;
  if (source.workspace !== state.workspace) {
    const owner = workspaceList(state, { includeArchived: true }).find((w) => w.id === source.workspace);
    return (
      <div className="source-delete source-delete-foreign">
        <p>Esta referência é de <b>{owner?.name || "outra marca"}</b> e chega aqui pela biblioteca compartilhada. Só a marca de origem pode editá-la ou excluí-la.</p>
        {owner && !owner.archived && (
          <button className="text-button" onClick={() => { changeWorkspace(source.workspace); setSelectedSource(source.id); }}>
            Abrir em {owner.name} <ArrowRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
  function remove() {
    try {
      assertEditor(state);
      setState((s) => ({
        ...s,
        sources: s.sources.filter((x) => x.id !== source.id),
        pieces: invalidateSourceDependents(s.pieces, new Set([source.id])),
        events: [{ id: crypto.randomUUID(), workspace: source.workspace, title: source.title, event: "Referência excluída do acervo.", action: "source-delete", author: s.role, at: new Date().toISOString() }, ...s.events],
      }));
      const collectedId = source.collectionId || source.id;
      if (collectedId.startsWith("web-")) fetch("/api/collected/remove", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace: source.workspace, id: collectedId }) }).catch(() => {});
      setSelectedSource(null);
      notify("Referência excluída do acervo.");
    } catch (e) {
      notify(e.message, true);
    }
  }
  return (
    <div className="source-delete">
      {count > 0 && <p><AlertTriangle size={15} aria-hidden="true" /> Usada por {count} {count === 1 ? "conteúdo" : "conteúdos"}. Ao excluir, {count === 1 ? "ele precisa" : "eles precisam"} de outra fonte antes de uma nova aprovação.</p>}
      {source.shared && <p>Está na biblioteca compartilhada: some também para as outras marcas do grupo.</p>}
      {confirm ? (
        <div className="dialog-actions">
          <button className="button secondary" onClick={() => setConfirm(false)}>Cancelar</button>
          <button className="button danger" onClick={remove}><Trash2 size={16} aria-hidden="true" /> Excluir definitivamente</button>
        </div>
      ) : (
        <button className="text-button danger-text" onClick={() => setConfirm(true)}><Trash2 size={16} aria-hidden="true" /> Excluir do acervo</button>
      )}
    </div>
  );
}
export function PublicationControls({ piece }) {
  const { state, setState, notify } = useContext(AppContext);
  const [url, setUrl] = useState("");
  const [asset, setAsset] = useState({ kind: "Imagem", url: "" });
  const saveAction = (action, payload) => {
    try {
      setState(transition(state, piece.id, action, payload));
      notify(
        action === "publish"
          ? "Publicação registrada com comprovante."
          : "Agendamento cancelado.",
      );
    } catch (e) {
      notify(e.message, true);
    }
  };
  return (
    <section className="r-panel">
      <h2>Distribuição e arquivos</h2>
      {piece.sourceReview && <p className="form-error">A fonte mudou. Confira o conteúdo; se já foi publicado, avalie uma atualização no canal de origem.</p>}
      {piece.liveUrl && (
        <p>
          <a href={piece.liveUrl} target="_blank" rel="noreferrer">
            Ver publicação registrada
            <ExternalLink size={15} />
          </a>
        </p>
      )}
      {piece.status === "Agendado" && (
        <button
          className="button secondary"
          onClick={() => saveAction("unschedule")}
        >
          Cancelar agendamento local
        </button>
      )}
      {["Aprovado", "Agendado"].includes(piece.status) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveAction("publish", { url });
          }}
        >
          <label>
            URL da publicação realizada fora da plataforma
            <input
              type="url"
              required
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <button className="button secondary">
            Registrar publicação externa
            <Check size={16} />
          </button>
          <p className="field-help">
            Este registro confirma uma ação feita pelo time. Não envia conteúdo
            para redes sociais.
          </p>
        </form>
      )}
      <details>
        <summary>Arquivos de produção</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              assertEditor(state);
              const valid = safeUrl(asset.url);
              setState((s) => ({
                ...s,
                pieces: s.pieces.map((p) =>
                  p.id === piece.id
                    ? {
                        ...p,
                        assets: [
                          ...(p.assets || []),
                          { ...asset, url: valid, id: crypto.randomUUID() },
                        ],
                        council: null,
                        approvedRevision: null,
                        approver: null,
                        scheduledAt: null,
                        channel: null,
                        status: "Em conferência",
                        revision: p.revision + 1,
                      }
                    : p,
                ),
              }));
              setAsset({ ...asset, url: "" });
              notify(
                "Arquivo vinculado. Revise a nova versão antes de aprovar.",
              );
            } catch (e) {
              notify(e.message, true);
            }
          }}
        >
          <div className="field-pair">
            <label>
              Tipo
              <select
                value={asset.kind}
                onChange={(e) => setAsset({ ...asset, kind: e.target.value })}
              >
                {["Imagem", "Vídeo", "Áudio", "Documento"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              URL do arquivo
              <input
                type="url"
                required
                value={asset.url}
                onChange={(e) => setAsset({ ...asset, url: e.target.value })}
              />
            </label>
          </div>
          <button className="button secondary">Vincular arquivo</button>
        </form>
        {piece.assets?.map((a) => (
          <p key={a.id}>
            <a href={a.url} target="_blank" rel="noreferrer">
              {a.kind} · abrir arquivo
              <ExternalLink size={15} />
            </a>
          </p>
        ))}
      </details>
    </section>
  );
}
export function Results() {
  const { state, setState, pieces, notify, selectTopic } =
    useContext(AppContext);
  const [form, setForm] = useState({
    pieceId: pieces[0]?.id || "",
    views: 0,
    clicks: 0,
    conversations: 0,
    learning: "",
    hypothesis: "",
    evidence: "",
    qualification: "",
    reviewMinutes: 0,
    actualCost: 0,
  });
  const rows = state.outcomes.filter((r) => r.workspace === state.workspace);
  return (
    <>
      <div className="page-heading">
        <div>
          
          <h1>O que funcionou, para fazer mais.</h1>
          <p>
            Registre resultados com evidência e transforme o que deu certo em
            critério para os próximos conteúdos.
          </p>
        </div>
      </div>
      <div className="r-stat-strip">
        <div>
          <b>{rows.length}</b>
          <span>resultados registrados</span>
        </div>
        <div>
          <b>{rows.reduce((s, r) => s + r.views, 0)}</b>
          <span>visualizações informadas</span>
        </div>
        <div>
          <b>{rows.reduce((s, r) => s + r.clicks, 0)}</b>
          <span>cliques informados</span>
        </div>
        <div>
          <b>{rows.reduce((s, r) => s + r.conversations, 0)}</b>
          <span>conversas informadas</span>
        </div>
      </div>
      <div className="r-two-columns">
        <section className="r-panel">
          <h2>Registrar um resultado</h2>
          <p>
            Métricas manuais do time. Cada conteúdo mantém a última medição,
            evitando somar o mesmo resultado duas vezes.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                assertEditor(state);
                const piece = pieces.find((p) => p.id === form.pieceId);
                if (!piece) throw new Error("Escolha um conteúdo desta marca.");
                if (
                  [form.views, form.clicks, form.conversations].some(
                    (n) => !Number.isInteger(Number(n)) || Number(n) < 0,
                  )
                )
                  throw new Error("Use contagens inteiras não negativas.");
                if (!form.learning.trim())
                  throw new Error("Registre o aprendizado.");
                if ([form.reviewMinutes, form.actualCost].some(n => !Number.isFinite(Number(n)) || Number(n) < 0)) throw new Error('Tempo e custo precisam ser números não negativos.');
                const row = {
                  ...form,
                  views: Number(form.views),
                  clicks: Number(form.clicks),
                  conversations: Number(form.conversations),
                  reviewMinutes: Number(form.reviewMinutes),
                  actualCost: Number(form.actualCost),
                  campaignId: piece.campaignId || null,
                  id: crypto.randomUUID(),
                  workspace: state.workspace,
                  at: new Date().toISOString(),
                  title: piece.title,
                  sourceIds: piece.sourceIds,
                };
                setState((s) => ({
                  ...s,
                  outcomes: [
                    row,
                    ...s.outcomes.filter((r) => r.pieceId !== piece.id),
                  ],
                }));
                notify(
                  "Resultado atualizado. Valide aprendizados no Caderno antes de torná-los regra.",
                );
              } catch (e) {
                notify(e.message, true);
              }
            }}
          >
            <label>
              Conteúdo
              <select
                value={form.pieceId}
                onChange={(e) => {
                  const previous = rows.find(
                    (r) => r.pieceId === e.target.value,
                  );
                  setForm(
                    previous
                      ? { ...previous }
                      : {
                          ...form,
                          pieceId: e.target.value,
                          views: 0,
                          clicks: 0,
                          conversations: 0,
                          learning: "",
                          hypothesis: "",
                          evidence: "", qualification: "", reviewMinutes: 0, actualCost: 0,
                        },
                  );
                }}
              >
                <option value="">Selecione um conteúdo</option>
                {pieces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Hipótese editorial
              <input
                value={form.hypothesis}
                onChange={(e) =>
                  setForm({ ...form, hypothesis: e.target.value })
                }
                placeholder="Ex.: responder à dúvida inicial gera conversas mais qualificadas"
              />
            </label>
            <div className="r-metric-inputs">
              {[
                ["views", "Visualizações"],
                ["clicks", "Cliques"],
                ["conversations", "Conversas"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form[key]}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="field-pair"><label>Minutos de revisão humana<input aria-label="Minutos de revisão humana" type="number" min="0" step="1" value={form.reviewMinutes || 0} onChange={e=>setForm({...form,reviewMinutes:e.target.value})}/></label><label>Custo real informado (R$)<input aria-label="Custo real informado (R$)" type="number" min="0" step="0.01" value={form.actualCost || 0} onChange={e=>setForm({...form,actualCost:e.target.value})}/></label></div>
            <label>Evidência da medição<input aria-label="Evidência da medição" value={form.evidence || ''} onChange={e=>setForm({...form,evidence:e.target.value})} placeholder="Relatório, link ou observação verificável"/></label>
            <label>Critério usado para qualificar conversas<input aria-label="Critério usado para qualificar conversas" value={form.qualification || ''} onChange={e=>setForm({...form,qualification:e.target.value})}/></label>
            <label>
              O que aprendemos?
              <textarea
                required
                rows={3}
                value={form.learning}
                onChange={(e) => setForm({ ...form, learning: e.target.value })}
              />
            </label>
            <button className="button primary">
              Salvar resultado
              <Check size={16} />
            </button>
          </form>
        </section>
        <section className="r-panel">
          <h2>Aprendizados por conteúdo</h2>
          {rows.map((r) => (
            <article className="r-log" key={r.id}>
              <div>
                <h3>{r.title}</h3>
                <p>
                  <b>Hipótese:</b> {r.hypothesis || "Não informada"}
                </p>
                <p>{r.learning}</p>
                <p>Evidência: {r.evidence || 'Não informada'} · Critério de qualificação: {r.qualification || 'Não definido'}</p>
                <small>{r.reviewMinutes || 0} min de revisão · R$ {Number(r.actualCost || 0).toFixed(2)} informados; valores ausentes não comprovam custo zero.</small>
                <small>
                  {r.views} visualizações · {r.clicks} cliques ·{" "}
                  {r.conversations} conversas
                </small>
                <small>
                  {new Date(r.at).toLocaleDateString("pt-BR")} · medição manual
                </small>
                <button
                  className="text-button"
                  onClick={() =>
                    selectTopic(r.title, r.sourceIds[0], {
                      origin: "recommendation",
                      thesis: r.learning,
                      parentId: r.pieceId,
                      campaignId: r.campaignId || '',
                    })
                  }
                >
                  Criar um desdobramento
                  <ArrowRight size={15} />
                </button>
              </div>
            </article>
          ))}
          {!rows.length && (
            <p>
              Nenhum resultado informado. Registre a primeira medição para
              comparar hipóteses com evidência.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
