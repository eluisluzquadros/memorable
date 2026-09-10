import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Bookmark,
  Radio,
  PenLine,
  CheckCheck,
  CalendarDays,
  LayoutDashboard,
  BookOpen,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  X,
  Check,
  FileText,
  AudioLines,
  Layers,
  Link,
  Upload,
  Download,
  Clock,
  AlertTriangle,
  ShieldCheck,
  MoreHorizontal,
  Menu,
  ExternalLink,
  Coins,
  RotateCcw,
  Users,
  Send,
  CheckCircle2,
  Filter,
  Play,
  HelpCircle,
  LogOut,
} from "lucide-react";
import Landing, { Brand } from "./Landing";
import {
  initialState,
  workspaces,
  accessibleSources,
  blockers,
  transition,
  createPiece,
  variants,
  storageKey,
} from "./workflow.mjs";
import "./styles.css";

const navItems = [
  ["painel", "Visão geral", LayoutDashboard],
  ["guardar", "Guardar", Bookmark],
  ["vigiar", "Vigiar", Radio],
  ["escrever", "Escrever", PenLine],
  ["aprovar", "Aprovar", CheckCheck],
  ["publicar", "Publicar", CalendarDays],
  ["caderno", "Caderno de decisões", BookOpen],
];
const money = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n || 0,
  );
const dateLabel = (d) =>
  d
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
      }).format(new Date(d.includes("T") ? d : d + "T12:00:00"))
    : "Sem prazo";
const statusClass = (s) =>
  ({
    "Em revisão": "review",
    Aprovado: "approved",
    Agendado: "scheduled",
    Ajustes: "adjustment",
    Rascunho: "draft",
  })[s];
