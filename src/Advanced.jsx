import { WritingStudio } from './WritingStudio';
import { ProviderTools } from "./ProviderTools";
import { SourceRole } from './SourceRole';
import { RadarAnalysis } from './RadarAnalysis';
import { PLAYBOOKS } from './playbooks.mjs';
import { productionSettings, DURATION_OPTIONS, durationLabel, scriptTiming } from './production.mjs';
import { BrandDNA } from "./BrandDNA";
import { CampaignBrief } from "./Campaigns";
import { SuggestionInbox } from "./SuggestionInbox";
import React, { useContext, useEffect, useState } from "react";
import {
  ArrowRight,
  Plus,
  Radio,
  Settings,
  Play,
  Search,
  Check,
  X,
  Clock,
  ExternalLink,
  Users,
  Layers,
  Download,
  ShieldCheck,
  SlidersHorizontal,
  Bookmark,
  Network,
  ChevronRight,
} from "lucide-react";
import { AppContext } from "./context";
import {
  AGENTS,
  STAGES,
  FORMATS,
  assertAdmin,
  assertEditor,
  sourceValid,
  saveMonitor,
  safeUrl,
  validateRadar,
  nextRadarRun,
  rankedTopics,
  runLocalRadar,
  contextPacket,
  productionVariants,
  runCouncil,
  executionRecord,
  mergeCollection,
} from "./operations.mjs";
import { createPiece, transition, planKanbanMove, BOARD_COLUMNS, boardColumn, STATUS_DETAIL } from "./workflow.mjs";
import { workspaceList } from './account-state.mjs';
const useApp = () => useContext(AppContext);
const fmt = (d) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Ainda não executado";
const exportFile = (name, content, type = "application/json") => {
  const url = URL.createObjectURL(
    new Blob(
      [
        typeof content === "string"
          ? content
          : JSON.stringify(content, null, 2),
      ],
      { type },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function Heading({ title, text, children }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
function Tabs({ value, onChange, items, label }) {
  return (
    <div className="r-tabs" role="tablist" aria-label={label}>
      {items.map(([id, name]) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === id}
          tabIndex={value === id ? 0 : -1}
          key={id}
          onClick={() => onChange(id)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
function Note({ children }) {
  return (
    <div className="r-note">
      <ShieldCheck size={19} />
      <p>{children}</p>
    </div>
  );
}
function runSafely(fn, notify) {
  try {
    fn();
  } catch (e) {
    notify(e.message, true);
  }
}

export function Radar() {
  const { state, setState, workspace, notify, selectTopic, goto } = useApp();
  const [tab, setTab] = useState("pautas");
  const [category, setCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [onlyHot, setOnlyHot] = useState(false);
  const [busy, setBusy] = useState(false);
  const topics = rankedTopics(state);
  const config = state.radar[state.workspace];
  useEffect(() => {
    let alive = true;
    const receive = () =>
      fetch("/api/collected?workspace=" + state.workspace)
        .then((r) => r.json())
        .then((data) => {
          if (alive && Array.isArray(data.sources) && Array.isArray(data.runs))
            setState((s) => mergeCollection(s, data));
        })
        .catch(() => {});
    receive();
    const timer = setInterval(receive, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [state.workspace]);
  const run = () => {
    setState((s) => runLocalRadar(s));
    notify("Acervo reclassificado com os pesos atuais.");
  };
  const ingest = async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: state.workspace,
          sources: state.monitors.filter(
            (m) => m.workspace === state.workspace && m.active,
          ),
        }),
      });
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw new Error(
          "Inicie o serviço local com npm run dev:full para consultar URLs.",
        );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setState((s) =>
        mergeCollection(s, {
          sources: data.sources,
          runs: data.run ? [data.run] : [],
        }),
      );
      notify(
        `${data.sources.length} fontes atualizadas; ${data.errors.length} sem acesso. Confira o histórico.`,
      );
    } catch (e) {
      notify(e.message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Heading
        title="O próximo assunto chega até você."
        text="Os canais e referências que você acompanha viram ideias priorizadas para a sua marca. Escolha uma e leve para a escrita."
      >
        <div className="r-actions">
          <button className="button secondary" onClick={run}>
            <Radio size={17} />
            Reclassificar acervo
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              !state.monitors.some(
                (m) => m.workspace === state.workspace && m.active,
              )
            }
            onClick={ingest}
          >
            {busy ? "Consultando…" : "Buscar atualizações"}
            <ArrowRight size={17} />
          </button>
        </div>
      </Heading>
      <Tabs
        label="Radar"
        value={tab}
        onChange={setTab}
        items={[
          ["pautas", "Ideias"],
          ["sugestoes", "Sugestões"],
          ["regras", "Ajustes"],
          ["historico", "Execuções"],
        ]}
      />
      {tab === "pautas" && (
        <>
          <RadarAnalysis />
          <div className="r-stat-strip">
            <div>
              <b>{topics.length}</b>
              <span>ideias no acervo</span>
            </div>
            <div>
              <b>
                {
                  topics.filter(
                    (t) =>
                      (t.strategic || t.score >= config.threshold) && !t.blocked && !t.duplicate,
                  ).length
                }
              </b>
              <span>prioridades estratégicas e sinais em destaque</span>
            </div>
            <div>
              <b>{topics.filter((t) => t.duplicate).length}</b>
              <span>já trabalhadas em 60 dias</span>
            </div>
            <div>
              <b>{config.enabled ? "Ativa" : "Pausada"}</b>
              <span>rotina de curadoria local</span>
            </div>
          </div>
          <div className="r-filter">
            <label className="search-input">
              <Search size={17} />
              <input
                aria-label="Buscar ideias"
                placeholder="Buscar ideias…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              aria-label="Categoria da ideia"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "Todas",
                "Acervo próprio",
                "Próprio",
                "Concorrente",
                "Referência",
                "Pesquisa aberta",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={onlyHot}
                onChange={(e) => setOnlyHot(e.target.checked)}
              />
              Estratégicas e sinais em destaque
            </label>
          </div>
          <div className="r-topic-grid">
            {topics
              .filter(
                (t) =>
                  (category === "Todas" || t.category === category) &&
                  t.title.toLowerCase().includes(search.toLowerCase()) &&
                  (!onlyHot || t.strategic || t.score >= config.threshold),
              )
              .map((t) => (
                <Topic
                  key={t.id}
                  topic={t}
                  onSelect={() =>
                    selectTopic(t.title, t.sourceId, {
                      origin: "radar",
                      topicId: t.id,
                      audience: t.audience,
                      thesis: t.thesis || '',
                      angle: t.angle || '',
                      cta: t.cta || '',
                    })
                  }
                />
              ))}
          </div>
          {!topics.length && (
            <div className="empty-state">
              <Radio />
              <h2>O radar começa pelas fontes.</h2>
              <p>
                Importe uma referência em Pesquisar. O Radar usa esse mesmo acervo.
              </p>
              <button
                className="button primary"
                onClick={() => goto("guardar")}
              >
                Pesquisar referências
              </button>
            </div>
          )}
          <Note>
            O Radar organiza oportunidades de conteúdo; não avalia a qualidade da empresa ou do produto.
            Marque suas soluções como “Produto ou solução própria” para priorizá-las.
            Os sinais automáticos são heurísticos: novidade e palavras em comum não substituem a estratégia da equipe.
          </Note>
        </>
      )}
      
      {tab === "sugestoes" && <SuggestionInbox />}
      {tab === "regras" && <RadarSettings />}
      {tab === "historico" && (
        <section className="r-panel">
          <h2>Histórico do radar</h2>
          {state.radarRuns
            .filter((r) => r.workspace === state.workspace)
            .map((r) => (
              <article className="r-log" key={r.id}>
                <Radio size={19} />
                <div>
                  <b>
                    {r.mode === "web"
                      ? "Consulta de páginas públicas"
                      : "Curadoria local"}{" "}
                    · {r.found} fontes e ideias
                  </b>
                  <p>{r.detail}</p>
                  <small>
                    {fmt(r.at)}
                    {r.scheduled ? " · Rotina agendada" : ""}
                  </small>
                </div>
              </article>
            ))}
          {!state.radarRuns.some((r) => r.workspace === state.workspace) && (
            <p>
              Nenhuma execução registrada. Execute a curadoria ou consulte as
              fontes cadastradas.
            </p>
          )}
        </section>
      )}
    </>
  );
}
function Topic({ topic: t, onSelect }) {
  const { state } = useApp();
  const source = state.sources.find(s => s.id === t.sourceId);
  return (
    <article className="r-topic">
      <div className="r-topic-top">
        <span>{t.category}</span>
        {t.strategic ? <b className="r-priority">Prioridade estratégica</b> : <span className="r-signal-label">{t.mode === 'provider' ? 'Análise editorial por IA' : 'Sinal automático'} <b>{t.score.toFixed(1)}/10</b></span>}
      </div>
      <h2>{t.title}</h2>
      <p>{t.strategic ? 'Solução ou conteúdo oficial definido pela equipe. Sua importância estratégica independe da novidade e da pontuação textual.' : t.reason}</p>
      {source?.summary && <p className="r-topic-summary">{source.summary}</p>}

      <details>
        <summary>Como os sinais foram calculados?</summary>
        <p>Sinal ponderado: {t.score}/10. {t.mode === 'provider' ? `Análise do significado pelo modelo ${t.model}.` : 'Comparação textual local, sem avaliação semântica por IA.'} A data de importação não é tratada como data de publicação. Sem publicação identificada, novidade fica neutra (5/10).</p>
        <dl className="r-breakdown">
          {[
            ["relevance", "Correspondência temática"],
            ["novelty", "Novidade"],
            ["brandFit", "Palavras em comum com a marca"],
            ["risk", "Risco (fora da média)"],
          ].map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{t.breakdown[key]}/10</dd>
            </div>
          ))}
        </dl>
      </details>
      {t.duplicate && (
        <p className="r-warning">
          Já trabalhada: {t.duplicate.title}. Considere outro ângulo.
        </p>
      )}
      {t.blocked && (
        <p className="form-error">
          Fonte inválida ou risco elevado. Resolva antes da escrita.
        </p>
      )}
      <button
        className="button secondary"
        disabled={t.blocked}
        onClick={onSelect}
      >
        Criar a partir daqui
        <ArrowRight size={16} />
      </button>
    </article>
  );
}
export function MonitorSources() {
  const { state, setState, notify } = useApp();
  const empty = {
    name: "",
    url: "",
    category: "Referência",
    kind: "Site",
    notes: "",
    active: true,
  };
  const [form, setForm] = useState(empty);
  const [listDelete, setDelete] = useState(null);
  return (
    <div className="r-two-columns">
      <section className="r-panel">
        <h2>{form.id ? "Editar acompanhamento" : "Acompanhar referência"}</h2>
        <p>Escolha algo que já está no acervo para consultar novas versões. Isso não importa uma segunda cópia.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSafely(() => {
              setState(saveMonitor(state, form));
              setForm(empty);
              notify("Fonte salva nesta marca.");
            }, notify);
          }}
        >
          {!form.id && <label>Referência para acompanhar<select required aria-label="Referência para acompanhar" value={form.sourceId||''} onChange={e=>{const source=state.sources.find(s=>s.id===e.target.value);setForm(source?{...empty,sourceId:source.id,name:source.title,url:source.url}:empty);}}><option value="">Escolha no acervo</option>{state.sources.filter(s=>(s.workspace===state.workspace||s.shared)&&s.url&&sourceValid(s)).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>}
          <label>
            Nome
            <input
              required
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            URL
            <input
              required
              type="url"
              readOnly
              placeholder="https://…"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </label>
          <div className="field-pair">
            <label>
              Categoria
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {[
                  "Próprio",
                  "Concorrente",
                  "Referência",
                  "Pesquisa aberta",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Tipo
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                {[
                  "Site",
                  "RSS",
                  "YouTube",
                  "Instagram",
                  "LinkedIn",
                  "TikTok",
                  "X",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            O que observar?
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Temas, perguntas, palavras-chave…"
            />
          </label>
          <div className="r-actions">
            <button className="button primary">
              Salvar acompanhamento
              <Check size={17} />
            </button>
            {form.id && (
              <button
                type="button"
                className="button secondary"
                onClick={() => setForm(empty)}
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        <Note>
          Consulta web requer o serviço local. Redes com login e transcrições de
          vídeo precisam de conectores próprios; o cadastro não implica que já
          foram coletadas.
        </Note>
      </section>
      <section className="r-panel">
        <h2>Referências acompanhadas</h2>
        {state.monitors
          .filter((m) => m.workspace === state.workspace)
          .map((m) => (
            <article className="r-monitor" key={m.id}>
              <div>
                <small>
                  {m.category} · {m.kind}
                </small>
                <h3>{m.name}</h3>
                <a href={m.url} target="_blank" rel="noreferrer">
                  {m.url}
                  <ExternalLink size={13} />
                </a>
                <p>{m.notes}</p>
              </div>
              <div className="r-actions">
                <button className="text-button" onClick={() => setForm(m)}>
                  Editar
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    runSafely(() => {
                      assertEditor(state);
                      setState((s) => ({
                        ...s,
                        monitors: s.monitors.map((x) =>
                          x.id === m.id ? { ...x, active: !x.active } : x,
                        ),
                      }));
                    }, notify)
                  }
                >
                  {m.active ? "Pausar" : "Ativar"}
                </button>
                <button
                  className="text-button danger-text"
                  onClick={() => setDelete(m.id)}
                >
                  Remover
                </button>
              </div>
              {listDelete === m.id && (
                <div className="r-warning">
                  <p>
                    Remover o monitor? As referências já coletadas permanecem no
                    acervo.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() =>
                      runSafely(() => {
                        assertEditor(state);
                        setState((s) => ({
                          ...s,
                          monitors: s.monitors.filter((x) => x.id !== m.id),
                        }));
                        setDelete(null);
                      }, notify)
                    }
                  >
                    Confirmar remoção
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setDelete(null)}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </article>
          ))}
        {!state.monitors.some((m) => m.workspace === state.workspace) && (
          <p>
            Nenhum acompanhamento ativo. A importação de links e arquivos fica em “Adicionar ao acervo”.
          </p>
        )}
      </section>
    </div>
  );
}
function RadarSettings() {
  const { state, setState, notify } = useApp();
  const [config, setConfig] = useState(state.radar[state.workspace]);
  const total = Object.values(config.weights).reduce(
    (s, n) => s + Number(n),
    0,
  );
  const admin = state.role === "Administrador";
  const [backend, setBackend] = useState("");
  return (
    <div className="r-two-columns">
      <section className="r-panel">
        <h2>Fórmula de pontuação</h2>
        <p>
          A média ponderada gera a nota de 0 a 10. Alterações são restritas ao
          Administrador.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSafely(() => {
              assertAdmin(state);
              validateRadar(config);
              setState((s) => ({
                ...s,
                radar: {
                  ...s.radar,
                  [state.workspace]: {
                    ...config,
                    nextRun: config.enabled ? nextRadarRun(config) : null,
                  },
                },
              }));
              notify(
                "Critérios e rotina salvos. As ideias foram reclassificadas.",
              );
            }, notify);
          }}
        >
          <fieldset disabled={!admin}>
            <legend className="sr-only">Pesos e rotina do radar</legend>
            {[
              ["relevance", "Relevância econômica / processual"],
              ["novelty", "Novidade / momento"],
              ["brandFit", "Encaixe com a ficha de voz"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <div className="r-range">
                  <input
                    aria-label={label}
                    type="range"
                    min="0"
                    max="100"
                    value={config.weights[key]}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        weights: {
                          ...config.weights,
                          [key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <input
                    aria-label={`${label} em porcentagem`}
                    type="number"
                    min="0"
                    max="100"
                    value={config.weights[key]}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        weights: {
                          ...config.weights,
                          [key]: Number(e.target.value),
                        },
                      })
                    }
                  />
                  <span>%</span>
                </div>
              </label>
            ))}
            <p className={total === 100 ? "r-success" : "form-error"}>
              Total: {total}% de 100%
            </p>
            <label>
              Nota mínima de destaque
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={config.threshold}
                onChange={(e) =>
                  setConfig({ ...config, threshold: Number(e.target.value) })
                }
              />
            </label>
            <h3>Quando executar</h3>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) =>
                  setConfig({ ...config, enabled: e.target.checked })
                }
              />
              Ativar rotina de curadoria local
            </label>
            <label>
              Frequência
              <select
                aria-label="Frequência"
                value={config.frequency}
                onChange={(e) =>
                  setConfig({ ...config, frequency: e.target.value })
                }
              >
                <option value="minutes">A cada X minutos</option>
                <option value="daily">Todos os dias</option>
                <option value="weekly">Dias da semana</option>
                <option value="monthly">Mensal</option>
              </select>
            </label>
            {config.frequency === "minutes" ? (
              <label>
                Intervalo em minutos
                <input
                  type="number"
                  min="5"
                  max="43200"
                  value={config.minutes}
                  onChange={(e) =>
                    setConfig({ ...config, minutes: Number(e.target.value) })
                  }
                />
              </label>
            ) : (
              <label>
                Horário local do dispositivo
                <input
                  type="time"
                  required
                  value={config.time}
                  onChange={(e) =>
                    setConfig({ ...config, time: e.target.value })
                  }
                />
              </label>
            )}
            {config.frequency === "weekly" && (
              <div className="r-weekdays">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                  (n, i) => (
                    <label key={n}>
                      <input
                        type="checkbox"
                        checked={config.weekdays.includes(i)}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            weekdays: e.target.checked
                              ? [...config.weekdays, i]
                              : config.weekdays.filter((d) => d !== i),
                          })
                        }
                      />
                      {n}
                    </label>
                  ),
                )}
              </div>
            )}
            {config.frequency === "monthly" && (
              <label>
                Dia do mês (1–28)
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={config.monthDay}
                  onChange={(e) =>
                    setConfig({ ...config, monthDay: Number(e.target.value) })
                  }
                />
              </label>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={config.notifyHot}
                onChange={(e) =>
                  setConfig({ ...config, notifyHot: e.target.checked })
                }
              />
              Avisar no aplicativo quando houver ideias acima da nota mínima
            </label>
            <label>
              Escopo da rotina
              <select
                value={config.scope}
                onChange={(e) =>
                  setConfig({ ...config, scope: e.target.value })
                }
              >
                <option value="workspace">Somente esta marca</option>
                <option value="all">Todos os espaços</option>
              </select>
            </label>
            <button className="button primary" disabled={total !== 100}>
              Salvar critérios e rotina
              <Check size={16} />
            </button>
          </fieldset>
        </form>
        {!admin && (
          <Note>
            Troque para o papel Administrador no topo para editar estas regras.
          </Note>
        )}
      </section>
      <section className="r-panel">
        <div className="r-icon-heading">
          <Clock />
          <h2>Execução transparente</h2>
        </div>
        <dl className="r-breakdown">
          <div>
            <dt>Última curadoria</dt>
            <dd>{fmt(state.radar[state.workspace].lastRun)}</dd>
          </div>
          <div>
            <dt>Próxima curadoria</dt>
            <dd>
              {state.radar[state.workspace].nextRun
                ? fmt(state.radar[state.workspace].nextRun)
                : "Rotina pausada"}
            </dd>
          </div>
        </dl>
        <Note>
          A rotina local reclassifica o acervo enquanto este aplicativo está
          aberto. Ao retornar, executa uma vez se estiver atrasada. Para
          consultar sites mesmo com a aba fechada, ative a coleta no serviço
          local abaixo.
        </Note>
        <h3>Coleta web agendada</h3>
        <p>
          Usa a frequência salva e as URLs ativas desta marca. O processo local
          precisa permanecer ligado; a rotina não roda com o computador
          desligado.
        </p>
        <button
          className="button secondary"
          disabled={!admin}
          onClick={async () => {
            try {
              assertAdmin(state);
              const saved = state.radar[state.workspace];
              validateRadar(saved);
              const r = await fetch("/api/schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspace: state.workspace,
                  config: saved,
                  sources: state.monitors.filter(
                    (m) => m.workspace === state.workspace && m.active,
                  ),
                }),
              });
              if (!r.headers.get("content-type")?.includes("application/json"))
                throw new Error(
                  "Serviço local indisponível. Execute npm run dev:full.",
                );
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              setBackend(d.message);
              notify(d.message);
            } catch (e) {
              notify(e.message, true);
            }
          }}
        >
          Sincronizar rotina com o serviço
        </button>
        {backend && <p role="status">{backend}</p>}
        <p className="field-help">
          Salve as alterações antes de sincronizar. Pausar a rotina e
          sincronizar também interrompe a coleta no serviço.
        </p>
      </section>
    </div>
  );
}

