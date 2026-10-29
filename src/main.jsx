import { Connections, MediaStudio } from "./Connections";
import { visibleTo } from "./visibility.mjs";
import { ChannelImport } from "./ChannelImport";
import { isClassicHash } from "./routes.mjs";
import { queueIdea } from './writing-queue.mjs';
import { SourceRole } from './SourceRole';
import { SecondBrain } from './SecondBrain';
import { GuidedTour } from './GuidedTour';
import { shouldOfferTour, tourPreference } from './tour.mjs';
import { createAccountState, workspaceList, organizationType } from './account-state.mjs';
import { OrganizationSettings, GroupOverview } from './Organization';
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
  Brain,
  Building2,
  Compass,
  LogOut,
  Briefcase,
  PanelLeftClose,
  Megaphone,
  PanelLeftOpen,
} from "lucide-react";
import { Portfolio } from "./Portfolio";
import Landing, { Brand } from "./Landing";
const LandingMotion = React.lazy(() => import("./LandingMotion"));
import {
  initialState,
  workspaces,
  accessibleSources,
  blockers,
  transition,
  removePiece,
  createPiece,
  variants,
  storageKey,
  statusLabel,
  boardColumn,
} from "./workflow.mjs";
import { AppContext } from "./context";
import {
  Radar,
  Writer,
  Kanban,
  Squad,
  VoiceSettings,
  PieceCouncil,
  MemoryRules,
  MonitorSources,
} from "./Advanced";
import {
  hydrateOperations,
  runLocalRadar,
  assertEditor,
  assertAdmin,
  sourceValid,
  sourceCaptureProblem,
  SOURCE_ROLES,
} from "./operations.mjs";
import "./theme.css";
import "./styles.css";
import "./review.css";
import "./app-skin.css";
import { SourceMetadata,SourceRefresh, SourceDelete, PublicationControls, Results } from "./Continuity";
import { Campaigns, PieceLineage } from "./Campaigns";
import { AccountRoot } from './Account';
import { ThemeSwitch, ThemeSetting } from "./ThemeSwitch";
import { StageRail } from "./StageRail";
import { Subtabs, Subpanel, useSubtab } from "./Subtabs";
import { RefinePanel } from "./RefinePanel";
import { longFetch } from "./long-fetch.mjs";
import { SpendTile, AiBudgetSettings } from "./AiBudget";

const navItems = [
  ["painel", "Visão geral", LayoutDashboard],
  ["kanban", "Kanban", Layers],
  ['grupo','Visão do grupo',Building2],
  ["campanhas", "Campanhas", Megaphone],
  ["guardar", "Pesquisar", Search],
  ["vigiar", "Vigiar", Radio],
  ["escrever", "Escrever", PenLine],
  ["aprovar", "Aprovar", CheckCheck],
  ["publicar", "Publicar", CalendarDays],
  ["cerebro", "Segundo cérebro", Brain],
  ["caderno", "Caderno de decisões", BookOpen],
  ["agentes", "Time de agentes", Users],
  ["resultados", "Resultados", Coins],
  ["portfolio", "Portfólio", Briefcase],
];
const groupNavItems = [
  ["grupo", "Visão geral do grupo", LayoutDashboard],
  ["agentes", "Time de agentes", Users],
];
const GROUP_ROUTES = ["grupo", "agentes", "configuracoes", "organizacao"];
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
    "Em conferência": "review",
    Publicado: "approved",
    Pedido: "draft",
    "Pauta escolhida": "draft",
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
      {statusLabel(status)}
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