const download = (name, content, type = "text/plain") => {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 500);
};
function Badge({ status }) {
  return (
    <span className={`badge ${statusClass(status)}`}>
      <span />
      {status}
    </span>
  );
}
function Empty({ icon: Icon = Bookmark, title, text, action, label }) {
  return (
    <div className="empty-state">
      <Icon size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button primary" onClick={action}>
          {label}
          <ArrowRight size={17} />
        </button>
      )}
    </div>
  );
}
function Dialog({ title, children, onClose, wide = false }) {
  const ctx = React.useContext(AppContext);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    const handler = (e) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", handler);
    return () => el.removeEventListener("cancel", handler);
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button onClick={onClose} className="icon-button" aria-label="Fechar">
          <X size={21} />
        </button>
      </div>
      {children}
      {ctx?.toast && (
        <div
          role="status"
          className={`toast ${ctx.toast.error ? "toast-error" : ""}`}
        >
          <span>{ctx.toast.text}</span>
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => ctx.setToast(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </dialog>
  );
}
const AppContext = React.createContext(null);
function App() {
  const [route, setRoute] = useState(
    location.hash.startsWith("#app/") ? location.hash.slice(5) : "landing",
  );
  const [state, setState] = useState(() => {
    try {
      const base = initialState();
      const s = JSON.parse(localStorage.getItem(storageKey));
      return s?.version === 1 &&
        Array.isArray(s.pieces) &&
        Array.isArray(s.sources) &&
        workspaces.some((w) => w.id === s.workspace)
        ? {
            ...base,
            ...s,
            sources: [
              ...s.sources,
              ...base.sources.filter(
                (x) => !s.sources.some((y) => y.id === x.id),
              ),
            ],
          }
        : base;
    } catch {
      return initialState();
    }
  });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("Todos");
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [brief, setBrief] = useState({
    title: "Clareza no primeiro atendimento",
    format: "LinkedIn",
    source: "rolim31",
    deadline: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    owner: "Carol",
  });
  const [generated, setGenerated] = useState(null);
  const [busy, setBusy] = useState(false);
  const [approvalFilter, setApprovalFilter] = useState("Todos");
  const [globalSearch, setGlobalSearch] = useState("");
  const notify = (text, error = false) => {
    clearTimeout(toastTimer.current);
    setToast({ text, error });
    toastTimer.current = setTimeout(() => setToast(null), 5500);
  };
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      notify(
        "Não foi possível salvar no navegador. Exporte o caderno para preservar seu trabalho.",
        true,
      );
    }
  }, [state]);
  useEffect(() => {
    const change = () => {
      const next = location.hash.startsWith("#app/")
        ? location.hash.slice(5)
        : "landing";
      setRoute(next);
      setMobile(false);
      setQuery("");
      setSourceFilter("Todos");
      if (next !== "landing") window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    const key = (e) => {
      const tab = e.target.closest?.("[role=tab]");
      if (tab && ["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const tabs = [...tab.parentElement.querySelectorAll("[role=tab]")];
        const i = tabs.indexOf(tab);
        const next =
          e.key === "Home"
            ? 0
            : e.key === "End"
              ? tabs.length - 1
              : (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) %
                tabs.length;
        tabs[next].focus();
        tabs[next].click();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setModal("search");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const workspace =
    workspaces.find((w) => w.id === state.workspace) || workspaces[0];
  const pieces = state.pieces.filter((p) => p.workspace === state.workspace);
  const sources = accessibleSources(state, state.workspace);
  const pending = pieces.filter((p) => p.status === "Em revisão");
  const approved = pieces.filter((p) =>
    ["Aprovado", "Agendado"].includes(p.status),
  );
  const spent = pieces.reduce((s, p) => s + p.cost, 0);
  const events = state.events.filter((e) => e.workspace === state.workspace);
  const goto = (tab) => {
    location.hash = `app/${tab}`;
  };
  const changeWorkspace = (id) => {
    setState((s) => ({ ...s, workspace: id }));
    setSelectedPiece(null);
    setSelectedSource(null);
    setGenerated(null);
    setQuery("");
    setBrief((b) => ({
      ...b,
      title: "",
      source: accessibleSources(state, id)[0]?.id || "",
    }));
  };
  const doAction = (id, action, payload = {}) => {
    try {
      setState(transition(state, id, action, payload));
      notify(
        action === "approve"
          ? "Peça aprovada. Agora ela pode entrar na agenda."
          : action === "reject"
            ? "Ajuste registrado. A peça voltou para a escrita."
            : action === "schedule"
              ? "Peça adicionada à agenda local."
              : "Peça enviada para revisão.",
      );
      return true;
    } catch (e) {
      notify(e.message, true);
      return false;
    }
  };
  const selectTopic = (title, source) => {
    setBrief((b) => ({ ...b, title, source }));
    setGenerated(null);
    goto("escrever");
  };
  const pageTitle =
    navItems.find((i) => i[0] === route)?.[1] || "Configurações";
  const pieceTable = (list, compact = false) => (
    <div className="table-wrap">
      <table className="piece-table">
        <thead>
          <tr>
            <th>Conteúdo</th>
            <th>Situação</th>
            <th>Responsável</th>
            <th>Prazo</th>
            <th>
              <span className="sr-only">Abrir</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td>
                <button
                  className="table-title"
                  onClick={() => setSelectedPiece(p.id)}
                >
                  <span className="file-glyph">
                    {p.format === "Reels" ? (
                      <Play size={18} />
                    ) : p.format === "Carrossel" ? (
                      <Layers size={18} />
                    ) : (
                      <FileText size={18} />
                    )}
                  </span>
                  <span>
                    <b>{p.title}</b>
                    <small>
                      {p.format} · v{p.revision}
                      {!p.sourceIds.length ? " · Fonte pendente" : ""}
                    </small>
                    <small className="mobile-piece-meta">
                      {p.owner} · Prazo {dateLabel(p.deadline)}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                <Badge status={p.status} />
              </td>
              <td>
                <span className="person-cell">
                  <span className="avatar mini-avatar">
                    {p.owner.slice(0, 2).toUpperCase()}
                  </span>
                  {p.owner}
                </span>
              </td>
              <td>{dateLabel(p.deadline)}</td>
              <td>
                <button
                  className="icon-button"
                  onClick={() => setSelectedPiece(p.id)}
                  aria-label={`Abrir ${p.title}`}
                >
                  <ArrowUpRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const activePiece = state.pieces.find(
    (p) => p.id === selectedPiece && p.workspace === state.workspace,
  );
  const activeSource = sources.find((s) => s.id === selectedSource);
  return (
    <AppContext.Provider
      value={{
        toast,
        setToast,
        state,
        setState,
        workspace,
        pieces,
        pending,
        approved,
        spent,
        events,
        sources,
        notify,
        goto,
        setModal,
        setSelectedPiece,
        setSelectedSource,
        query,
        setQuery,
        sourceFilter,
        setSourceFilter,
        brief,
        setBrief,
        generated,
        setGenerated,
        busy,
        setBusy,
        approvalFilter,
        setApprovalFilter,
        selectTopic,
        pieceTable,
      }}
    >
      {route === "landing" ? (
        <Landing />
      ) : (
        <div className="app-shell">
          <a
            href="#app-main"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("app-main")?.focus();
            }}
            className="skip-link"
          >
            Ir para o conteúdo
          </a>
          <aside className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
            <div className="sidebar-logo">
              <Brand />
              <button
                className="icon-button mobile-only"
                onClick={() => setMobile(false)}
                aria-label="Fechar menu"
              >
                <X />
              </button>
            </div>
            <div className="organization-label">
              GRUPO BBMD<span>DEMO</span>
            </div>
            <div className="workspace-select-wrap">
              <span
                className="workspace-avatar"
                style={{ background: workspace.color }}
              >
                {workspace.initials}
              </span>
              <label>
                <span>Espaço de trabalho</span>
                <select
                  aria-label="Espaço de trabalho"
                  value={state.workspace}
                  onChange={(e) => changeWorkspace(e.target.value)}
                >
                  {workspaces.map((w) => (
                    <option value={w.id} key={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="sidebar-search"
              onClick={() => setModal("search")}
            >
              <Search size={17} />
              <span>Buscar na operação</span>
              <kbd>⌃ K</kbd>
            </button>
            <nav aria-label="Plataforma">
              {navItems.map(([id, name, Icon], i) => (
                <React.Fragment key={id}>
                  {i === 1 && (
                    <div className="nav-group-label">SUA ESTEIRA</div>
                  )}
                  {i === 6 && <div className="nav-divider" />}
                  <a
                    href={`#app/${id}`}
                    className={route === id ? "active" : ""}
                  >
                    <Icon size={19} />
                    <span>{name}</span>
                    {id === "aprovar" && pending.length > 0 && (
                      <span className="nav-count">{pending.length}</span>
                    )}
                  </a>
                </React.Fragment>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <a
                className={route === "configuracoes" ? "active" : ""}
                href="#app/configuracoes"
              >
                <Settings size={19} />
                Configurações
              </a>
              <div className="demo-help">
                <span className="demo-help-icon">
                  <Play size={16} />
                </span>
                <p>
                  <b>Seu próximo capítulo.</b>
                  <span>Explore o fluxo com liberdade.</span>
                </p>
                <button
                  className="icon-button"
                  aria-label="Sobre a demonstração"
                  onClick={() => setModal("help")}
                >
                  <HelpCircle size={17} />
                </button>
              </div>
              <div className="user-profile">
                <span className="avatar">
                  {state.role === "Editor" ? "CA" : "BT"}
                </span>
                <div>
                  <b>{state.role === "Editor" ? "Carol" : "Beto"}</b>
                  <span>Equipe de marketing</span>
                </div>
                <a href="#" aria-label="Voltar à apresentação">
                  <LogOut size={17} />
                </a>
              </div>
            </div>
          </aside>
          {mobile && (
            <button
              className="sidebar-backdrop"
              onClick={() => setMobile(false)}
              aria-label="Fechar navegação"
            />
          )}
          <div className="app-content">
            <header className="app-topbar">
              <button
                className="icon-button mobile-only"
                onClick={() => setMobile(true)}
                aria-label="Abrir menu"
              >
                <Menu size={22} />
              </button>
              <div className="breadcrumb">
                <span>Workspace</span>
                <ChevronRight size={15} />
                <b>{pageTitle}</b>
              </div>
              <div className="topbar-right">
                <span className="demo-indicator">
                  <span />
                  Demonstração local
                </span>
                <label className="role-select">
                  <span>Papel</span>
                  <select
                    aria-label="Papel na demonstração"
                    value={state.role}
                    onChange={(e) =>
                      setState((s) => ({ ...s, role: e.target.value }))
                    }
                  >
                    <option>Editor</option>
                    <option>Aprovador</option>
                    <option>Administrador</option>
                  </select>
                </label>
              </div>
            </header>
            <main
              id="app-main"
              tabIndex={-1}
              className="app-main"
              key={route + "-" + state.workspace}
            >
              {route === "painel" ? (
                <Dashboard />
              ) : route === "guardar" ? (
                <Guardar />
              ) : route === "vigiar" ? (
                <Vigiar />
              ) : route === "escrever" ? (
                <Escrever />
              ) : route === "aprovar" ? (
                <Aprovar />
              ) : route === "publicar" ? (
                <Publicar />
              ) : route === "caderno" ? (
                <Caderno />
              ) : (
                <Configuracoes />
              )}
            </main>
            <footer className="app-footer">
              <span>
                esteira.{" "}
                <span>Inteligência no processo. Pessoas na decisão.</span>
              </span>
              <span>Protótipo de validação · SkyVidya</span>
            </footer>
          </div>
        </div>
      )}
      {toast && (
        <div
          role="status"
          className={`toast ${toast.error ? "toast-error" : ""}`}
        >
          {toast.error ? (
            <AlertTriangle size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>{toast.text}</span>
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setToast(null)}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {modal === "help" && (
        <Dialog
          title="Uma ideia, de ponta a ponta."
          onClose={() => setModal(null)}
        >
          <div className="dialog-body">
            <p>
              Experimente a Esteira com o contexto Grupo BBMD. As ações e o
              histórico ficam salvos neste navegador.
            </p>
            <ol className="help-steps">
              <li>
                Escolha uma fonte em <b>Guardar</b>.
              </li>
              <li>
                Explore abordagens em <b>Escrever</b> e salve o rascunho.
              </li>
              <li>
                Envie para revisão. Troque o papel para <b>Aprovador</b>.
              </li>
              <li>
                Confira o texto e as fontes, aprove e defina uma data em{" "}
                <b>Publicar</b>.
              </li>
            </ol>
            <div className="quiet-note">
              <ShieldCheck size={20} />
              <p>
                Sem IA, autenticação ou publicação externas conectadas. Custos e
                papéis são demonstrativos.
              </p>
            </div>
            <button
              className="button primary"
              onClick={() => {
                setModal(null);
                goto("guardar");
              }}
            >
              Começar pelo acervo <ArrowRight size={18} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === "reset" && (
        <Dialog
          title="Recomeçar a demonstração?"
          onClose={() => setModal(null)}
        >
          <div className="dialog-body">
            <p>
              Isso remove as peças, fontes e decisões criadas nesta demo e
              restaura os exemplos iniciais. Exporte os dados nas configurações
              se quiser preservá-los.
            </p>
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() => setModal(null)}
              >
                Manter meu trabalho
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setState(initialState());
                  setModal(null);
                  setGenerated(null);
                  setSelectedPiece(null);
                  notify("Demonstração reiniciada.");
                }}
              >
                Reiniciar demo
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {modal === "search" && (
        <Dialog
          title="Buscar na operação"
          onClose={() => {
            setModal(null);
            setGlobalSearch("");
          }}
        >
          <div className="dialog-body">
            <label className="search-input search-large">
              <Search size={21} />
              <input
                autoFocus
                aria-label="Buscar conteúdos e fontes"
                placeholder="Busque conteúdos e referências…"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
            </label>
            <div className="search-results">
              {[
                ...pieces.map((p) => ({ ...p, kind: "Conteúdo" })),
                ...sources.map((s) => ({ ...s, kind: "Acervo" })),
              ]
                .filter((x) =>
                  (x.title + " " + (x.body || x.text))
                    .toLowerCase()
                    .includes(globalSearch.toLowerCase()),
                )
                .slice(0, 8)
                .map((x) => (
                  <button
                    key={x.id}
                    onClick={() => {
                      setModal(null);
                      x.kind === "Conteúdo"
                        ? setSelectedPiece(x.id)
                        : setSelectedSource(x.id);
                    }}
                  >
                    <FileText size={20} />
                    <span>
                      <b>{x.title}</b>
                      <small>{x.kind}</small>
                    </span>
                    <ArrowUpRight size={17} />
                  </button>
                ))}
            </div>
            {![...pieces, ...sources].some((x) =>
              (x.title + " " + (x.body || x.text))
                .toLowerCase()
                .includes(globalSearch.toLowerCase()),
            ) && <p>Nenhum resultado neste espaço. Tente outra palavra.</p>}
          </div>
        </Dialog>
      )}
      {modal === "source" && (
        <SourceForm
          state={state}
          setState={setState}
          notify={notify}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "schedule" && (
        <ScheduleForm
          piece={state.pieces.find((p) => p.id === modal.id)}
          onClose={() => setModal(null)}
          onSave={(payload) => {
            if (doAction(modal.id, "schedule", payload)) setModal(null);
          }}
        />
      )}
      {activeSource && (
        <Dialog
          title="Referência do acervo"
          wide
          onClose={() => setSelectedSource(null)}
        >
          <div className="dialog-body source-detail">
            <div className="detail-meta">
              <span className="inline-label">{activeSource.type}</span>
              <span>
                {activeSource.shared
                  ? "Biblioteca compartilhada"
                  : workspace.name}
              </span>
            </div>
            <h2>{activeSource.title}</h2>
            <p className="source-origin">{activeSource.origin}</p>
            <blockquote>{activeSource.text}</blockquote>
            {activeSource.url && (
              <a
                className="text-button"
                target="_blank"
                rel="noreferrer"
                href={activeSource.url}
              >
                Abrir fonte original <ExternalLink size={16} />
              </a>
            )}
            <div className="source-feedback">
              <span>Este material já foi usado?</span>
              {["Funcionou", "Não funcionou"].map((f) => (
                <button
                  className={`button secondary ${activeSource.feedback === f ? "selected" : ""}`}
                  key={f}
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      sources: s.sources.map((x) =>
                        x.id === activeSource.id ? { ...x, feedback: f } : x,
                      ),
                    }));
                    notify("Avaliação do material registrada.");
                  }}
                >
                  {activeSource.feedback === f && <Check size={14} />} {f}
                </button>
              ))}
            </div>
            {!activeSource.citable && (
              <div className="validation-warning">
                <AlertTriangle size={18} />
                Material sem origem não pode fundamentar a aprovação.
              </div>
            )}
            <div className="dialog-actions">
              <button
                className="button secondary"
                onClick={() =>
                  download(
                    `${activeSource.title}.txt`,
                    `${activeSource.title}\n${activeSource.origin}\n${activeSource.url}\n\n${activeSource.text}`,
                  )
                }
              >
                <Download size={16} />
                Exportar
              </button>
              <button
                className="button primary"
                disabled={!activeSource.citable}
                onClick={() => {
                  selectTopic(activeSource.title, activeSource.id);
                  setSelectedSource(null);
                }}
              >
                Criar a partir daqui <ArrowRight size={17} />
              </button>
            </div>
          </div>
        </Dialog>
      )}
      {activePiece && (
        <PieceDetail
          key={
            activePiece.id +
            "-" +
            activePiece.revision +
            "-" +
            activePiece.status
          }
          piece={activePiece}
          state={state}
          setState={setState}
          notify={notify}
          doAction={doAction}
          onClose={() => setSelectedPiece(null)}
          onSchedule={() => {
            setSelectedPiece(null);
            setModal({ type: "schedule", id: activePiece.id });
          }}
        />
      )}
    </AppContext.Provider>
  );
}

function Dashboard() {
  const {
    state,
    setState,
    workspace,
    pieces,
    pending,
    approved,
    spent,
    events,
    sources,
    notify,
    goto,
    setModal,
    setSelectedPiece,
    setSelectedSource,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    brief,
    setBrief,
    generated,
    setGenerated,
    busy,
    setBusy,
    approvalFilter,
    setApprovalFilter,
    selectTopic,
    pieceTable,
  } = React.useContext(AppContext);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="workspace-caption">
            {workspace.name} <span>/</span>{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </div>
          <h1>
            Sua operação,
            <br className="mobile-only" /> em perspectiva.
          </h1>
          <p>O que está em movimento e o que precisa do seu olhar.</p>
        </div>
        <button className="button primary" onClick={() => goto("escrever")}>
          <Plus size={18} />
          Criar conteúdo
        </button>
      </div>
      <div className="dashboard-metrics">
        <div>
          <span>Na esteira</span>
          <b>{pieces.length.toString().padStart(2, "0")}</b>
          <small>peças neste espaço</small>
        </div>
        <div>
          <span>Esperando revisão</span>
          <b className="blue-text">
            {pending.length.toString().padStart(2, "0")}
          </b>
          <small>próxima decisão humana</small>
        </div>
        <div>
          <span>Aprovadas</span>
          <b>{approved.length.toString().padStart(2, "0")}</b>
          <small>prontas para o próximo passo</small>
        </div>
        <div>
          <span>Custo estimado</span>
          <b className="money-metric">{money(spent)}</b>
          <small>valores demonstrativos</small>
        </div>
      </div>
      <div className="dashboard-middle">
        <div className="attention-panel">
          <div className="panel-label">
            <span className="attention-symbol">
              <CheckCheck size={20} />
            </span>
            O próximo passo
          </div>
          <h2>
            {pending.length
              ? `${pending.length} ${pending.length === 1 ? "peça espera" : "peças esperam"} pelo seu olhar.`
              : "Abra espaço para uma boa ideia."}
          </h2>
          <p>
            {pending.length
              ? "O conteúdo já chegou até aqui. Uma decisão sua faz o trabalho continuar."
              : "Seu acervo é o ponto de partida. Escolha uma referência e transforme conhecimento em conteúdo."}
          </p>
          <button
            className="button dark"
            onClick={() => goto(pending.length ? "aprovar" : "guardar")}
          >
            {pending.length ? "Abrir revisão" : "Explorar acervo"}
            <ArrowRight size={18} />
          </button>
          <div className="attention-avatars">
            <span className="avatar">CA</span>
            <span className="avatar">BT</span>
            <span>Criação e critério, juntos.</span>
          </div>
        </div>
        <div className="pipeline-panel">
          <div className="panel-top">
            <h2>O ritmo da produção</h2>
            <span>Agora</span>
          </div>
          <div className="pipeline-chart">
            {["Rascunho", "Em revisão", "Aprovado", "Agendado"].map((s, i) => {
              const count = pieces.filter((p) => p.status === s).length;
              return (
                <div key={s}>
                  <span className="chart-value">{count}</span>
                  <div
                    className={`chart-column column-${i}`}
                    style={{
                      height: (count / Math.max(1, pieces.length)) * 110 + "px",
                    }}
                  />
                  <span className="chart-caption">
                    {s === "Em revisão"
                      ? "Revisão"
                      : s === "Rascunho"
                        ? "Escrita"
                        : s === "Agendado"
                          ? "Agenda"
                          : "Aprovado"}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="pipeline-note">
            <ShieldCheck size={16} />
            Aprovação vinculada à versão do texto.
          </div>
        </div>
      </div>
      <div className="section-header">
        <div>
          <h2>Em produção</h2>
          <span>Responsáveis e próximos passos à vista.</span>
        </div>
        <button className="text-button" onClick={() => goto("aprovar")}>
          Ver quadro <ArrowRight size={17} />
        </button>
      </div>
      {pieces.length ? (
        pieceTable(pieces.slice(0, 5))
      ) : (
        <Empty
          title="Sua primeira peça começa no acervo."
          text="Escolha uma referência para colocar a esteira em movimento."
          action={() => goto("guardar")}
          label="Abrir acervo"
        />
      )}
      <div className="pilot-note">
        <span>VALIDAÇÃO DO PILOTO</span>
        <p>
          <b>Menos de 8h</b> até a aprovação e <b>10 roteiros por semana.</b>{" "}
          Metas propostas para medir durante o piloto, ainda não resultados.
        </p>
        <ArrowUpRight size={20} />
      </div>
    </>
  );
}
function Guardar() {
  const {
    state,
    setState,
    workspace,
    pieces,
    pending,
    approved,
    spent,
    events,
    sources,
    notify,
    goto,
    setModal,
    setSelectedPiece,
    setSelectedSource,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    brief,
    setBrief,
    generated,
    setGenerated,
    busy,
    setBusy,
    approvalFilter,
    setApprovalFilter,
    selectTopic,
    pieceTable,
  } = React.useContext(AppContext);
  const filtered = sources.filter(
    (s) =>
      (sourceFilter === "Todos" || s.type === sourceFilter) &&
      (s.title + " " + s.text + " " + s.origin)
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>O conhecimento fica.</h1>
          <p>Guarde hoje o que pode se tornar o próximo conteúdo.</p>
        </div>
        <button className="button primary" onClick={() => setModal("source")}>
          <Plus size={18} />
          Adicionar ao acervo
        </button>
      </div>
      <div className="library-overview">
        <Bookmark size={25} />
        <p>
          <b>{sources.length} referências disponíveis</b>
          <span>
            {sources.filter((s) => s.shared).length} na biblioteca compartilhada
            · {sources.filter((s) => s.workspace === workspace.id).length} deste
            espaço
          </span>
        </p>
        <span className="inline-label">{workspace.name}</span>
      </div>
      <div className="filter-bar">
        <div className="segmented">
          {["Todos", "Documento", "Podcast", "Texto"].map((t) => (
            <button
              key={t}
              onClick={() => setSourceFilter(t)}
              className={sourceFilter === t ? "active" : ""}
            >
              {t}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Search size={18} />
          <input
            aria-label="Buscar no acervo"
            placeholder="Buscar no acervo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      {filtered.length ? (
        <div className="source-list">
          {filtered.map((s) => (
            <button
              className="source-row"
              key={s.id}
              onClick={() => setSelectedSource(s.id)}
            >
              <span
                className={`source-type-icon ${s.type === "Podcast" ? "podcast-icon" : ""}`}
              >
                {s.type === "Podcast" ? (
                  <AudioLines size={25} />
                ) : (
                  <FileText size={25} />
                )}
              </span>
              <div className="source-row-main">
                <h3>{s.title}</h3>
                <p>
                  {s.text.slice(0, 125)}
                  {s.text.length > 125 ? "…" : ""}
                </p>
                <div className="source-meta">
                  <span>{s.origin}</span>
                  <span>
                    {s.shared ? "Biblioteca compartilhada" : workspace.name}
                  </span>
                </div>
              </div>
              <span
                className={`source-citable ${s.citable ? "" : "uncitable"}`}
              >
                {s.citable ? (
                  <>
                    <Link size={14} />
                    Fonte vinculada
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} />
                    Origem pendente
                  </>
                )}
              </span>
              <ArrowUpRight size={19} />
            </button>
          ))}
        </div>
      ) : (
        <Empty
          title="Nenhuma referência encontrada."
          text="Tente outro termo ou adicione um novo material ao acervo."
          action={() => {
            setQuery("");
            setSourceFilter("Todos");
          }}
          label="Limpar filtros"
        />
      )}
      <div className="quiet-note">
        <ShieldCheck size={17} />
        <p>
          A busca desta demo usa palavras do título e do texto. A busca
          semântica será conectada na implantação.
        </p>
      </div>
    </>
  );
}
function Vigiar() {
  const {
    state,
    setState,
    workspace,
    pieces,
    pending,
    approved,
    spent,
    events,
    sources,
    notify,
    goto,
    setModal,
    setSelectedPiece,
    setSelectedSource,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    brief,
    setBrief,
    generated,
    setGenerated,
    busy,
    setBusy,
    approvalFilter,
    setApprovalFilter,
    selectTopic,
    pieceTable,
  } = React.useContext(AppContext);
  const [filter, setFilter] = useState("Todas");
  const topics = [
    {
      title: "Clareza no primeiro atendimento",
      category: "Acervo próprio",
      source: "rolim31",
      reason:
        "Sua biblioteca já contém uma conversa sobre clareza e confiança. É uma referência para abrir um novo conteúdo.",
      score: "Alto",
      type: "Oportunidade de reaproveitamento",
    },
    {
      title: "Como a sua marca explica o que faz?",
      category: "Acervo próprio",
      source: `${workspace.id}-voice`,
      reason:
        "A voz da marca pede linguagem acessível. Um conteúdo de apresentação pode traduzir esse critério em prática.",
      score: "Médio",
      type: "Alinhamento com a voz da marca",
    },
    {
      title: "O que seus concorrentes estão discutindo?",
      category: "Concorrentes",
      disabled: true,
      type: "Fonte ainda não configurada",
      reason:
        "Adicione os perfis que o time deseja acompanhar. Nenhuma varredura externa está conectada nesta demo.",
    },
    {
      title: "Quem amplia o repertório do time?",
      category: "Referências",
      disabled: true,
      type: "Fonte ainda não configurada",
      reason:
        "Escolha criadores e publicações de referência para preparar o radar da operação.",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>A próxima pauta está por perto.</h1>
          <p>Sinais do acervo para começar a semana com direção.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => goto("configuracoes")}
        >
          <Settings size={17} />
          Configurar fontes
        </button>
      </div>
      <div className="radar-banner">
        <div className="radar-graphic">
          <Radio size={33} />
        </div>
        <div>
          <h2>Um olhar novo para o que você já sabe.</h2>
          <p>Oportunidades demonstrativas, com contexto e origem visíveis.</p>
        </div>
        <span>
          CURADORIA
          <br />
          <b>DA EQUIPE</b>
        </span>
      </div>
      <div className="filter-bar">
        <div className="segmented">
          {["Todas", "Acervo próprio", "Concorrentes", "Referências"].map(
            (t) => (
              <button
                key={t}
                className={filter === t ? "active" : ""}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="topic-list">
        {topics
          .filter((t) => filter === "Todas" || filter === t.category)
          .map((t, i) => (
            <article
              className={`topic ${t.disabled ? "topic-disabled" : ""}`}
              key={t.title}
            >
              <div className="topic-index">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <div className="topic-kind">
                  {t.category} <span>·</span> {t.type}
                </div>
                <h2>{t.title}</h2>
                <p>{t.reason}</p>
                {!t.disabled && (
                  <div className="topic-reason">
                    <Check size={15} />
                    {t.score === "Alto" ? "Encaixe alto" : "Encaixe médio"} ·
                    avaliação editorial de exemplo
                  </div>
                )}
              </div>
              <button
                className={`button ${t.disabled ? "secondary" : "primary"}`}
                onClick={() =>
                  t.disabled
                    ? goto("configuracoes")
                    : selectTopic(t.title, t.source)
                }
              >
                {t.disabled ? "Configurar" : "Criar a partir daqui"}
                <ArrowUpRight size={17} />
              </button>
            </article>
          ))}
      </div>
    </>
  );
}
function Escrever() {
  const {
    state,
    setState,
    workspace,
    pieces,
    pending,
    approved,
    spent,
    events,
    sources,
    notify,
    goto,
    setModal,
    setSelectedPiece,
    setSelectedSource,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    brief,
    setBrief,
    generated,
    setGenerated,
    busy,
    setBusy,
    approvalFilter,
    setApprovalFilter,
    selectTopic,
    pieceTable,
  } = React.useContext(AppContext);
  const currentSource = sources.find((s) => s.id === brief.source);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [draft, setDraft] = useState(generated?.[0]?.body || "");
  const localGenerated = generated;
  const generate = () => {
    if (!brief.title.trim()) {
      notify("Conte em poucas palavras qual é o assunto.", true);
      return;
    }
    if (!currentSource?.citable) {
      notify("Escolha uma fonte citável para começar.", true);
      return;
    }
    if (!["Editor", "Administrador"].includes(state.role)) {
      notify("Selecione o papel Editor para criar conteúdo.", true);
      return;
    }
    if (spent + 0.18 > state.budgets[state.workspace]) {
      notify(
        "Teto estimado atingido. Ajuste o orçamento nas configurações.",
        true,
      );
      return;
    }
    const result = variants(brief.title, currentSource, brief.format);
    setGenerated(result);
    setDraft(result[0].body);
    setSelectedVariant(0);
  };
  const save = () => {
    try {
      const text = draft;
      const next = createPiece(state, {
        ...brief,
        body: text,
        sourceIds: [brief.source],
      });
      setState(next);
      setGenerated(null);
      setSelectedPiece(next.pieces[0].id);
      notify("Rascunho salvo. Confira e envie para revisão.");
    } catch (e) {
      notify(e.message, true);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Dê um próximo capítulo à ideia.</h1>
          <p>Uma referência, três caminhos. A escolha continua sendo sua.</p>
        </div>
        <span className="voice-label">
          <span style={{ background: workspace.color }} />
          {workspace.voice}
        </span>
      </div>
      <div className="writer-layout">
        <div className="brief-panel">
          <div className="panel-top">
            <h2>Seu ponto de partida</h2>
            <PenLine size={20} />
          </div>
          <label>
            O que vamos comunicar?
            <textarea
              rows={3}
              value={brief.title}
              onChange={(e) => {
                setBrief({ ...brief, title: e.target.value });
                setGenerated(null);
              }}
              placeholder="Ex.: clareza no primeiro atendimento"
              maxLength={140}
            />
          </label>
          <label>
            Formato
            <select
              value={brief.format}
              onChange={(e) => {
                setBrief({ ...brief, format: e.target.value });
                setGenerated(null);
              }}
            >
              {["LinkedIn", "Reels", "Carrossel", "Legenda Instagram"].map(
                (t) => (
                  <option key={t}>{t}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Referência do acervo
            <select
              value={brief.source}
              onChange={(e) => {
                setBrief({ ...brief, source: e.target.value });
                setGenerated(null);
              }}
            >
              <option value="">Selecione uma fonte</option>
              {sources
                .filter((s) => s.citable)
                .map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.title}
                  </option>
                ))}
            </select>
          </label>
          {currentSource && (
            <div className="source-excerpt">
              <Link size={14} />
              <p>
                {currentSource.text.slice(0, 180)}
                {currentSource.text.length > 180 ? "…" : ""}
              </p>
            </div>
          )}
          <div className="field-pair">
            <label>
              Responsável
              <select
                value={brief.owner}
                onChange={(e) => setBrief({ ...brief, owner: e.target.value })}
              >
                {["Carol", "Lucas", "Designer"].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label>
              Prazo
              <input
                type="date"
                value={brief.deadline}
                onChange={(e) =>
                  setBrief({ ...brief, deadline: e.target.value })
                }
                required
              />
            </label>
          </div>
          <button
            className="button primary full-width"
            disabled={busy || !currentSource}
            onClick={generate}
          >
            {busy ? <span className="spinner" /> : <Layers size={18} />}{" "}
            {busy ? "Preparando abordagens…" : "Explorar 3 abordagens"}
          </button>
          <p className="field-help">
            Nesta demo, modelos de texto locais ilustram a criação. Nenhuma IA
            externa é chamada.
          </p>
        </div>
        <div className="writer-main">
          {!localGenerated ? (
            <div className="writer-empty">
              <div className="writer-empty-symbol">
                <PenLine size={42} />
              </div>
              <h2>
                O conteúdo começa
                <br />
                com uma boa referência.
              </h2>
              <p>
                Escolha o assunto, o formato e a fonte.
                <br />
                Vamos abrir três caminhos para a sua ideia.
              </p>
              <div className="writing-principles">
                <span>
                  <Link size={16} />
                  Fonte preservada
                </span>
                <span>
                  <Users size={16} />
                  Revisão humana
                </span>
              </div>
            </div>
          ) : (
            <>
              <div
                className="variant-tabs"
                role="tablist"
                aria-label="Abordagens de escrita"
              >
                {localGenerated.map((v, i) => (
                  <button
                    key={v.strategy}
                    className={selectedVariant === i ? "active" : ""}
                    role="tab"
                    aria-selected={selectedVariant === i}
                    onClick={() => {
                      setSelectedVariant(i);
                      setDraft(v.body);
                    }}
                  >
                    <span>ABORDAGEM {i + 1}</span>
                    <b>{v.strategy}</b>
                  </button>
                ))}
              </div>
              <div className="editor-surface">
                <div className="editor-toolbar">
                  <span>
                    {brief.format} <span>·</span> Texto editável
                  </span>
                  <span>{draft.length} caracteres</span>
                </div>
                <textarea
                  aria-label="Editar abordagem"
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setGenerated((g) =>
                      g.map((v, i) =>
                        i === selectedVariant
                          ? { ...v, body: e.target.value }
                          : v,
                      ),
                    );
                  }}
                  rows={15}
                />
                <div className="editor-source">
                  <Link size={16} />
                  <span>{currentSource?.origin}</span>
                </div>
              </div>
              <div className="editor-bottom">
                <p>
                  Revise fatos, contexto e adequação à marca antes de enviar.
                </p>
                <button className="button primary" onClick={save}>
                  Salvar rascunho <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
function Aprovar() {
  const {
    state,
    setState,
    workspace,
    pieces,
    pending,
    approved,
    spent,
    events,
    sources,
    notify,
    goto,
    setModal,
    setSelectedPiece,
    setSelectedSource,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    brief,
    setBrief,
    generated,
    setGenerated,
    busy,
    setBusy,
    approvalFilter,
    setApprovalFilter,
    selectTopic,
    pieceTable,
  } = React.useContext(AppContext);
  const filtered = pieces.filter(
    (p) => approvalFilter === "Todos" || p.status === approvalFilter,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>O critério tem nome.</h1>
          <p>Um quadro para acompanhar. Um lugar para decidir.</p>
        </div>
        <div className="review-role-note">
          <ShieldCheck size={18} />
          Você está como <b>{state.role}</b>
        </div>
      </div>
      {state.role === "Editor" && (
        <div className="role-guidance">
          <p>
            Para experimentar a revisão humana, altere o papel para Aprovador.
          </p>
          <button
            className="text-button"
            onClick={() => setState((s) => ({ ...s, role: "Aprovador" }))}
          >
            Usar papel Aprovador <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="filter-bar">
        <div className="segmented">
          {["Todos", "Em revisão", "Ajustes", "Aprovado"].map((t) => (
            <button
              className={approvalFilter === t ? "active" : ""}
              key={t}
              onClick={() => setApprovalFilter(t)}
            >
              {t}
              {t === "Em revisão" && <span>{pending.length}</span>}
            </button>
          ))}
        </div>
      </div>
      {filtered.length ? (
        <div className="kanban">
          {(approvalFilter === "Todos"
            ? ["Rascunho", "Em revisão", "Ajustes", "Aprovado"]
            : [approvalFilter]
          ).map((status) => (
            <div className="kanban-column" key={status}>
              <div className="kanban-title">
                <Badge status={status} />
                <span>
                  {filtered.filter((p) => p.status === status).length}
                </span>
              </div>
              {filtered
                .filter((p) => p.status === status)
                .map((p) => (
                  <button
                    className="kanban-card"
                    key={p.id}
                    onClick={() => setSelectedPiece(p.id)}
                  >
                    <div className="kanban-format">
                      <span>{p.format}</span>
                      <ArrowUpRight size={15} />
                    </div>
                    <h3>{p.title}</h3>
                    <p>{p.body.slice(0, 110)}…</p>
                    {blockers(state, p).length > 0 ? (
                      <div className="kanban-warning">
                        <AlertTriangle size={14} />
                        Fonte ou informação pendente
                      </div>
                    ) : (
                      <div className="kanban-source">
                        <Link size={14} />
                        {p.sourceIds.length} fonte vinculada
                      </div>
                    )}
                    <div className="kanban-footer">
                      <span>
                        <span className="avatar mini-avatar">
                          {p.owner.slice(0, 2).toUpperCase()}
                        </span>
                        {p.owner}
                      </span>
                      <span>
                        <Clock size={13} />
                        {dateLabel(p.deadline)}
                      </span>
                    </div>
                  </button>
                ))}
              {!filtered.some((p) => p.status === status) && (
                <div className="kanban-empty">Nenhuma peça nesta etapa.</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={CheckCheck}
          title="Tudo em dia por aqui."
          text="As peças desta etapa aparecerão quando o trabalho avançar."
          action={() => goto("escrever")}
          label="Criar conteúdo"
        />
      )}
      <div className="quiet-note">
        <CheckCheck size={18} />
        <p>
          A aprovação vale para uma versão. Qualquer edição devolve a peça à
          escrita e exige nova revisão.
        </p>
      </div>
    </>
  );
}
function Publicar() {
  const {
    state,
    setState,
    workspace,
    pieces,
    pending,
    approved,
    spent,
    events,
    sources,
    notify,
    goto,
    setModal,
    setSelectedPiece,
    setSelectedSource,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    brief,
    setBrief,
    generated,
    setGenerated,
    busy,
    setBusy,
    approvalFilter,
    setApprovalFilter,
    selectTopic,
    pieceTable,
  } = React.useContext(AppContext);
  const ready = pieces.filter((p) => p.status === "Aprovado");
  const scheduled = pieces
    .filter((p) => p.status === "Agendado")
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Cada peça, no seu momento.</h1>
          <p>O conteúdo aprovado encontra seu próximo destino.</p>
        </div>
        <button
          className="button secondary"
          disabled={!scheduled.length}
          onClick={() => {
            download(
              "esteira-agenda.csv",
              "Título;Canal;Data\n" +
                scheduled
                  .map((p) =>
                    [p.title, p.channel, p.scheduledAt]
                      .map((x) => '"' + String(x).replaceAll('"', '""') + '"')
                      .join(";"),
                  )
                  .join("\n"),
              "text/csv;charset=utf-8",
            );
            notify("Agenda exportada.");
          }}
        >
          <Download size={17} />
          Exportar agenda
        </button>
      </div>
      <div className="integration-note">
        <CalendarDays size={23} />
        <div>
          <b>Esta agenda é da sua demonstração.</b>
          <p>
            Os agendamentos ficam neste navegador. Conecte os canais na
            implantação para publicar nas redes.
          </p>
        </div>
        <span className="inline-label">CANAIS NÃO CONECTADOS</span>
      </div>
      <div className="section-header">
        <h2>
          Prontas para agendar{" "}
          <span className="count-label">{ready.length}</span>
        </h2>
      </div>
      {ready.length ? (
        <div className="ready-list">
          {ready.map((p) => (
            <div key={p.id}>
              <span className="ready-check">
                <Check size={20} />
              </span>
              <div>
                <h3>{p.title}</h3>
                <p>
                  {p.format} · Aprovada por {p.approver} · v{p.revision}
                </p>
              </div>
              <button
                className="button primary"
                onClick={() => setModal({ type: "schedule", id: p.id })}
              >
                Definir data <CalendarDays size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="compact-empty">
          <CheckCheck size={22} />
          <p>Quando uma peça for aprovada, ela aparece aqui.</p>
          <button className="text-button" onClick={() => goto("aprovar")}>
            Abrir revisão <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="section-header">
        <h2>
          Na agenda <span className="count-label">{scheduled.length}</span>
        </h2>
        <span>Horário local do navegador</span>
      </div>
      {scheduled.length ? (
        <div className="schedule-list">
          {scheduled.map((p) => (
            <article key={p.id}>
              <div className="schedule-date">
                <b>{new Date(p.scheduledAt).getDate()}</b>
                <span>
                  {new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(
                    new Date(p.scheduledAt),
                  )}
                </span>
              </div>
              <div>
                <small>
                  {p.channel} ·{" "}
                  {new Date(p.scheduledAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
                <h3>{p.title}</h3>
                <Badge status="Agendado" />
              </div>
              <button
                className="button secondary"
                onClick={() => download(`${p.title}.txt`, p.body)}
              >
                Exportar texto <Download size={16} />
              </button>
              <button
                className="icon-button"
                onClick={() => setSelectedPiece(p.id)}
                aria-label={`Abrir ${p.title}`}
              >
                <ArrowUpRight size={18} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={CalendarDays}
          title="Uma agenda com espaço para boas ideias."
          text="Aprove uma peça e defina o canal, a data e a hora do próximo capítulo."
        />
      )}
    </>
  );
}
function Caderno() {
  const {
    state,
    setState,
    workspace,
    pieces,
    pending,
    approved,
    spent,
    events,
    sources,
    notify,
    goto,
    setModal,
    setSelectedPiece,
    setSelectedSource,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    brief,
    setBrief,
    generated,
    setGenerated,
    busy,
    setBusy,
    approvalFilter,
    setApprovalFilter,
    selectTopic,
    pieceTable,
  } = React.useContext(AppContext);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>O critério também fica.</h1>
          <p>Decisões, ajustes e contexto. A memória editorial da equipe.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            download(
              "esteira-caderno.json",
              JSON.stringify(
                {
                  workspace: workspace.name,
                  exportedAt: new Date().toISOString(),
                  events,
                  pieces,
                },
                null,
                2,
              ),
              "application/json",
            );
            notify("Caderno exportado com peças e histórico.");
          }}
        >
          <Download size={17} />
          Exportar caderno
        </button>
      </div>
      <div className="notebook-intro">
        <BookOpen size={30} />
        <p>
          <b>O método pertence a quem o constrói.</b>
          <br />
          Cada ajuste explica uma escolha. Exporte o histórico sempre que
          precisar.
        </p>
      </div>
      {events.length ? (
        <div className="event-list">
          {events.map((e) => (
            <article key={e.id}>
              <div className="event-icon">
                {e.action === "approve" ? (
                  <Check size={18} />
                ) : e.action === "reject" ? (
                  <RotateCcw size={18} />
                ) : (
                  <PenLine size={18} />
                )}
              </div>
              <div>
                <small>
                  {e.author} · {new Date(e.at).toLocaleString("pt-BR")} · v
                  {e.revision}
                </small>
                <h3>{e.title}</h3>
                <p>{e.event}</p>
                {e.before && (
                  <details>
                    <summary>Ver o que mudou</summary>
                    <div className="change-comparison">
                      <div>
                        <b>Antes</b>
                        <p>{e.before}</p>
                      </div>
                      <div>
                        <b>Depois</b>
                        <p>{e.after}</p>
                      </div>
                    </div>
                  </details>
                )}
              </div>
              <button
                className="icon-button"
                onClick={() => setSelectedPiece(e.pieceId)}
                aria-label={`Ver peça ${e.title}`}
              >
                <ArrowUpRight size={18} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          icon={BookOpen}
          title="O primeiro critério começa com uma decisão."
          text="Aprove uma peça, solicite um ajuste ou edite um rascunho. O histórico aparece aqui."
          action={() => goto("aprovar")}
          label="Abrir revisão"
        />
      )}
      <div className="quiet-note">
        <ShieldCheck size={17} />
        <p>
          Decisões não viram regras automaticamente. Novos critérios precisam de
          validação da equipe.
        </p>
      </div>
    </>
  );
}
function Configuracoes() {
  const {
    state,
    setState,
    workspace,
    pieces,
    pending,
    approved,
    spent,
    events,
    sources,
    notify,
    goto,
    setModal,
    setSelectedPiece,
    setSelectedSource,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    brief,
    setBrief,
    generated,
    setGenerated,
    busy,
    setBusy,
    approvalFilter,
    setApprovalFilter,
    selectTopic,
    pieceTable,
  } = React.useContext(AppContext);
  const [budget, setBudget] = useState(state.budgets[state.workspace]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Um espaço com a sua voz.</h1>
          <p>Identidade, orçamento e conexões da operação.</p>
        </div>
      </div>
      <div className="settings-layout">
        <section className="settings-section">
          <h2>Identidade da marca</h2>
          <div className="workspace-identity">
            <span
              className="workspace-avatar"
              style={{ background: workspace.color }}
            >
              {workspace.initials}
            </span>
            <div>
              <h3>{workspace.name}</h3>
              <p>Grupo BBMD · espaço de demonstração</p>
            </div>
          </div>
          <dl>
            <div>
              <dt>Voz</dt>
              <dd>{workspace.voice}</dd>
            </div>
            <div>
              <dt>Público</dt>
              <dd>{workspace.audience}</dd>
            </div>
            <div>
              <dt>Critério editorial</dt>
              <dd>Fontes preservadas, linguagem clara e revisão humana.</dd>
            </div>
          </dl>
          <p className="field-help">
            Perfis demonstrativos. A implantação define identidade, acessos e
            critérios com cada equipe.
          </p>
        </section>
        <section className="settings-section">
          <h2>Orçamento estimado</h2>
          <p>
            Nova criação respeita o teto. Revisão e aprovação continuam
            disponíveis.
          </p>
          <div className="budget-summary">
            <b>{money(spent)}</b>
            <span>de {money(state.budgets[state.workspace])}</span>
          </div>
          <div className="budget-track">
            <i
              style={{
                width:
                  Math.min(
                    100,
                    (spent / Math.max(0.01, state.budgets[state.workspace])) *
                      100,
                  ) + "%",
              }}
            />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!Number.isFinite(Number(budget)) || Number(budget) < 0) {
                notify("Informe um teto válido.", true);
                return;
              }
              setState((s) => ({
                ...s,
                budgets: { ...s.budgets, [state.workspace]: Number(budget) },
              }));
              notify("Teto atualizado para este espaço.");
            }}
          >
            <label>
              Teto do espaço (R$)
              <input
                type="number"
                min="0"
                max="100000"
                step="0.01"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
            <button className="button secondary" type="submit">
              Salvar orçamento <Check size={16} />
            </button>
          </form>
          <div className="unit-cost">
            <span>Custo por peça aprovada</span>
            <b>
              {approved.length
                ? money(spent / approved.length)
                : "Aguardando aprovações"}
            </b>
          </div>
          <small>Custos ilustrativos, sem cobrança real.</small>
        </section>
        <section className="settings-section connections">
          <h2>Conexões da plataforma</h2>
          <p>
            Os conectores serão configurados na implantação. A demo funciona sem
            credenciais.
          </p>
          {[
            ["Acervo", "SharePoint / Google Drive"],
            ["Inteligência", "Gemini / provedor da equipe"],
            ["Publicação", "Blotato / canais sociais"],
            ["Radar", "Perfis próprios, concorrentes e referências"],
          ].map(([name, service]) => (
            <div className="connection-row" key={name}>
              <span>
                <b>{name}</b>
                <small>{service}</small>
              </span>
              <span>Não conectado</span>
            </div>
          ))}
        </section>
        <section className="settings-section">
          <h2>Seu ambiente de demonstração</h2>
          <p>
            Dados locais neste navegador. A troca de papel ilustra o fluxo; não
            é autenticação nem controle seguro de acesso.
          </p>
          <button
            className="button secondary"
            onClick={() =>
              download(
                "esteira-demo-backup.json",
                JSON.stringify(state, null, 2),
                "application/json",
              )
            }
          >
            <Download size={17} />
            Exportar dados
          </button>
          <button
            className="text-button danger-text"
            onClick={() => setModal("reset")}
          >
            <RotateCcw size={16} />
            Reiniciar demonstração
          </button>
        </section>
      </div>
    </>
  );
}

function SourceForm({ state, setState, notify, onClose }) {
  const [form, setForm] = useState({
    title: "",
    origin: "",
    url: "",
    text: "",
    shared: false,
    type: "Texto",
  });
  const [error, setError] = useState("");
  const fileRef = useRef();
  return (
    <Dialog title="Adicionar ao acervo" onClose={onClose} wide>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.title.trim() || !form.text.trim()) {
            setError("Informe um título e inclua o conteúdo.");
            return;
          }
          if (form.url && !/^https?:\/\//i.test(form.url)) {
            setError("Use um endereço começando com https:// ou http://.");
            return;
          }
          setState((s) => ({
            ...s,
            sources: [
              {
                ...form,
                id: crypto.randomUUID(),
                workspace: s.workspace,
                citable: !!form.origin.trim(),
                date: new Date().toISOString(),
                feedback: "",
                demo: false,
              },
              ...s.sources,
            ],
          }));
          notify("Referência adicionada ao acervo.");
          onClose();
        }}
      >
        <p>Um trecho, um roteiro ou uma referência que vale guardar.</p>
        <button
          type="button"
          className="upload-zone"
          onClick={() => fileRef.current.click()}
        >
          <Upload size={23} />
          <span>
            <b>Importar texto do computador</b>
            <small>Arquivos .txt e .md · até 2 MB</small>
          </span>
          <Plus size={18} />
        </button>
        <input
          type="file"
          ref={fileRef}
          hidden
          accept=".txt,.md,text/plain,text/markdown"
          onChange={async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            if (f.size > 2 * 1024 * 1024) {
              setError("Escolha um arquivo de até 2 MB.");
              return;
            }
            if (!/\.(txt|md)$/i.test(f.name)) {
              setError("Escolha um arquivo .txt ou .md.");
              return;
            }
            setForm({
              ...form,
              title: f.name.replace(/\.(txt|md)$/i, ""),
              text: await f.text(),
              type: "Documento",
            });
            setError("");
          }}
        />
        <label>
          Título
          <input
            required
            maxLength={160}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: entrevista sobre atendimento"
          />
        </label>
        <div className="field-pair">
          <label>
            Origem / autoria
            <input
              value={form.origin}
              onChange={(e) => setForm({ ...form, origin: e.target.value })}
              placeholder="Quem produziu este material?"
            />
          </label>
          <label>
            Link da fonte (opcional)
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://"
            />
          </label>
        </div>
        <label>
          Conteúdo
          <textarea
            required
            rows={6}
            value={form.text}
            maxLength={100000}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Cole o texto que a equipe poderá consultar…"
          />
        </label>
        <p className="field-help">
          O link registra a origem. O conteúdo deve ser colado ou importado; a
          demo não extrai páginas externas.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.shared}
            onChange={(e) => setForm({ ...form, shared: e.target.checked })}
          />
          Disponibilizar explicitamente na biblioteca compartilhada
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" type="submit">
            Guardar referência <Bookmark size={17} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function ScheduleForm({ piece, onClose, onSave }) {
  const [date, setDate] = useState("");
  const [channel, setChannel] = useState("LinkedIn");
  return (
    <Dialog title="Definir o próximo momento" onClose={onClose}>
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ date, channel });
        }}
      >
        <h3>{piece.title}</h3>
        <p>
          Versão {piece.revision} aprovada por {piece.approver}.
        </p>
        <label>
          Canal
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            {["LinkedIn", "Instagram", "YouTube", "TikTok", "Facebook"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Data e hora locais
          <input
            type="datetime-local"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <div className="quiet-note">
          <CalendarDays size={19} />
          <p>Será salvo na agenda local, sem envio para redes sociais.</p>
        </div>
        <div className="dialog-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" type="submit">
            Adicionar à agenda <Check size={17} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function PieceDetail({
  piece,
  state,
  setState,
  notify,
  doAction,
  onClose,
  onSchedule,
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(piece.body);
  const [sourceIds, setSourceIds] = useState(piece.sourceIds);
  const [reason, setReason] = useState("");
  const [reasonCategory, setReasonCategory] = useState("Clareza");
  const [rejecting, setRejecting] = useState(false);
  const [checked, setChecked] = useState(false);
  const sources = accessibleSources(state, piece.workspace);
  const issues = blockers(state, piece);
  const canApprove = ["Aprovador", "Administrador"].includes(state.role);
  const canEdit = ["Editor", "Administrador"].includes(state.role);
  return (
    <Dialog
      title={editing ? "Editar conteúdo" : "Revisão de conteúdo"}
      wide
      onClose={onClose}
    >
      <div className="piece-detail">
        <div className="piece-detail-heading">
          <div>
            <Badge status={piece.status} />
            <h2>{piece.title}</h2>
            <p>
              {piece.format} <span>·</span> {piece.owner} <span>·</span> Prazo{" "}
              {dateLabel(piece.deadline)} <span>·</span> Versão {piece.revision}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Exportar texto"
            onClick={() => download(`${piece.title}.txt`, piece.body)}
          >
            <Download size={19} />
          </button>
        </div>
        <div className="piece-detail-grid">
          <div className="piece-reading">
            {editing ? (
              <label>
                Texto da peça
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={16}
                />
              </label>
            ) : (
              <div className="piece-body">{piece.body}</div>
            )}
          </div>
          <aside className="piece-context">
            <h3>
              <Link size={16} />
              Fontes da versão
            </h3>
            {editing ? (
              sources.map((s) => (
                <label className="checkbox-label source-checkbox" key={s.id}>
                  <input
                    type="checkbox"
                    checked={sourceIds.includes(s.id)}
                    disabled={!s.citable}
                    onChange={(e) =>
                      setSourceIds(
                        e.target.checked
                          ? [...sourceIds, s.id]
                          : sourceIds.filter((id) => id !== s.id),
                      )
                    }
                  />
                  <span>
                    {s.title}
                    <small>{s.citable ? s.origin : "Origem pendente"}</small>
                  </span>
                </label>
              ))
            ) : piece.sourceIds.length ? (
              piece.sourceIds.map((id) => {
                const source = sources.find((s) => s.id === id);
                return (
                  <div className="piece-source" key={id}>
                    <b>{source?.title || "Fonte indisponível"}</b>
                    <small>{source?.origin}</small>
                    <p>{source?.text.slice(0, 260)}</p>
                    {source?.url && (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        Ver origem <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="form-error">Nenhuma fonte vinculada.</p>
            )}
            <div className="revision-summary">
              <ShieldCheck size={20} />
              <p>
                {piece.approver
                  ? `Versão ${piece.approvedRevision} aprovada por ${piece.approver}.`
                  : "A fonte apoia a revisão. A conferência dos fatos e do contexto é humana."}
              </p>
            </div>
            <div className="piece-cost">
              <span>Custo estimado</span>
              <b>{money(piece.cost)}</b>
            </div>
          </aside>
        </div>
        {issues.length > 0 && !editing && (
          <div className="validation-warning">
            <AlertTriangle size={19} />
            <div>
              <b>Antes de continuar</b>
              {issues.map((i) => (
                <p key={i}>{i}</p>
              ))}
            </div>
          </div>
        )}
        {piece.status === "Em revisão" &&
          !editing &&
          !issues.length &&
          canApprove && (
            <label className="checkbox-label approval-confirmation">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              Conferi o texto, as fontes e os critérios editoriais desta marca.
            </label>
          )}
        {rejecting && (
          <div className="reject-group">
            <label className="reject-field">
              Critério do ajuste
              <select
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
              >
                {[
                  "Clareza",
                  "Voz da marca",
                  "Fonte / contexto",
                  "Formato",
                  "Outro",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="reject-field">
              O que precisa mudar?
              <textarea
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Explique o critério para quem vai ajustar."
              />
            </label>
          </div>
        )}
        <div className="piece-actions">
          {editing ? (
            <>
              <button
                className="button secondary"
                onClick={() => setEditing(false)}
              >
                Cancelar edição
              </button>
              <button
                className="button primary"
                onClick={() => {
                  if (!body.trim()) {
                    notify("O texto não pode ficar vazio.", true);
                    return;
                  }
                  try {
                    setState(
                      transition(state, piece.id, "edit", { body, sourceIds }),
                    );
                    notify("Edição salva. A peça precisa de uma nova revisão.");
                  } catch (e) {
                    notify(e.message, true);
                  }
                }}
              >
                Salvar nova versão <Check size={17} />
              </button>
            </>
          ) : (
            <>
              <button
                className="button secondary"
                disabled={!canEdit}
                onClick={() => setEditing(true)}
              >
                <PenLine size={16} />
                Editar peça
              </button>
              <div>
                {["Rascunho", "Ajustes"].includes(piece.status) && (
                  <button
                    className="button primary"
                    disabled={!canEdit || issues.length > 0}
                    onClick={() => doAction(piece.id, "review")}
                  >
                    Enviar para revisão <Send size={16} />
                  </button>
                )}
                {piece.status === "Em revisão" && (
                  <>
                    {rejecting ? (
                      <>
                        <button
                          className="text-button"
                          onClick={() => setRejecting(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          className="button dark"
                          disabled={!reason.trim()}
                          onClick={() =>
                            doAction(piece.id, "reject", {
                              reason: `[${reasonCategory}] ${reason}`,
                              category: reasonCategory,
                            })
                          }
                        >
                          Registrar ajuste <RotateCcw size={16} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="button secondary"
                          disabled={!canApprove}
                          onClick={() => setRejecting(true)}
                        >
                          Solicitar ajuste
                        </button>
                        <button
                          className="button primary"
                          disabled={
                            !canApprove || issues.length > 0 || !checked
                          }
                          onClick={() =>
                            doAction(piece.id, "approve", { author: "Beto" })
                          }
                        >
                          Aprovar versão <CheckCheck size={17} />
                        </button>
                      </>
                    )}
                  </>
                )}
                {piece.status === "Aprovado" && (
                  <button className="button primary" onClick={onSchedule}>
                    Definir data <CalendarDays size={17} />
                  </button>
                )}
                {piece.status === "Agendado" && (
                  <span className="scheduled-message">
                    <CalendarDays size={17} />
                    {dateLabel(piece.scheduledAt)} · {piece.channel}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {!editing && piece.status === "Em revisão" && !canApprove && (
          <p className="detail-role-note">
            Troque o papel para Aprovador no topo da plataforma para
            experimentar a revisão.
          </p>
        )}
      </div>
    </Dialog>
  );
}
createRoot(document.getElementById("root")).render(<App />);
