import React, { useContext, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Sparkles,
  FileText,
  Image,
  Check,
  Bookmark,
} from "lucide-react";
import { AppContext } from "./context";
import {
  FORMATS,
  sourceValid,
  rankedTopics,
  contextPacket,
  productionVariants,
  assertEditor,
  runCouncil,
  executionRecord,
} from "./operations.mjs";
import { createPiece, transition } from "./workflow.mjs";
import {
  productionSettings,
  durationsFor,
  durationLabel,
  DEFAULT_DURATION,
} from "./production.mjs";
import { editorialIssues } from "./editorial-quality.mjs";
import { ProviderTools } from "./ProviderTools";
import { MediaStudio } from "./Connections";
import { CouncilReport } from "./Advanced";
import { longFetch } from "./long-fetch.mjs";
import { pendingGeneration } from "./pending-generation.mjs";
import "./writing.css";

export function WritingStudio() {
  const {
    state,
    setState,
    workspace,
    sources,
    brief,
    setBrief,
    generated,
    setGenerated,
    selectTopic,
    notify,
    goto,
    setSelectedPiece,
  } = useContext(AppContext);
  const [stage, setStage] = useState(
    generated ? "edit" : brief.handoffKey ? "setup" : "idea",
  );
  // Drafts already generated but not yet sent to review (a blocked send leaves a piece here): the way back to them.
  const drafts = state.pieces.filter((p) => p.workspace === state.workspace && ["Rascunho", "Em conferência", "Ajustes"].includes(p.status));
  const [tab, setTab] = useState(() => (drafts.length ? "drafts" : "selected")),
    [selected, setSelected] = useState(0),
    [audit, setAudit] = useState(null),
    [busy, setBusy] = useState(false),
    [savedId, setSavedId] = useState(null),
    [preparing, setPreparing] = useState(false),
    [prepError, setPrepError] = useState("");
  useEffect(() => {
    setStage("idea");
    setAudit(null);
    setSavedId(null);
    setSelected(0);
  }, [state.workspace]);
  useEffect(() => {
    if (brief.handoffKey) {
      setStage("setup");
      setAudit(null);
      setSelected(0);
      setSavedId(null);
    }
  }, [brief.handoffKey]);
  // A generation still running for this brand (left the screen or reloaded the page): show its brief
  // and the generation step, where the result is picked up.
  useEffect(() => {
    const job = pendingGeneration(state.workspace);
    if (!job) return;
    if (JSON.stringify(job.brief) !== JSON.stringify(brief)) setBrief((b) => ({ ...job.brief, handoffKey: b.handoffKey }));
    setStage("setup");
  }, [state.workspace]);
  const allowedDurations = durationsFor(brief.format);
  const activeBrief = {
    ...brief,
    durationSeconds: allowedDurations.includes(Number(brief.durationSeconds))
      ? Number(brief.durationSeconds)
      : DEFAULT_DURATION[brief.format] ?? 60,
  };
  const settings = productionSettings(activeBrief),
    packet = contextPacket(state, activeBrief),
    draft = generated?.[selected];
  const queue = (state.writingQueue || []).filter(
    (q) => q.workspace === state.workspace,
  );
  const suggestions = rankedTopics(state)
    .filter(
      (t) =>
        !t.blocked && !t.duplicate && !queue.some((q) => q.topicId === t.id),
    )
    .slice(0, 6);
  const picked = sources.find((s) => s.id === brief.source);
  const stageIndex = ["idea", "setup", "edit", "media"].indexOf(stage);
  function change(key, value) {
    setBrief((b) => ({
      ...b,
      [key]: value,
      ...(key === "format"
        ? {
            durationSeconds: DEFAULT_DURATION[value] ?? 60,
            scriptMode: value === "Podcast completo" ? "outline" : "spoken",
          }
        : {}),
    }));
    setGenerated(null);
    setAudit(null);
    setSavedId(null);
  }
  function checkInput() {
    assertEditor(state);
    if (!brief.title?.trim()) throw new Error("Dê um assunto à sua ideia.");
    if (!picked || !sourceValid(picked))
      throw new Error("Escolha uma referência com conteúdo válido.");
  }
  function skeleton() {
    try {
      checkInput();
      setGenerated(productionVariants(packet));
      setStage("edit");
      setSelected(0);
      setAudit(null);
      setSavedId(null);
      notify(
        "Modelo aberto para escrita manual. Os campos ainda precisam ser redigidos.",
      );
    } catch (e) {
      notify(e.message, true);
    }
  }
  // Visual direction, shot list and SEO are prepared only when an AI draft reaches the Media step.
  async function prepareProduction() {
    if (!draft || draft.mode !== "provider" || draft.visual || settings.video) return;
    setPreparing(true); setPrepError("");
    try {
      const response = await longFetch("/api/production", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packet, version: draft, provider: draft.writer?.provider || "server", model: draft.writer?.model }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível preparar a produção.");
      setGenerated((items) => items.map((v, i) => (i === selected ? { ...v, ...data } : v)));
    } catch (e) { setPrepError(e.message); } finally { setPreparing(false); }
  }
  // The model may also cite brand knowledge that is not a reference in the library (e.g. the approved DNA);
  // the piece keeps the library references it used, or the ones chosen for it.
  function draftSourceIds() {
    const known = new Set(state.sources.map((s) => s.id));
    const cited = (draft?.sourceIds || []).filter((id) => known.has(id));
    return cited.length ? cited : packet.sources.map((s) => s.id);
  }
  function materialize() {
    assertEditor(state);
    if (!draft) throw new Error("Crie ou escreva o conteúdo primeiro.");
    const ids = draftSourceIds();
    let next;
    if (savedId && state.pieces.some((p) => p.id === savedId)) {
      next = transition(state, savedId, "edit", {
        body: draft.body,
        sourceIds: ids,
      });
      next = {
        ...next,
        pieces: next.pieces.map((p) =>
          p.id === savedId
            ? {
                ...p,
                title: brief.title,
                format: brief.format,
                brief: packet.brief,
                delivery: draft,
                deadline: brief.deadline,
                owner: brief.owner,
              }
            : p,
        ),
      };
    } else {
      next = createPiece(state, {
        ...activeBrief,
        title: draft.title || brief.title,
        body: draft.body,
        sourceIds: ids,
        brief: packet.brief,
        delivery: draft,
      });
      next = {
        ...next,
        executions: [
          executionRecord(state, next.pieces[0], draft),
          ...next.executions,
        ],
      };
    }
    const id =
      savedId && next.pieces.some((p) => p.id === savedId)
        ? savedId
        : next.pieces[0].id;
    next = {
      ...next,
      writingQueue: (next.writingQueue || []).filter(
        (q) => q.id !== brief.queueId,
      ),
    };
    return { next, id };
  }
  function save(send = false) {
    try {
      let { next, id } = materialize();
      setSavedId(id);
      if (send) {
        const reviewed = runCouncil(
          next,
          next.pieces.find((p) => p.id === id),
        );
        next = {
          ...next,
          pieces: next.pieces.map((p) => (p.id === id ? reviewed.piece : p)),
        };
        setAudit(reviewed.piece.council);
        setState(next);
        if (!reviewed.piece.council.passed) {
          notify(
            "Rascunho salvo com pendências. Corrija os pontos indicados antes de enviar.",
            true,
          );
          // The checks sit below the text: bring them into view so the person sees what to fix.
          setTimeout(() => document.querySelector(".r-council")?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
          return;
        }
        next = transition(next, id, "review");
      }
      setState(next);
      notify(send ? "Enviado para revisão humana." : "Rascunho salvo.");
      if (send) goto("aprovar");
    } catch (e) {
      notify(e.message, true);
    }
  }
  const issues = draft
    ? editorialIssues({
        body: draft.body,
        format: brief.format,
        brief: packet.brief,
        brand: packet.brand,
        sources: packet.sources,
      })
    : [];
  return (
    <div className="writing-studio">
      <header className="page-heading">
        <div>
          <h1>Uma ideia, todos os formatos.</h1>
          <p>
            A referência dá a base. A mensagem e o convite final falam com a voz da sua
            marca.
          </p>
        </div>
      </header>
      <nav className="ws-steps" aria-label="Etapas da escrita">
        {[
          ["idea", "Ideia"],
          ["setup", "Criar"],
          ["edit", "Revisar"],
          ["media", "Mídia"],
        ].map(([id, label], i) => (
          <button
            key={id}
            aria-current={stage === id ? "step" : undefined}
            disabled={busy || (i > 1 && !draft) || (i === 1 && !brief.title)}
            onClick={() => setStage(id)}
          >
            <span>{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      {stage === "idea" && (
        <>
          <section className="ws-start">
            <div>
              <h2>Por onde começar?</h2>
              <p>
                Escolha uma referência ou traga uma ideia. Os agentes podem
                cuidar da redação.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setBrief((b) => ({
                  ...b,
                  title: "",
                  thesis: "",
                  angle: "",
                  cta: "",
                  offer: "",
                  experience: "",
                  origin: "manual",
                  topicId: undefined,
                  queueId: null,
                  handoffKey: null,
                  source: "",
                }));
                setGenerated(null);
                setAudit(null);
                setSavedId(null);
                setStage("setup");
              }}
            >
              <Plus size={17} />
              Nova ideia
            </button>
          </section>
          <div
            className="ws-tabs"
            role="group"
            aria-label="Ideias para escrever"
          >
            <button
              aria-pressed={tab === "selected"}
              onClick={() => setTab("selected")}
            >
              Selecionadas <span>{queue.length}</span>
            </button>
            <button
              aria-pressed={tab === "drafts"}
              onClick={() => setTab("drafts")}
            >
              Em andamento <span>{drafts.length}</span>
            </button>
            <button
              aria-pressed={tab === "suggested"}
              onClick={() => setTab("suggested")}
            >
              Sugestões
            </button>
          </div>
          <p className="ws-description">
            {tab === "drafts"
              ? "Conteúdos já gerados que ainda não foram enviados para revisão. Abra um para ajustar e enviar."
              : tab === "selected"
                ? "Referências que você escolheu em Pesquisar ou Vigiar com “Criar a partir daqui”."
                : "Oportunidades sugeridas pelo Radar a partir do acervo. Ainda precisam da sua escolha."}
          </p>
          <div className="ws-ideas">
            {tab === "drafts" && drafts.map((p) => (
              <article key={p.id}>
                <small className="label">{p.format} · {p.status === "Em conferência" ? "não passou na checagem" : p.status === "Ajustes" ? "ajustes pedidos" : "rascunho"}</small>
                <h2>{p.title}</h2>
                <p>{(p.body || "").replace(/[*#]/g, "").slice(0, 180)}</p>
                <div>
                  <button className="button secondary" onClick={() => setSelectedPiece(p.id)}>
                    Abrir e enviar para revisão <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
            {tab === "drafts" && !drafts.length && <p className="field-help">Nenhum conteúdo em andamento nesta marca.</p>}
            {(tab === "drafts" ? [] : tab === "selected" ? queue : suggestions).map((item) => {
              const source = sources.find((s) => s.id === item.sourceId);
              return (
                <article key={item.id}>
                  <small className="label">
                    {tab !== "selected"
                      ? "Sugestão do radar"
                      : item.origin === "suggestion"
                        ? `Sugestão de ${item.author || "colaborador"}`
                        : "Escolha da equipe"}
                  </small>
                  <h2>{item.title}</h2>
                  <p>{source?.summary || source?.text.slice(0, 180)}</p>
                  <div>
                    <button
                      className="button secondary"
                      disabled={!sourceValid(source)}
                      onClick={() =>
                        selectTopic(item.title, item.sourceId, {
                          ...item,
                          queueId: tab === "selected" ? item.id : undefined,
                          origin:
                            tab === "selected" ? item.origin : "recommendation",
                          topicId: item.topicId || item.id,
                        })
                      }
                    >
                      Usar ideia <ArrowRight size={16} />
                    </button>
                    {tab === "selected" && (
                      <button
                        className="text-button"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            writingQueue: s.writingQueue.filter(
                              (q) => q.id !== item.id,
                            ),
                          }))
                        }
                      >
                        Retirar
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {tab !== "drafts" && !(tab === "selected" ? queue : suggestions).length && (
            <div className="ws-empty">
              <Bookmark size={28} />
              <h2>
                {tab === "selected"
                  ? "Nenhuma ideia selecionada."
                  : "Sem sugestões disponíveis."}
              </h2>
              <p>
                Abra uma referência em Pesquisar e escolha “Criar a partir
                daqui”, ou comece uma nova ideia.
              </p>
              <button
                className="button secondary"
                onClick={() => goto("guardar")}
              >
                Pesquisar referências <ArrowRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
      {stage === "setup" && (
        <section className="ws-setup">
          <div className="ws-section-title">
            <div>
              <small className="label">2 · Criar</small>
              <h2>O que sua marca vai dizer?</h2>
              <p>
                Defina a intenção. A IA planeja, escreve e submete o texto a uma
                revisão editorial independente.
              </p>
            </div>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setStage("idea")}
            >
              <ArrowLeft size={15} />
              Trocar ideia
            </button>
          </div>
          <fieldset disabled={busy}>
            <label>
              Assunto
              <textarea
                aria-label="O que vamos comunicar?"
                rows={2}
                maxLength={180}
                value={brief.title}
                onChange={(e) => change("title", e.target.value)}
                placeholder="Ex.: como usar dados climáticos para decidir sobre risco rural"
              />
            </label>
            <label>
              Mensagem da marca
              <textarea
                rows={2}
                aria-label="Mensagem da marca"
                value={brief.offer || ""}
                onChange={(e) => change("offer", e.target.value)}
                placeholder={
                  packet.voice.positioning ||
                  "Qual benefício, ponto de vista ou solução sua marca quer comunicar?"
                }
              />
            </label>
            <div className="ws-brand-context">
              <b>{packet.brand.name}</b>
              <p>
                {packet.voice.positioning ||
                  "Complete a mensagem acima ou defina o posicionamento no Segundo cérebro."}
              </p>
              <a href="#app/cerebro/dna">Revisar contexto da marca</a>
            </div>
            <div className="field-pair">
              <label>
                Formato
                <select
                  aria-label="Formato"
                  value={brief.format}
                  onChange={(e) => change("format", e.target.value)}
                >
                  {FORMATS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
              <label>
                Versões
                <select
                  aria-label="Quantidade de versões"
                  value={settings.versionCount}
                  onChange={(e) =>
                    change("versionCount", Number(e.target.value))
                  }
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "versão" : "versões"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {settings.video && (
              <div className="ws-duration">
                <div className="field-pair">
                  <label>
                    Duração
                    <select
                      aria-label="Duração esperada"
                      value={settings.durationSeconds}
                      onChange={(e) =>
                        change("durationSeconds", Number(e.target.value))
                      }
                    >
                      {allowedDurations.map((n) => (
                        <option key={n} value={n}>
                          {durationLabel(n)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Entrega
                    <select
                      aria-label="Entrega do roteiro"
                      value={settings.scriptMode}
                      onChange={(e) => change("scriptMode", e.target.value)}
                    >
                      <option value="spoken">Falas completas</option>
                      <option value="outline">Estrutura por blocos</option>
                    </select>
                  </label>
                </div>
                <p>
                  {brief.format === "Podcast completo"
                    ? "Episódios a partir de 5 minutos. Para trechos curtos, use Corte de podcast. "
                    : ""}
                  {settings.scriptMode === "spoken"
                    ? `Meta aproximada de ${settings.targetWords.toLocaleString("pt-BR")} palavras. A IA deve concluir as frases, sem recortá-las para caber no tempo.`
                    : "Blocos e perguntas para orientar a gravação; não são falas completas."}
                </p>
              </div>
            )}
            <label>
              Referência
              <select
                aria-label="Referência do acervo"
                value={brief.source}
                onChange={(e) => change("source", e.target.value)}
              >
                <option value="">Escolha no acervo</option>
                {sources.filter(sourceValid).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            {picked && (
              <div className="ws-reference">
                <small className="label">Fundamentação · não é o anunciante</small>
                <p>{picked.summary || picked.text.slice(0, 240)}</p>
              </div>
            )}
            <details className="ws-options">
              <summary>Ajustar detalhes</summary>
              <label>
                Público
                <input
                  aria-label="Público"
                  value={brief.audience ?? packet.voice.audience}
                  onChange={(e) => change("audience", e.target.value)}
                />
              </label>
              <label>
                Objetivo
                <select
                  value={brief.objective || "Construir autoridade"}
                  onChange={(e) => change("objective", e.target.value)}
                >
                  {[
                    "Construir autoridade",
                    "Informar",
                    "Gerar conversa",
                    "Explicar uma oferta",
                    "Reaproveitar conhecimento",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label>
                Ideia central
                <textarea
                  rows={2}
                  aria-label="Tese / ideia central"
                  value={brief.thesis || ""}
                  onChange={(e) => change("thesis", e.target.value)}
                />
              </label>
              <label>
                Exemplo próprio
                <textarea
                  rows={2}
                  value={brief.experience || ""}
                  onChange={(e) => change("experience", e.target.value)}
                  placeholder="Uma experiência real que só sua marca pode acrescentar"
                />
              </label>
              <label>
                Próximo passo
                <input
                  value={brief.cta || ""}
                  onChange={(e) => change("cta", e.target.value)}
                  placeholder="Ex.: conheça a solução ou converse com a equipe"
                />
              </label>
              <div className="field-pair">
                <label>
                  Responsável
                  <input
                    value={brief.owner}
                    onChange={(e) => change("owner", e.target.value)}
                  />
                </label>
                <label>
                  Prazo
                  <input
                    type="date"
                    value={brief.deadline}
                    onChange={(e) => change("deadline", e.target.value)}
                  />
                </label>
              </div>
            </details>
          </fieldset>
          <ProviderTools
            packet={packet}
            onBusy={setBusy}
            onGenerated={(items) => {
              setGenerated(items);
              setSelected(0);
              setAudit(null);
              setSavedId(null);
              setStage("edit");
            }}
          />
          <div className="ws-manual">
            <button className="text-button" disabled={busy} onClick={skeleton}>
              <FileText size={16} />
              Escrever manualmente
            </button>
            <span>
              Abre uma estrutura para você preencher. Não simula uma geração por
              IA.
            </span>
          </div>
        </section>
      )}
      {stage === "edit" && draft && (
        <section className="ws-edit">
          <div className="ws-section-title">
            <div>
              <small className="label">3 · Revisar</small>
              <h2>O texto antes dos arquivos.</h2>
              <p>
                {brief.format} · {packet.brand.name} ·{" "}
                {settings.video
                  ? durationLabel(settings.durationSeconds) + " · "
                  : ""}
                {draft.mode === "provider"
                  ? "Redação por IA"
                  : draft.mode === "manual"
                    ? "Redação manual"
                    : "Estrutura para preencher"}
              </p>
            </div>
            <button className="text-button" onClick={() => setStage("setup")}>
              Editar orientação
            </button>
          </div>
          {draft.editorialReview &&
            (draft.editorialReview.passed === false ? (
              <div className="ws-review-note ws-review-pending" role="status">
                <p>
                  {draft.editorialReview.reviewFailed
                    ? "A revisão automática não concluiu. O texto foi guardado; revise antes de enviar:"
                    : <>O editor ainda aponta {draft.editorialReview.pending.length}{" "}
                      {draft.editorialReview.pending.length === 1 ? "ajuste" : "ajustes"} depois de{" "}
                      {draft.editorialReview.rounds - 1} {draft.editorialReview.rounds - 1 === 1 ? "reescrita" : "reescritas"} automáticas. Corrija antes de enviar para revisão:</>}
                </p>
                <ul>
                  {draft.editorialReview.pending.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="ws-review-note">
                <Check size={17} />
                Aprovado pelo editor crítico
                {draft.editorialReview.rounds > 1 ? ` após ${draft.editorialReview.rounds - 1} ${draft.editorialReview.rounds - 1 === 1 ? "reescrita" : "reescritas"}` : ""}.
                A conferência dos fatos e a aprovação humana continuam pendentes.
              </p>
            ))}
          {draft.warnings?.length > 0 && (
            <div className="ws-review-note ws-review-pending" role="status">
              <p>Avisos do roteiro:</p>
              <ul>
                {draft.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {generated.length > 1 && (
            <div className="ws-tabs" role="group" aria-label="Versões">
              {generated.map((v, i) => (
                <button
                  key={i}
                  aria-pressed={selected === i}
                  onClick={() => {
                    setSelected(i);
                    setAudit(null);
                    setSavedId(null);
                  }}
                >
                  {i + 1} · {v.strategy}
                </button>
              ))}
            </div>
          )}
          <label className="ws-editor-label">
            Conteúdo
            <textarea
              aria-label="Editar abordagem"
              rows={18}
              value={draft.body}
              onChange={(e) => {
                setGenerated((g) =>
                  g.map((v, i) =>
                    i === selected
                      ? {
                          ...v,
                          body: e.target.value,
                          mode: "manual",
                          localScaffold: false,
                          editorialReview: null,
                        }
                      : v,
                  ),
                );
                setAudit(null);
              }}
            />
          </label>
          <details className="ws-options">
            <summary>Referências e direção</summary>
            <p>{draft.visual}</p>
            <p>{draft.av}</p>
            {packet.sources.map((s) => (
              <p key={s.id}>
                <b>{s.title}</b> · {s.origin}
              </p>
            ))}
          </details>
          <div className="ws-actions">
            <button
              className="button secondary"
              onClick={() => {
                const result = runCouncil(state, {
                  ...activeBrief,
                  workspace: state.workspace,
                  brief: packet.brief,
                  sourceIds: draftSourceIds(),
                  body: draft.body,
                  revision: 1,
                });
                setAudit(result.piece.council);
              }}
            >
              Checar texto
            </button>
            <button className="button secondary" onClick={() => save(false)}>
              Salvar rascunho
            </button>
            <button className="button primary" onClick={() => save(true)}>
              Enviar para revisão <ArrowRight size={16} />
            </button>
          </div>
          {audit && <CouncilReport audit={audit} />}
          {savedId && (
            <button
              className="text-button"
              onClick={() => setSelectedPiece(savedId)}
            >
              Abrir rascunho salvo
            </button>
          )}
          <div className="ws-next">
            <div>
              <b>Imagem, vídeo e áudio</b>
              <p>
                O texto não cria arquivos de mídia automaticamente. A próxima
                etapa reúne as opções de produção.
              </p>
            </div>
            <button
              className="button secondary"
              onClick={() => { setStage("media"); prepareProduction(); }}
            >
              Ir para Mídia <Image size={16} />
            </button>
          </div>
        </section>
      )}
      {stage === "media" && draft && (
        <section className="ws-media">
          <div className="ws-section-title">
            <div>
              <small className="label">4 · Mídia</small>
              <h2>Dê forma ao conteúdo.</h2>
              <p>
                Imagens e vídeos usam uma conexão e créditos do provedor. Nenhum
                arquivo é gerado apenas por escrever o roteiro.
              </p>
            </div>
            <button className="text-button" onClick={() => setStage("edit")}>
              Voltar ao texto
            </button>
          </div>
          <div className="ws-media-status">
            <p>
              <b>Texto:</b>{" "}
              {draft.localScaffold
                ? "estrutura ainda incompleta"
                : "rascunho; aprovação humana pendente"}
            </p>
            <p>
              <b>Imagem e vídeo:</b> gere abaixo e baixe os arquivos no
              histórico da sua conta.
            </p>
            <p>
              <b>Áudio:</b> use as falas como roteiro para gravação. Síntese de
              voz ainda não está integrada.
            </p>
          </div>
          {preparing && <p className="field-help" role="status">Preparando a direção visual e o SEO deste texto…</p>}
          {prepError && <p className="form-error" role="alert">{prepError} <button className="text-button" onClick={prepareProduction}>Tentar de novo</button></p>}
          {issues.length ? (
            <div className="ws-empty">
              <h3>Conclua o texto primeiro.</h3>
              <p>{issues.map((i) => i.message).join(" ")}</p>
              <button
                className="button secondary"
                onClick={() => setStage("edit")}
              >
                Revisar texto
              </button>
            </div>
          ) : (
            <MediaStudio
              key={`${brief.handoffKey || brief.title}-${draft.visual ? "visual" : "texto"}`}
              initialPrompt={draft.visual || draft.body}
            />
          )}
        </section>
      )}
    </div>
  );
}