const readRoute = () => {
  // Sub-tabs live after the page (#app/cerebro/dna); the page is the first segment.
  const route = location.hash.startsWith('#app/') ? location.hash.slice(5).split(/[/?]/)[0] : isClassicHash(location.hash) ? 'landing' : 'motion';
  return route === 'pesquisar' ? 'guardar' : route;
};
function App({ account, initialData, persist, syncStatus, onLogout }) {
  const [route, setRoute] = useState(
    readRoute(),
  );
  const [state, setState] = useState(() => {
    if(account) return initialData ? hydrateOperations(initialData,workspaceList(initialData,{includeArchived:true})) : createAccountState(account);
    try {
      const base = initialState();
      const s = JSON.parse(localStorage.getItem(storageKey));
      return s?.version === 1 &&
        Array.isArray(s.pieces) &&
        Array.isArray(s.sources) &&
        workspaces.some((w) => w.id === s.workspace)
        ? hydrateOperations(
            {
              ...base,
              ...s,
              sources: [
                ...s.sources,
                ...base.sources.filter(
                  (x) => !s.sources.some((y) => y.id === x.id),
                ),
              ],
            },
            workspaces,
          )
        : base;
    } catch {
      return initialState();
    }
  });
  const activeWorkspaces = workspaceList(state);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setState((current) => {
          if (current.role === "Observador") return current;
          let next = current;
          for (const [id, config] of Object.entries(current.radar)) {
            if(!workspaceList(current).some(w=>w.id===id))continue;
            if (
              config.enabled &&
              config.nextRun &&
              new Date(config.nextRun) <= new Date()
            ) {
              const targets =
                config.scope === "all" ? workspaceList(current).map((w) => w.id) : [id];
              for (const target of targets)
                next = runLocalRadar(next, target, true);
            }
          }
          return next;
        }),
      30000,
    );
    return () => clearInterval(timer);
  }, []);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();
  const [mobile, setMobile] = useState(false);
  // Compact keeps every destination one click away as an icon rail; the older "hidden" preference maps to it.
  const [sidebarCompact, setSidebarCompact] = useState(() => {
    try { return (localStorage.getItem('memorable-sidebar-compact') ?? localStorage.getItem('memorable-sidebar-hidden') ?? localStorage.getItem('skyvidya-sidebar-hidden')) === 'true'; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarCompact(compact => {
    try { localStorage.setItem('memorable-sidebar-compact', String(!compact)); } catch {}
    return !compact;
  });
  const toggleSidebarRef = useRef(toggleSidebar);
  toggleSidebarRef.current = toggleSidebar;
  const [modal, setModal] = useState(null);
  const [tourOpen, setTourOpen] = useState(false);
  const tourActive = useRef(false), tourRestoring = useRef(false);
  tourActive.current = tourOpen;
  const tourOrigin = useRef(null);
  // The exact address the tour started from, sub-tab included, restored when it closes.
  const tourOriginHash = useRef("");
  const tourSessionKey = `memorable-tour-dismissed:${account?.id || 'demo'}`;
  const tourDismissed = useRef(false);
  const startTour = () => {
    if (modal || selectedPiece || selectedSource) return;
    tourOrigin.current = route;
    tourOriginHash.current = location.hash;
    setMobile(false);
    setTourOpen(true);
  };
  const closeTour = (status, dontShowAgain) => {
    tourDismissed.current = true;
    try { sessionStorage.setItem(tourSessionKey, 'true'); } catch {}
    setState(s => ({...s, onboarding:{...s.onboarding, tour:tourPreference(status,dontShowAgain)}}));
    setTourOpen(false);
    if(tourOrigin.current && tourOrigin.current !== 'landing') {
      tourRestoring.current = route !== tourOrigin.current;
      setRoute(tourOrigin.current);
      if (tourOriginHash.current.startsWith(`#app/${tourOrigin.current}`)) location.hash = tourOriginHash.current.slice(1);
      else goto(tourOrigin.current);
    }
  };
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("Todos");
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [selectedSource, setSelectedSource] = useState(null);
  const [brief, setBrief] = useState({
    title: account ? '' : 'Clareza no primeiro atendimento',
    format: "LinkedIn",
    versionCount: 1,
    source: accessibleSources(state,state.workspace)[0]?.id || '',
    deadline: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    owner: "Editor",
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
      if(account) persist(state);
      else localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      notify(
        "Não foi possível salvar no navegador. Exporte o caderno para preservar seu trabalho.",
        true,
      );
    }
  }, [state]);
  useEffect(() => {
    const change = () => {
      const next = readRoute();
      setRoute(next);
      setMobile(false);
      if (!tourActive.current && !tourRestoring.current) {
        setQuery("");
        setSourceFilter("Todos");
      }
      tourRestoring.current = false;
      if (!["landing", "motion"].includes(next)) window.scrollTo(0, 0);
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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebarRef.current();
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
    activeWorkspaces.find((w) => w.id === state.workspace) || activeWorkspaces[0];
  const pieces = state.pieces.filter((p) => p.workspace === state.workspace);
  const sources = accessibleSources(state, state.workspace);
  const pending = pieces.filter((p) => p.status === "Em revisão");
  const approved = pieces.filter((p) =>
    ["Aprovado", "Agendado"].includes(p.status),
  );
  const spent = pieces.reduce((s, p) => s + p.cost, 0);
  const events = state.events.filter((e) => e.workspace === state.workspace);
  const goto = (tab) => {
    location.hash = `app/${tab === 'guardar' ? 'pesquisar' : tab}`;
  };
  const isGroup = organizationType(state) === "group";
  const [groupScope, setGroupScope] = useState(() => readRoute() === "grupo");
  useEffect(() => {
    if (route === "grupo" && isGroup) setGroupScope(true);
    else if (!GROUP_ROUTES.includes(route) && route !== "landing" && route !== "motion") setGroupScope(false);
  }, [route, isGroup]);
  const enterGroup = () => {
    setGroupScope(true);
    goto("grupo");
  };
  const changeWorkspace = (id) => {
    setGroupScope(false);
    setState((s) => ({ ...s, workspace: id }));
    setSelectedPiece(null);
    setSelectedSource(null);
    setGenerated(null);
    setQuery("");
    setBrief((b) => ({
      ...b,
      title: "",
      source: accessibleSources(state, id)[0]?.id || "",
      campaignId: '', parentId: null, thesis: '', angle: '', cta: '', audience: '', topicId: undefined, origin: 'manual',
      experience: '', offer: '', inspirationId: '', handoffKey:null,queueId:null,
    }));
  };
  const doAction = (id, action, payload = {}) => {
    try {
      setState(transition(state, id, action, payload));
      notify(
        action === "approve"
          ? "Conteúdo aprovado. Agora ele pode entrar na agenda."
          : action === "reject"
            ? "Ajuste registrado. O conteúdo voltou para a escrita."
            : action === "schedule"
              ? "Conteúdo adicionado à agenda local."
              : action === "review"
                ? "Conteúdo enviado para revisão."
                : action === "move"
                  ? `Conteúdo movido para ${payload.status}.`
                  : action === "retract"
                    ? `Conteúdo recolhido da revisão para ${payload.status}.`
                    : action === "reopen"
                      ? `Conteúdo reaberto em ${payload.status}; a aprovação foi desfeita.`
                      : action === "unschedule"
                        ? "Agendamento cancelado; a aprovação foi mantida."
                        : "Alteração registrada.",
      );
      return true;
    } catch (e) {
      notify(e.message, true);
      return false;
    }
  };
  const selectTopic = (title, source, extra = {}) => {
    let result;
    try { result=queueIdea(state,title,source,extra); } catch(error){notify(error.message,true);return;}
    setState(result.state);
    setBrief((b) => ({
      ...b,
      title,
      source,
      thesis: "",
      angle: "",
      cta: "",
      topicId: undefined,
      campaignId: "",
      parentId: null,
      origin: "source",
      ...extra,
      queueId:result.item.id,
      handoffKey:crypto.randomUUID(),
    }));
    setGenerated(null);
    goto("escrever");
  };
  const pageTitle =
    (groupScope && groupNavItems.find((i) => i[0] === route)?.[1]) ||
    navItems.find((i) => i[0] === route)?.[1] || (route==='organizacao'?'Organização e marcas':'Configurações');
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
  const contentRoute = tourOpen ? tourOrigin.current : route;
  const renderPage = page => page === 'grupo' ? <GroupOverview/> : page === 'organizacao' ? <OrganizationSettings/> : page === 'painel' ? <Dashboard/> : page === 'guardar' ? <Guardar/> : page === 'vigiar' ? <Radar/> : page === 'escrever' ? <Writer/> : page === 'campanhas' ? <Campaigns/> : page === 'kanban' ? <Kanban/> : page === 'resultados' ? <Results/> : page === 'portfolio' ? <Portfolio/> : page === 'agentes' ? <Squad/> : page === 'aprovar' ? <Aprovar/> : page === 'publicar' ? <Publicar/> : page === 'caderno' ? <Caderno/> : page === 'cerebro' ? <SecondBrain/> : <Configuracoes/>;
  useEffect(() => {
    let dismissed = tourDismissed.current;
    try { dismissed ||= sessionStorage.getItem(tourSessionKey) === 'true'; } catch {}
    if(!['landing','motion'].includes(route) && !modal && !selectedPiece && !selectedSource && !tourOpen && shouldOfferTour(state.onboarding?.tour,dismissed)) {
      tourOrigin.current = route;
      tourOriginHash.current = location.hash;
      setTourOpen(true);
    }
  },[route,modal,selectedPiece,selectedSource,tourOpen,state.onboarding?.tour]);
  return (
    <AppContext.Provider
      value={{
        toast,
        setToast,
        state,
        account,
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
        changeWorkspace,
        groupScope,
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
        doAction,
      }}
    >
      {route === "landing" ? (
        <Landing />
      ) : route === "motion" ? (
        <React.Suspense fallback={<div className="mx-loading" />}>
          <LandingMotion account={account} onLogout={onLogout} />
        </React.Suspense>
      ) : (
        <div data-tour-active={tourOpen} className={`app-shell ${sidebarCompact ? 'sidebar-compact' : ''}`}>
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
          <aside id="platform-sidebar" className={`sidebar ${mobile ? "sidebar-open" : ""}`}>
            <div className="sidebar-logo">
              <Brand />
              <button className="icon-button sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCompact ? "Expandir menu lateral" : "Recolher menu lateral"} aria-controls="platform-sidebar" aria-expanded={!sidebarCompact} title={`${sidebarCompact ? "Expandir" : "Recolher"} menu (Ctrl+B)`}>{sidebarCompact ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button>
              <button
                className="icon-button mobile-only"
                onClick={() => setMobile(false)}
                aria-label="Fechar menu"
              >
                <X />
              </button>
            </div>
            <div className="organization-label">
              {account ? state.organizationName : 'GRUPO BBMD'}<span>{account ? organizationType(state)==='group'?'GRUPO':'CONTA' : 'DEMO'}</span>
            </div>
            <div className="workspace-select-wrap" onClick={() => sidebarCompact && toggleSidebar()}>
              <span
                className="workspace-avatar"
                style={groupScope ? { background: "var(--accent)", color: "var(--on-accent)" } : { background: workspace.color }}
              >
                {groupScope ? <Building2 size={17} aria-hidden="true" /> : workspace.initials}
              </span>
              <label>
                <span>{isGroup ? "Grupo ou marca" : "Marca"}</span>
                <select
                  aria-label="Escopo: grupo ou marca"
                  value={groupScope ? "__group__" : state.workspace}
                  onChange={(e) => {
                    if (e.target.value === "__group__") enterGroup();
                    else {
                      changeWorkspace(e.target.value);
                      if (["grupo"].includes(route)) goto("painel");
                    }
                  }}
                >
                  {isGroup && (
                    <option value="__group__">{(account ? state.organizationName : "Grupo BBMD") + " · todas as marcas"}</option>
                  )}
                  {activeWorkspaces.map((w) => (
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
              {groupScope && <div className="nav-group-label">ACOMPANHAMENTO DO GRUPO</div>}
              {(groupScope ? groupNavItems : navItems.filter(([id]) => id !== "grupo")).map(([id, name, Icon], i) => (
                <React.Fragment key={id}>
                  {!groupScope && id === 'campanhas' && <div className="nav-group-label">PLANEJAMENTO</div>}
                  {id === 'guardar' && <div className="nav-group-label">PRODUÇÃO DE CONTEÚDO</div>}
                  {id === 'cerebro' && <div className="nav-group-label">CONTEXTO E APRENDIZADO</div>}
                  <a
                    href={`#app/${id === 'guardar' ? 'pesquisar' : id}`}
                    className={route === id ? "active" : ""}
                    title={sidebarCompact ? name : undefined}
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
            {groupScope && (
              <p className="nav-scope-hint">Para pesquisar, escrever e aprovar, escolha uma marca no seletor acima.</p>
            )}
            <div className="sidebar-bottom">
              <div className="sidebar-mobile-tools">
                <label className="role-select">
                  <span>Papel</span>
                  <select aria-label="Trocar papel" value={state.role} onChange={(e) => setState((s) => ({ ...s, role: e.target.value }))}>
                    <option>Editor</option>
                    <option>Aprovador</option>
                    <option>Administrador</option>
                    <option>Observador</option>
                  </select>
                </label>
                {account ? <button className="text-button" onClick={onLogout}>Sair da conta</button> : <a className="text-button" href="#auth">Entrar / Criar conta</a>}
              </div>
              {account&&<a href="#app/organizacao" title={sidebarCompact?'Organização e marcas':undefined} className={route==='organizacao'?'active':''}><Building2 size={19}/>Organização e marcas</a>}
              <a
                className={route === "configuracoes" ? "active" : ""}
                href="#app/configuracoes"
                title={sidebarCompact ? "Configurações" : undefined}
              >
                <Settings size={19} />
                Configurações
              </a>
              <div className="user-profile">
                <span className="avatar">
                  {(account?.name || state.role).slice(0,2).toUpperCase()}
                </span>
                <div>
                  <b>{account?.name || state.role}</b>
                  <span>{account ? 'Sua conta' : 'Equipe de marketing'}</span>
                </div>
                {account ? <button className="icon-button" onClick={onLogout} aria-label="Sair da conta"><LogOut size={17}/></button> : <a href="#" aria-label="Voltar à apresentação">
                  <LogOut size={17} />
                </a>}
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
                <span>{groupScope ? (account ? state.organizationName : "Grupo BBMD") : workspace.name}</span>
                <ChevronRight size={15} />
                <b>{pageTitle}</b>
              </div>
              <div className="topbar-right">
                <ThemeSwitch />
                <button className="tour-launcher" onClick={startTour} aria-label="Tour guiado" title="Repetir tour guiado"><Compass size={17}/><span>Tour guiado</span></button>
                {account ? <><span className={syncStatus === "Salvo" ? "sr-only" : "account-sync"} role="status">{syncStatus}</span><button className="text-button" onClick={onLogout}>Sair da conta</button></> : <a className="text-button" href="#auth">Entrar / Criar conta</a>}
                <span className="demo-indicator">
                  <span />
                  {account ? account.name : 'Demonstração local'}
                </span>
                <label className="role-select">
                  <span>Papel</span>
                  <select
                    aria-label={account ? 'Papel na marca' : 'Papel na demonstração'}
                    value={state.role}
                    onChange={(e) =>
                      setState((s) => ({ ...s, role: e.target.value }))
                    }
                  >
                    <option>Editor</option>
                    <option>Aprovador</option>
                    <option>Administrador</option>
                    <option>Observador</option>
                  </select>
                </label>
              </div>
            </header>
            <main
              id="app-main"
              tabIndex={-1}
              className="app-main"
              key={contentRoute + "-" + state.workspace}
              hidden={tourOpen && route !== contentRoute}
              style={tourOpen && route !== contentRoute ? {display:'none'} : undefined}
            >
              {renderPage(contentRoute)}
            </main>
            {tourOpen && route !== contentRoute && <main className="app-main" key={`tour-preview-${route}`}>{renderPage(route)}</main>}
            <footer className="app-footer">
              <span>
                Memorável.{" "}
                <span>O jeito certo de deixar sua marca no mundo.</span>
              </span>
              <span>Versão de validação</span>
            </footer>
          </div>
        </div>
      )}
      {tourOpen && !['landing','motion'].includes(route) && <GuidedTour preference={state.onboarding?.tour} goto={goto} onClose={closeTour}/>}
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
      {modal === "reset" && !account && (
        <Dialog
          title="Recomeçar a demonstração?"
          onClose={() => setModal(null)}
        >
          <div className="dialog-body">
            <p>
              Isso remove os conteúdos, fontes e decisões criados nesta demo e
              restaura os exemplos iniciais. Exporte os dados em Configurações
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
            ) && <p>Nenhum resultado nesta marca. Tente outra palavra.</p>}
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
            {sourceCaptureProblem(activeSource) && (
              <div className="validation-warning">
                <AlertTriangle size={18} />
                <span><b>Conteúdo não aproveitável.</b> {sourceCaptureProblem(activeSource)} Edite e substitua pelo texto autorizado, ou exclua esta referência.</span>
              </div>
            )}
            {(activeSource.summary || activeSource.keywords?.length) && <section className="source-insights" aria-label="Resumo">
              <small className="label">Resumo</small>
              {activeSource.summary && <p>{activeSource.summary}</p>}
              {activeSource.keywords?.length > 0 && <div className="source-keywords">{activeSource.keywords.map(keyword => <span key={keyword}>{keyword}</span>)}</div>}
              {activeSource.extraction?.method && <small>{activeSource.extraction.method} · {new Date(activeSource.extraction.extractedAt).toLocaleString('pt-BR')}</small>}
            </section>}
            <details className="source-transcript" open>
              <summary>{activeSource.type === 'Vídeo' ? 'Transcrição completa' : 'Conteúdo completo'}</summary>
              <div className="source-fulltext" role="region" tabIndex={0} aria-label="Texto completo da referência"><blockquote>{activeSource.transcript || activeSource.text}</blockquote></div>
            </details>
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
            <SourceRefresh key={activeSource.id} source={activeSource}/>
            <details className="source-settings"><summary>Classificar referência</summary><SourceRole source={activeSource}/></details>
            <SourceMetadata key={`${activeSource.id}-${activeSource.extraction?.extractedAt||''}`} source={activeSource} />
            <div className="source-feedback">
              <span>Este material já foi usado?</span>
              {["Funcionou", "Não funcionou"].map((f) => (
                <button
                  className={`button secondary ${activeSource.feedback === f ? "selected" : ""}`}
                  key={f}
                  onClick={() => {
                    try {
                      assertEditor(state);
                    } catch (e) {
                      notify(e.message, true);
                      return;
                    }
                    if (activeSource.workspace !== state.workspace) {
                      notify(
                        "Abra a marca de origem para avaliar este material.",
                        true,
                      );
                      return;
                    }
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
            <SourceDelete source={activeSource} />
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
                disabled={!sourceValid(activeSource)}
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
            Sua marca,
            <br className="mobile-only" /> em movimento.
          </h1>
          <p>O que está sendo criado, o que espera a sua decisão e o que já está no mundo.</p>
        </div>
        <button className="button primary" onClick={() => goto("escrever")}>
          <Plus size={18} />
          Criar conteúdo
        </button>
      </div>
      <div className="dashboard-metrics">
        <div>
          <span>Em produção</span>
          <b>{pieces.length.toString().padStart(2, "0")}</b>
          <small>conteúdos nesta marca</small>
        </div>
        <div>
          <span>Esperando revisão</span>
          <b>
            {pending.length.toString().padStart(2, "0")}
          </b>
          <small>próxima decisão humana</small>
        </div>
        <div>
          <span>Aprovadas</span>
          <b>{approved.length.toString().padStart(2, "0")}</b>
          <small>prontas para o próximo passo</small>
        </div>
        <SpendTile fallback={<div>
          <span>Custo estimado</span>
          <b className="money-metric">{money(spent)}</b>
          <small>valores demonstrativos</small>
        </div>} />
      </div>
      <div className="dashboard-middle">
        <div className="attention-panel">
          <div className="panel-label">
            <span className="attention-symbol">
              <CheckCheck size={20} />
            </span>
          </div>
          <h2>
            {pending.length
              ? `${pending.length} ${pending.length === 1 ? "conteúdo espera" : "conteúdos esperam"} pelo seu olhar.`
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
            {["Escrevendo", "Em aprovação", "Aprovado", "Agendado"].map((s, i) => {
              const count = pieces.filter((p) => boardColumn(p.status).name === s).length;
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
                    {s}
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
        <button className="text-button" onClick={() => goto("kanban")}>
          Ver quadro <ArrowRight size={17} />
        </button>
      </div>
      {pieces.length ? (
        pieceTable(pieces.slice(0, 5))
      ) : (
        <Empty
          title="Seu primeiro conteúdo começa no acervo."
          text="Escolha uma referência para começar a produção."
          action={() => goto("guardar")}
          label="Abrir acervo"
        />
      )}
      <div className="pilot-note">
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
      (sourceFilter === "Todos" || s.type === sourceFilter ||
       (sourceFilter === "Não citáveis" && !sourceValid(s)) ||
       (sourceFilter === "Nunca usados" && !pieces.some(p=>p.sourceIds.includes(s.id))) ||
       (sourceFilter === "Vence em breve" && s.validUntil && new Date(s.validUntil+'T23:59:59') <= new Date(Date.now()+7*86400000)) ||
       (sourceFilter === "Biblioteca do grupo" && s.shared)) &&
      (s.title + " " + s.text + " " + s.origin + " " + (s.tags||[]).join(' '))
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Tudo o que inspira a sua marca.</h1>
          <p>Traga sites, vídeos, canais e documentos. Cada referência vira base para conteúdos com fonte.</p>
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
            · {sources.filter((s) => s.workspace === workspace.id).length} desta
            marca
          </span>
        </p>
        <span className="inline-label">{workspace.name}</span>
      </div>
      <div className="filter-bar">
        <div className="segmented">
          {["Todos", "Web", "Vídeo", "Social", "Documento", "Podcast", "Texto", "Notícia", "Não citáveis", "Nunca usados", "Vence em breve", "Biblioteca do grupo"].map((t) => (
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
                className={`source-citable ${sourceValid(s) ? "" : "uncitable"}`}
              >
                {sourceValid(s) && s.internal ? (
                  <>
                    <Link size={14} />
                    Fonte interna · não pública
                  </>
                ) : sourceValid(s) ? (
                  <>
                    <Link size={14} />
                    Fonte vinculada
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} />
                    {sourceCaptureProblem(s) ? "Conteúdo indisponível" : "Origem pendente"}
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
      <details className="research-monitoring"><summary>Acompanhar atualizações</summary><p>Importe uma referência no acervo e escolha se deseja consultá-la novamente. As atualizações alimentam o mesmo acervo e o Radar.</p><MonitorSources /></details>
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
          <h1>A última palavra é sua.</h1>
          <p>Confira texto e fontes e aprove a versão que vai para o mundo.</p>
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
              {statusLabel(t)}
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
                <div className="kanban-empty">Nenhum conteúdo nesta etapa.</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={CheckCheck}
          title="Tudo em dia por aqui."
          text="Os conteúdos desta etapa aparecerão quando o trabalho avançar."
          action={() => goto("escrever")}
          label="Criar conteúdo"
        />
      )}
      <div className="quiet-note">
        <CheckCheck size={18} />
        <p>
          A aprovação vale para uma versão. Qualquer edição devolve o conteúdo à
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
  const published = pieces.filter((p) => p.status === "Publicado");
  const scheduled = pieces
    .filter((p) => p.status === "Agendado")
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Sua marca onde o público está.</h1>
          <p>Agende cada conteúdo aprovado por canal e exporte no formato de cada rede.</p>
        </div>
        <button
          className="button secondary"
          disabled={!scheduled.length}
          onClick={() => {
            download(
              "memorable-agenda.csv",
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
          <p>Quando um conteúdo for aprovado, ele aparece aqui.</p>
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
          text="Aprove um conteúdo e defina o canal, a data e a hora do próximo capítulo."
        />
      )}
      <div className="section-header"><h2>Publicações registradas <span className="count-label">{published.length}</span></h2></div>
      {published.length ? pieceTable(published) : <p className="field-help">O time pode registrar a URL de uma publicação realizada fora da plataforma.</p>}
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
          <h1>O que você decide, a IA aprende.</h1>
          <p>Cada ajuste que a equipe valida vira orientação para os próximos conteúdos.</p>
        </div>
        <button
          className="button secondary"
          onClick={() => {
            download(
              "memorable-caderno.json",
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
            notify("Caderno exportado com conteúdos e histórico.");
          }}
        >
          <Download size={17} />
          Exportar caderno
        </button>
      </div>
      <MemoryRules />
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
                aria-label={`Ver conteúdo ${e.title}`}
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
          text="Aprove um conteúdo, solicite um ajuste ou edite um rascunho. O histórico aparece aqui."
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
    account,
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
  // The account and the platform. Brand identity and voice live in Segundo cérebro.
  const [tab, setTab] = useSubtab("configuracoes", ["conexoes", "orcamento", "aparencia", "conta"]);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>A plataforma, do seu jeito.</h1>
          <p>Conexões com provedores, orçamento, aparência e os dados da sua conta.</p>
        </div>
      </div>
      <Subtabs
        label="Seções de configurações"
        value={tab}
        onChange={setTab}
        items={[
          ["conexoes", "Conexões"],
          ["orcamento", "Orçamento"],
          ["aparencia", "Aparência"],
          ["conta", account ? "Dados da conta" : "Demonstração"],
        ]}
      />
      {tab === "aparencia" && <Subpanel id="aparencia"><section className="r-panel settings-appearance">
        <div>
          <h2>Aparência</h2>
          <p>Claro em papel ou escuro como o estúdio da landing. Seguindo o sistema, a plataforma acompanha o modo do seu computador.</p>
        </div>
        <ThemeSetting />
      </section></Subpanel>}
      {tab === "conexoes" && <Subpanel id="conexoes"><Connections /></Subpanel>}
      {tab === "orcamento" && <Subpanel id="orcamento"><div className="settings-layout settings-single">
        <AiBudgetSettings />
        <section className="settings-section">
          <h2>Orçamento de {workspace.name}</h2>
          <p>
            Nova criação respeita o teto desta marca. Revisão e aprovação continuam
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
              try {
                assertAdmin(state);
              } catch (e) {
                notify(e.message, true);
                return;
              }
              if (!Number.isFinite(Number(budget)) || Number(budget) < 0) {
                notify("Informe um teto válido.", true);
                return;
              }
              setState((s) => ({
                ...s,
                budgets: { ...s.budgets, [state.workspace]: Number(budget) },
              }));
              notify("Teto atualizado para esta marca.");
            }}
          >
            <label>
              Teto da marca (R$)
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
            <span>Custo por conteúdo aprovado</span>
            <b>
              {approved.length
                ? money(spent / approved.length)
                : "Aguardando aprovações"}
            </b>
          </div>
          <small>Custos ilustrativos, sem cobrança real.</small>
        </section>
      </div></Subpanel>}
      {tab === "conta" && <Subpanel id="conta"><div className="settings-layout settings-single">
        <section className="settings-section">
          <h2>{account ? 'Dados da sua conta' : 'Seu ambiente de demonstração'}</h2>
          <p>
            {account ? 'Dados salvos no SQLite do serviço local e separados por conta. Os papéis ilustram responsabilidades editoriais dentro desta marca.' : 'Dados locais neste navegador. A troca de papel ilustra o fluxo; não é autenticação nem controle seguro de acesso.'}
          </p>
          <button
            className="button secondary"
            onClick={() =>
              download(
                account ? 'memorable-conta-backup.json' : 'memorable-demo-backup.json',
                JSON.stringify(state, null, 2),
                "application/json",
              )
            }
          >
            <Download size={17} />
            Exportar dados
          </button>
          {!account && <button
            className="text-button danger-text"
            onClick={() => setModal("reset")}
          >
            <RotateCcw size={16} />
            Reiniciar demonstração
          </button>}
        </section>
      </div></Subpanel>}
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
    editorialRole: 'reference',
    whySaved: '',
    pattern: '',
    summary: "",
    keywords: [],
    transcript: "",
    extraction: null,
  });
  const [error, setError] = useState("");
  const [mode, setMode] = useState("single");
  const [ingesting, setIngesting] = useState("");
  const fileRef = useRef();
  const applyExtracted = (source) => {
    setForm(current => ({ ...current, ...source, origin: current.origin || source.origin || "", title: current.title || source.title || "", url: current.url || source.url || "" }));
    setError("");
  };
  const ingestUrl = async () => {
    if (!form.url.trim()) return setError("Informe o link para extrair a fonte.");
    setIngesting("url"); setError("");
    try {
      const response = await longFetch('/api/ingest/url', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ url:form.url, title:form.title, origin:form.origin }) });
      const source = await response.json();
      if (!response.ok) throw new Error(source.error || 'Não foi possível extrair esta fonte.');
      applyExtracted(source);
    } catch (e) { setError(e.message); } finally { setIngesting(""); }
  };
  const ingestFile = async (file) => {
    if (file.size > 25 * 1024 * 1024) return setError("Escolha um arquivo de até 25 MB.");
    setIngesting("file"); setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = ""; for (let i=0; i<bytes.length; i+=0x8000) binary += String.fromCharCode(...bytes.subarray(i, i+0x8000));
      const response = await longFetch('/api/ingest/file', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name:file.name, mimeType:file.type || 'application/octet-stream', data:btoa(binary) }) });
      const source = await response.json();
      if (!response.ok) throw new Error(source.error || 'Não foi possível ler este arquivo.');
      applyExtracted(source);
    } catch (e) { setError(e.message); } finally { setIngesting(""); }
  };
  return (
    <Dialog title="Adicionar ao acervo" onClose={onClose} wide>
      <div className="source-mode" role="tablist" aria-label="O que adicionar">
        <button type="button" role="tab" aria-selected={mode === "single"} className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>Uma publicação ou arquivo</button>
        <button type="button" role="tab" aria-selected={mode === "channel"} className={mode === "channel" ? "active" : ""} onClick={() => setMode("channel")}>Canal inteiro</button>
      </div>
      {mode === "channel" ? (
        <div className="dialog-body">
          <ChannelImport state={state} setState={setState} notify={notify} onClose={onClose} />
        </div>
      ) : (
      <form
        className="dialog-body"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            assertEditor(state);
          } catch (e) {
            setError(e.message);
            return;
          }
          if (
            state.sources.some(
              (x) =>
                visibleTo(x, state.workspace) &&
                x.text.trim() === form.text.trim(),
            )
          ) {
            setError(
              "Este conteúdo já existe no acervo. Abra a referência existente.",
            );
            return;
          }
          if (!form.text.trim()) {
            setError("Extraia uma fonte pela URL ou arquivo, ou cole o conteúdo manualmente.");
            return;
          }
          if (form.url && !/^https?:\/\//i.test(form.url)) {
            setError("Use um endereço começando com https:// ou http://.");
            return;
          }
          // The title is automatic: extraction fills it; otherwise the page host or the first line of the text.
          const host = (() => { try { return new URL(form.url).hostname.replace(/^www\./, ""); } catch { return ""; } })();
          const title = form.title.trim() || host || form.text.trim().split(/\n/)[0].slice(0, 80);
          setState((s) => ({
            ...s,
            sources: [
              {
                ...form,
                title,
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
        <div className="source-ingest-intro">
          <span>ADICIONE UMA FONTE</span>
          <p>Cole uma URL ou envie um arquivo. A plataforma lê o material, cria o resumo, extrai palavras-chave e preserva o conteúdo para consulta.</p>
        </div>
        <section className="source-url-capture" aria-label="Extrair uma fonte pela URL">
          <label>
            Cole a URL da fonte
            <div className="source-url-input">
              <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://www.esferalegal.com.br/" />
              <button type="button" className="button primary" onClick={ingestUrl} disabled={!!ingesting || !form.url.trim()}>{ingesting === "url" ? "Extraindo…" : "Extrair agora"}</button>
            </div>
          </label>
          <small>Website ou página pública · YouTube com legenda pública · rede social conectada</small>
        </section>
        <div className="source-or"><span>ou envie um arquivo</span></div>
        <button
          type="button"
          className="upload-zone"
          onClick={() => fileRef.current.click()}
        >
          <Upload size={23} />
          <span>
            <b>{ingesting === "file" ? "Lendo e estruturando o arquivo…" : "Importar e extrair arquivo"}</b>
            <small>PDF, DOCX, TXT, Markdown, CSV, áudio ou vídeo · até 25 MB</small>
          </span>
          <Plus size={18} />
        </button>
        <input
          type="file"
          ref={fileRef}
          hidden
          accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.htm,.mp3,.mp4,.m4a,.wav,.ogg,.webm,.flac,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/*,audio/*,video/*"
          onChange={async (e) => {
            const f = e.target.files[0];
            if (!f) return;
            await ingestFile(f);
            e.target.value = "";
          }}
        />
        <p className="source-details-label">Detalhes da referência <span>— preenchidos automaticamente quando possível</span></p>
        <label>Relação com a marca<select aria-label="Relação com a marca" value={form.editorialRole} onChange={e => setForm({...form, editorialRole:e.target.value})}>{SOURCE_ROLES.map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <p className="field-help">Para seu produto ou serviço, escolha “Produto ou solução própria”. Ele será priorizado no Radar, mesmo sem ser uma notícia recente.</p>
        <details className="source-curation"><summary>Por que esta referência importa? (opcional)</summary><label>Por que você salvou esta fonte?<textarea rows={2} value={form.whySaved} onChange={e=>setForm({...form,whySaved:e.target.value})} placeholder="O gancho, a ideia, a evidência ou o jeito de explicar…"/></label><label>Padrão de estrutura a estudar<textarea rows={2} value={form.pattern} onChange={e=>setForm({...form,pattern:e.target.value})} placeholder="Ex.: pergunta concreta → exemplo → orientação. Sem copiar as frases."/></label></details>
        <label>
          Título
          <input
            maxLength={160}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Preenchido pela extração"
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
            Tipo de material
            <input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder="Identificado pela extração" />
          </label>
        </div>
        <label>
          Conteúdo
          <textarea
            rows={6}
            value={form.text}
            aria-label="Conteúdo"
            maxLength={100000}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Será preenchido pela extração. Você também pode colar ou revisar o conteúdo manualmente."
          />
        </label>
        {form.summary && <section className="ingest-preview"><small className="label">Extração concluída</small><p>{form.summary}</p>{form.keywords?.length > 0 && <div className="source-keywords">{form.keywords.map(keyword => <span key={keyword}>{keyword}</span>)}</div>}<small>{form.keywordSource === 'model' ? 'Resumo e temas sugeridos pela IA a partir do texto' : 'Resumo e palavras-chave automáticos'} · {form.extraction?.method} · confira antes de guardar</small></section>}
        <p className="field-help">Websites e páginas públicas são lidos pela plataforma. Vídeos do YouTube usam legenda pública; áudio/vídeo exige uma conexão OpenAI para transcrição. Redes sociais precisam de conexão autorizada da conta ou de um arquivo exportado.</p>
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
      )}
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
function DeletePiece({ piece, state, setState, notify, onDone }) {
  const [confirming, setConfirming] = useState(false);
  if (!["Editor", "Administrador"].includes(state.role)) return null;
  return (
    <div className="piece-delete">
      {confirming ? (
        <>
          <p>
            Excluir “{piece.title}”? O conteúdo sai do Kanban e dos cases; o histórico registra a exclusão. Não dá para desfazer.
          </p>
          <button
            className="button danger"
            onClick={() => {
              try {
                setState((s) => removePiece(s, piece.id));
                notify("Conteúdo excluído. O registro ficou no histórico.");
                onDone();
              } catch (e) {
                notify(e.message, true);
              }
            }}
          >
            Excluir definitivamente
          </button>
          <button className="button secondary" onClick={() => setConfirming(false)}>
            Manter conteúdo
          </button>
        </>
      ) : (
        <button className="text-button piece-delete-trigger" onClick={() => setConfirming(true)}>
          Excluir conteúdo
        </button>
      )}
    </div>
  );
}
// What the AI editor (and, in tests, a blind judge) said about the generated draft.
function AiReview({ delivery }) {
  const review = delivery.editorialReview;
  const judge = delivery.blindJudge;
  const scores = judge && [["Completude", judge.completude], ["Clareza", judge.clareza], ["Foco na marca", judge.foco_na_marca], ["Sustentação", judge.sustentacao], ["Originalidade", judge.originalidade]];
  return (
    <details className="ai-review" open={review.passed === false}>
      <summary>
        Revisão por IA · {review.passed === false ? `${review.pending.length} ${review.pending.length === 1 ? "pendência" : "pendências"} do editor` : "aprovada pelo editor"}
        {delivery.model ? ` · ${delivery.model}` : ""}
      </summary>
      {delivery.importedFrom && <p className="ai-review-origin">{delivery.importedFrom}</p>}
      {review.passed === false && (
        <ul>
          {review.pending.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      {judge && (
        <div className="ai-review-judge">
          <b>Juiz cego ({judge.model}) · {judge.publicavel ? "publicável" : "não publicável sem edição"}</b>
          <dl>
            {scores.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}/5</dd>
              </div>
            ))}
          </dl>
          <ul>
            {(judge.problemas || []).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </details>
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
            <StageRail status={piece.status} />
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
                Texto do conteúdo
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
        {!editing && <RefinePanel piece={piece} canEdit={canEdit} onApplied={setBody} />}
        {!editing && <PieceCouncil piece={piece} />}
        {!editing && piece.delivery?.editorialReview && <AiReview delivery={piece.delivery} />}
        {!editing && <PieceLineage piece={piece} />}
        {!editing && piece.status !== "Publicado" && (
          <DeletePiece piece={piece} state={state} setState={setState} notify={notify} onDone={onClose} />
        )}
        {!editing && <PublicationControls piece={piece} />}
        {!editing && <details className="piece-media"><summary>Mídia</summary><p>O rascunho contém texto e direção de produção. Imagens e vídeos são gerados aqui, usando créditos do provedor. Áudio deve ser gravado a partir do roteiro; síntese de voz ainda não está integrada.</p><MediaStudio initialPrompt={piece.delivery?.visual||piece.body} /></details>}
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
                    setEditing(false);
                    setChecked(false);
                    notify("Edição salva. O conteúdo precisa de uma nova revisão.");
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
                Editar conteúdo
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
                            doAction(piece.id, "approve", { author: "Aprovador" })
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
createRoot(document.getElementById("root")).render(<AccountRoot Component={App} />);