export function Kanban() {
  const { state, setState, pieces, setSelectedPiece, notify, goto, doAction, setModal } = useApp();
  const [pending, setPending] = useState(null);
  const [over, setOver] = useState("");
  const [view, setView] = useState("etapa");
  const [owner, setOwner] = useState("Todos");
  const [search, setSearch] = useState("");
  const list = pieces.filter(
    (p) =>
      (owner === "Todos" || p.owner === owner) &&
      p.title.toLowerCase().includes(search.toLowerCase()),
  );
  const groups =
    view === "etapa"
      ? BOARD_COLUMNS.map((column) => ({
          name: column.name,
          items: list.filter((p) => column.statuses.includes(p.status)),
        }))
      : [...new Set(list.map((p) => p.owner))].map((name) => ({
          name,
          items: list.filter((p) => p.owner === name),
        }));
  // Every drop goes through the workflow rules: review, approval and schedule keep their gates.
  const move = (id, columnName) =>
    runSafely(() => {
      const p = state.pieces.find((x) => x.id === id);
      const column = BOARD_COLUMNS.find((c) => c.name === columnName);
      if (!p || !column || boardColumn(p.status) === column) return;
      if (p.workspace !== state.workspace)
        throw new Error("Abra esta marca para movimentar o conteúdo.");
      const plan = planKanbanMove(state, id, column.target);
      if (plan.kind === "apply") doAction(id, plan.action, plan.payload);
      else if (plan.kind === "confirm") setPending({ id, ...plan });
      else if (plan.need === "schedule") setModal({ type: "schedule", id });
      else if (plan.kind === "needs") {
        setSelectedPiece(id);
        notify(plan.need === "reason" ? "Explique o ajuste necessário na revisão do conteúdo." : "Registre o link da publicação no detalhe do conteúdo.");
      }
    }, notify);
  return (
    <>
      <Heading
        title="Todo o trabalho, à vista."
        text="Em que etapa está cada conteúdo, quem cuida dele e até quando."
      >
        <button className="button primary" onClick={() => goto("escrever")}>
          Novo conteúdo
          <Plus size={17} />
        </button>
      </Heading>
      <Tabs
        label="Visão do Kanban"
        value={view}
        onChange={setView}
        items={[
          ["etapa", "Por etapa"],
          ["pessoa", "Por pessoa"],
        ]}
      />
      <div className="r-filter">
        <label className="search-input">
          <Search size={17} />
          <input
            aria-label="Buscar no Kanban"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar conteúdo…"
          />
        </label>
        <select
          aria-label="Responsável no Kanban"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        >
          {["Todos", ...new Set(state.pieces.map((p) => p.owner))].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <span>{list.length} conteúdos</span>
      </div>
      {pending && (
        <div className="r-kanban-confirm" role="alertdialog" aria-label="Confirmar movimento">
          <p>{pending.message}</p>
          <button className="button primary" onClick={() => { doAction(pending.id, pending.action, pending.payload); setPending(null); }}>
            Voltar e desfazer aprovação
          </button>
          <button className="button secondary" onClick={() => setPending(null)}>
            Cancelar
          </button>
        </div>
      )}
      {view === "etapa" && (
        <ol className="stage-rail board-rail" aria-label="Etapas do quadro">
          {groups.map((g, i) => (
            <li key={g.name} className={g.items.length ? "has-items" : ""}>
              <button
                type="button"
                onClick={() => document.getElementById(`kanban-col-${i}`)?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" })}
                aria-label={`${g.name}: ${g.items.length} ${g.items.length === 1 ? "conteúdo" : "conteúdos"}. Ir para a coluna`}
              >
                {g.name}
                <span>{g.items.length}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div
        className="r-kanban"
        tabIndex={0}
        aria-label="Quadro de conteúdos; role horizontalmente para ver as etapas"
      >
        {groups.map((g, i) => (
          <section
            id={`kanban-col-${i}`}
            className={`r-kanban-column ${over === g.name ? "is-over" : ""}`}
            key={g.name}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => view === "etapa" && setOver(g.name)}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(""); }}
            onDrop={(e) => {
              e.preventDefault();
              setOver("");
              if (view === "etapa")
                move(e.dataTransfer.getData("text/plain"), g.name);
            }}
          >
            {/* By stage, the rail above carries the counts; by person, the header keeps its own. */}
            <h2>
              {g.name}
              {view !== "etapa" && <span>{g.items.length}</span>}
            </h2>
            {g.items.map((p) => (
              <article
                className="r-kanban-card"
                key={p.id}
                draggable={view === "etapa" && p.status !== "Publicado"}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
              >
                <small>
                  {p.format} · v{p.revision}
                </small>
                <button
                  className="r-card-title"
                  onClick={() => {
                    setSelectedPiece(p.id);
                  }}
                >
                  {p.title}
                </button>
                {view !== "etapa" && <span className="r-pill">{boardColumn(p.status).name}</span>}
                {view === "etapa" && STATUS_DETAIL[p.status] && <span className="r-pill r-pill-detail">{STATUS_DETAIL[p.status]}</span>}
                <p>
                  {p.owner} ·{" "}
                  {p.deadline
                    ? new Date(p.deadline + "T12:00:00").toLocaleDateString(
                        "pt-BR",
                      )
                    : "Sem prazo"}
                </p>
                {p.deadline &&
                  new Date(p.deadline + "T23:59:59") < new Date() &&
                  p.status !== "Publicado" && (
                    <strong className="form-error">Prazo vencido</strong>
                  )}
                <small>
                  {Math.floor(
                    (Date.now() -
                      new Date(p.stageAt || p.createdAt).getTime()) /
                      3600000,
                  )}
                  h nesta etapa
                </small>
                {p.council && (
                  <small>
                    {p.council.mode==='local'?'Checagem básica':'Revisão por IA'} · {p.council.standardVersion!==2?'refazer':p.council.passed?'revisão humana pendente':'ajustes pendentes'}
                  </small>
                )}
                {view === "etapa" && p.status !== "Publicado" && (
                  <select
                    aria-label={`Mover ${p.title}`}
                    value={boardColumn(p.status).name}
                    onChange={(e) => move(p.id, e.target.value)}
                  >
                    {BOARD_COLUMNS.map((c) => (
                      <option key={c.name}>{c.name}</option>
                    ))}
                  </select>
                )}
              </article>
            ))}
            {!g.items.length && (
              <p className="r-column-empty">Sem conteúdos nesta etapa.</p>
            )}
          </section>
        ))}
      </div>
      <Note>
        Arraste o card ou use o seletor para mudar de etapa. Revisão, aprovação e agenda seguem as mesmas regras do detalhe do conteúdo; voltar um conteúdo aprovado desfaz a aprovação.
        Conselho, aprovação humana e agenda preservam os bloqueios da versão.
      </Note>
    </>
  );
}

export function VoiceSettings() {
  const { state, setState, notify, workspace } = useApp();
  const [voice, setVoice] = useState(state.voices[state.workspace]);
  return (
    <><BrandDNA onVoice={dna => setVoice(v => ({ ...v, ...Object.fromEntries(['tone', 'audience', 'positioning', 'pillars', 'say', 'avoid', 'examples', 'checklist'].filter(k => dna[k]?.trim()).map(k => [k, dna[k]])) }))} /><section className="r-panel r-voice">
      <Heading
        title="Ficha de voz"
        text={`O que torna o conteúdo reconhecível como ${workspace.name}.`}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSafely(() => {
            assertAdmin(state);
            if (!voice.tone.trim() || !voice.audience.trim())
              throw new Error("Preencha voz e público.");
            setState((s) => ({
              ...s,
              voices: { ...s.voices, [state.workspace]: voice },
            }));
            notify("Ficha salva. As próximas criações usarão este contexto.");
          }, notify);
        }}
      >
        <fieldset disabled={state.role !== "Administrador"}>
          <legend className="sr-only">Ficha de voz editável</legend>
          <div className="r-two-columns">
            {[
              ["tone", "Tom de voz"],
              ["audience", "Público e dores"],
              ["positioning", "Posicionamento e ponto de vista"],
              ["pillars", "Pilares editoriais (um por linha)"],
              ["say", "O que dizemos / preferimos"],
              ["avoid", "Expressões que evitamos (uma por linha)"],
              ["examples", "Exemplos de escrita aprovados"],
              ["checklist", "Checklist de revisão (um por linha)"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea
                  aria-label={label}
                  rows={key === "examples" ? 5 : 3}
                  value={voice[key]}
                  maxLength={6000}
                  onChange={(e) =>
                    setVoice({ ...voice, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <button className="button primary">
            Salvar ficha de voz
            <Check size={17} />
          </button>
        </fieldset>
      </form>
      {state.role !== "Administrador" && (
        <p className="field-help">
          O Administrador pode editar a ficha. Os demais papéis podem
          consultá-la.
        </p>
      )}
    </section></>
  );
}

export function CouncilReport({ audit }) {
  return (
    <div className="r-council">
      <div className="r-council-header">
        <div>
          <small>
            {audit.mode === 'local' ? 'CHECAGEM BÁSICA' : 'REVISÃO EDITORIAL · IA'}
          </small>
          <h3>
            {audit.mode==='local'&&audit.standardVersion!==2?'Refaça a checagem desta versão':audit.passed?'Checagem concluída · revisão humana pendente':'Corrigir antes de seguir'}
          </h3>
        </div>
        {audit.mode!=='local' && <b>
          {audit.score}
          <small>/5</small>
        </b>}
      </div>
      <p>{audit.summary}</p>
      <div className="r-council-checks">
        {audit.checks.map((c) => (
          <div key={c.name}>
            <span className={c.blocker ? "form-error" : "r-success"}>
              {audit.mode==='local' ? c.blocker?'Pendente':'Checado' : `${c.score}/5`}
            </span>
            <div>
              <b>{c.name}</b>
              <small>{c.lens}</small>
              <p>{c.reason}</p>
            </div>
          </div>
        ))}
      </div>
      {audit.rounds?.length > 1 && (
        <details>
          <summary>{audit.rounds.length} rodadas de avaliação e ajuste</summary>
          {audit.rounds.map((r) => (
            <p key={r.round}>
              Rodada {r.round}: {r.score}/5 · versão {r.revision} ·{" "}
              {r.passed ? "liberada" : "pendente"}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}
export function PieceCouncil({ piece }) {
  const { state, setState, notify } = useApp();
  return (
    <div className="r-piece-council">
      {piece.council && <CouncilReport audit={piece.council} />}
      <button
        className="button secondary"
        disabled={
          !["Editor", "Administrador"].includes(state.role) ||
          ["Aprovado", "Agendado", "Publicado"].includes(piece.status)
        }
        onClick={() =>
          runSafely(() => {
            assertEditor(state);
            const result = runCouncil(state, piece);
            setState((s) => ({
              ...s,
              pieces: s.pieces.map((p) =>
                p.id === piece.id ? result.piece : p,
              ),
              events: [
                {
                  id: crypto.randomUUID(),
                  workspace: piece.workspace,
                  pieceId: piece.id,
                  title: piece.title,
                  event: `Checagem básica: ${result.piece.council.passed ? "revisão humana pendente" : "ajustes necessários"}.`,
                  action: "council",
                  author: state.role,
                  revision: result.piece.revision,
                  at: new Date().toISOString(),
                  before:
                    result.piece.body !== piece.body ? piece.body : undefined,
                  after:
                    result.piece.body !== piece.body
                      ? result.piece.body
                      : undefined,
                },
                ...s.events,
              ],
            }));
            notify(
              result.piece.council.passed
                ? "Refino concluído. Envie para a sua aprovação."
                : "O refino encontrou pontos a ajustar. Confira os critérios.",
            );
          }, notify)
        }
      >
        <ShieldCheck size={17} />
        Checar texto
      </button>
      {!piece.council && (
        <p className="field-help">
          Refine esta versão antes do envio ao aprovador.
        </p>
      )}
      {piece.delivery && <Delivery data={piece.delivery} />}
    </div>
  );
}
function Delivery({ data }) {
  return (
    <details className="r-delivery">
      <summary>
        <Layers size={17} />
        Pacote de produção: visual, audiovisual e SEO/GEO
      </summary>
      <div className="r-two-columns">
        <div>
          <h3>Direção visual</h3>
          <p>{data.visual}</p>
          <h3>Áudio e vídeo</h3>
          <p>{data.av}</p>
        </div>
        <div>
          <h3>SEO/GEO & metadados</h3>
          <p>
            <b>Título:</b> {data.seo?.title}
          </p>
          <p>{data.seo?.description}</p>
          <p>
            <b>Tags:</b> {data.seo?.tags?.join(", ")}
          </p>
          <p>
            <b>Texto alternativo:</b> {data.seo?.alt}
          </p>
          <p>
            <b>Entidades / fontes:</b> {data.seo?.entities?.join("; ")}
          </p>
        </div>
      </div>
      {data.testPlan && <p className="field-help"><b>Plano de teste:</b> {data.testPlan}</p>}
      {Array.isArray(data.assetPlan) && <details><summary>Referências e ativos para produção</summary>{data.assetPlan.map((asset,i)=><p key={asset.id || i}><b>{asset.id} · {asset.kind}</b><br/>{asset.description}<br/>{asset.reference}</p>)}</details>}
      {Array.isArray(data.shotList) && <details><summary>Lista de cenas e continuidade</summary>{data.shotList.map((shot,i)=><article className="shot-plan" key={shot.id || i}><b>{shot.id} · {shot.duration}s</b><p>{shot.prompt}</p><small>{shot.continuity}</small><p>Áudio: {shot.audio}</p></article>)}</details>}
      <button
        className="button secondary"
        onClick={() => exportFile("memorable-pacote-producao.json", data)}
      >
        <Download size={17} />
        Exportar pacote
      </button>
    </details>
  );
}

export function Squad() {
  const { state, setState, notify } = useApp();
  const [config, setConfig] = useState(state.agentConfig);
  return (
    <>
      <Heading
        title="Um time de especialistas para a sua marca."
        text="Pesquisa, estratégia, redação, roteiro e revisão trabalham juntos, com as fontes, a voz e as decisões da sua marca."
      />
      <Note>
        Em Escrever, escolha o modo local ou os agentes com Claude, OpenAI ou Gemini conectados. O time compartilha fontes, contexto da marca e critérios validados. Imagens e vídeos são gerados separadamente no estúdio de mídia.
      </Note>
      <section className="r-panel agent-method"><h2>Como o time trabalha</h2><p>Pesquisa com intenção, contribuição própria, referências consistentes e revisão humana. Os métodos orientam os prompts usados pelos agentes.</p><div>{PLAYBOOKS.map(method=><article key={method.id}><h3>{method.title}</h3><p>{method.text}</p></article>)}</div></section>
      <div className="r-phase-grid">
        {[1, 2, 3, 4].map((phase, i) => (
          <section className="r-phase" key={phase}>
            <div className="r-phase-number">0{phase}</div>
            <h2>{["Descoberta", "Produção", "Otimização", "Governança"][i]}</h2>
            {AGENTS.filter((a) => a.phase === phase).map((a) => (
              <article key={a.id}>
                <small>{a.role}</small>
                <h3>{a.name}</h3>
                <p>{a.output}</p>
                <span className="r-pill">
                  {a.id === "publisher"
                    ? "Depende da aprovação humana"
                    : "Preparação local"}
                </span>
              </article>
            ))}
          </section>
        ))}
      </div>
      <div className="r-two-columns">
        <section className="r-panel">
          <h2>Refinado antes de chegar até você</h2>
          <p>
            Cinco lentes: contraponto, primeiros princípios, expansão, olhar
            externo e execução. Bloqueios de fonte e privacidade prevalecem
            sobre a média.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runSafely(() => {
                assertAdmin(state);
                if (
                  config.threshold < 4 ||
                  config.threshold > 5 ||
                  !Number.isInteger(+config.maxRounds) ||
                  config.maxRounds < 1 ||
                  config.maxRounds > 5
                )
                  throw new Error(
                    "Use nota de 4 a 5 e limite de 1 a 5 rodadas.",
                  );
                setState((s) => ({ ...s, agentConfig: config }));
                notify("Critérios de refino salvos.");
              }, notify);
            }}
          >
            <fieldset disabled={state.role !== "Administrador"}>
              <legend className="sr-only">Critérios de refino</legend>
              <div className="field-pair">
                <label>
                  Nota mínima (de 5)
                  <input
                    type="number"
                    min="4"
                    max="5"
                    step="0.1"
                    value={config.threshold}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        threshold: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Máximo de rodadas
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={config.maxRounds}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        maxRounds: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
              <button className="button primary">Salvar critérios</button>
            </fieldset>
          </form>
          <Note>
            Um bloqueio factual não é corrigido inventando dados. Ao esgotar as
            rodadas, o conteúdo permanece em conferência. A nota local mede
            critérios estruturais; não equivale a um conselho de LLMs.
          </Note>
        </section>
        <section className="r-panel">
          <h2>Últimas entregas</h2>
          {state.executions
            .filter((e) => e.workspace === state.workspace)
            .slice(0, 8)
            .map((e) => (
              <details className="r-execution" key={e.id}>
                <summary>
                  {e.title}
                  <small>{fmt(e.at)} · local</small>
                </summary>
                {e.steps.map((s) => (
                  <div key={s.agentId}>
                    <b>{s.name}</b>
                    <small>{s.status}</small>
                    <p>{s.contribution}</p>
                  </div>
                ))}
              </details>
            ))}
          {!state.executions.some((e) => e.workspace === state.workspace) && (
            <p>
              Ao salvar um conteúdo em Escrever, as contribuições de cada
              especialidade aparecem aqui.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

export function Writer() {
  return <WritingStudio />;
}

export function MemoryRules() {
  const { state, setState, notify, events } = useApp();
  const [text, setText] = useState("");
  const [scope, setScope] = useState('Todos');
  const [example, setExample] = useState('');
  const [exception, setException] = useState('');
  const [evidenceId, setEvidenceId] = useState(null);
  return (
    <section className="r-panel">
      <h2>Memória editorial validada</h2>
      <p>
        Transforme uma correção recorrente em um critério explícito. Só os
        critérios validados entram no contexto das próximas produções.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSafely(() => {
            assertAdmin(state);
            if (!text.trim()) throw new Error("Escreva o critério.");
            setState((s) => ({
              ...s,
              rules: [
                {
                  id: crypto.randomUUID(),
                  workspace: state.workspace,
                  text: text.trim(),
                  scope, example, exception, evidenceId, active: true,
                  validatedBy: state.role,
                  at: new Date().toISOString(),
                },
                ...s.rules,
              ],
            }));
            setText("");
            setExample(''); setException(''); setEvidenceId(null);
            notify("Critério validado e incluído no contexto.");
          }, notify);
        }}
      >
        <label>
          Novo critério
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
          />
        </label>
        <div className="r-two-columns"><label>Aplicar ao formato<select aria-label="Aplicar ao formato" value={scope} onChange={e=>setScope(e.target.value)}>{['Todos',...FORMATS].map(f=><option key={f}>{f}</option>)}</select></label><label>Exemplo que demonstra o critério<textarea aria-label="Exemplo que demonstra o critério" value={example} onChange={e=>setExample(e.target.value)} rows={2}/></label><label>Quando esta regra não se aplica<textarea aria-label="Quando esta regra não se aplica" value={exception} onChange={e=>setException(e.target.value)} rows={2}/></label></div>
        {evidenceId && <p className="field-help">Critério vinculado à correção selecionada no histórico.</p>}
        <button
          className="button secondary"
          disabled={state.role !== "Administrador"}
        >
          Validar e guardar
        </button>
      </form>
      {state.rules
        .filter((r) => r.workspace === state.workspace)
        .map((r) => (
          <div className="r-memory-rule" key={r.id}>
            <p>{r.text}</p>
            <small>{r.scope || 'Todos'} · {r.active === false ? 'Retirado do contexto' : 'Ativo'}{r.evidenceId ? ' · correção vinculada' : ''}</small>
            {r.example && <p>Exemplo: {r.example}</p>}
            {r.exception && <p>Exceção: {r.exception}</p>}
            <button
              className="text-button danger-text"
              disabled={state.role !== "Administrador"}
              onClick={() =>
                setState((s) => ({
                  ...s,
                  rules: s.rules.map((x) => x.id !== r.id ? x : {...x, active: x.active === false, changedAt: new Date().toISOString()}),
                }))
              }
            >
              {r.active === false ? 'Reativar critério' : 'Retirar critério'}
            </button>
          </div>
        ))}
      <details>
        <summary>Correções recentes para considerar</summary>
        {events
          .filter((e) => e.action === "reject")
          .slice(0, 8)
          .map((e) => (
            <button
              className="r-suggestion"
              key={e.id}
              onClick={() => {setText(e.event); setEvidenceId(e.id);}}
            >
              {e.title}: {e.event}
            </button>
          ))}
      </details>
    </section>
  );
}
