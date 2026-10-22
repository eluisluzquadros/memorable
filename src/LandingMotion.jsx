import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  X,
  Radio,
  PenLine,
  ShieldCheck,
  CheckCheck,
  CalendarDays,
  Layers,
  Play,
  FileText,
  Mic,
  Sparkles,
} from "lucide-react";
import "./motion-fonts.css";
import "./landing-motion.css";

// Synthetic demonstration material: every name, score and text below illustrates the
// product flow and is labelled as demonstration on the page. No client results are claimed.
const ACTS = [
  { id: "inicio", word: "MEMORABLE", step: "Início" },
  {
    id: "pauta",
    word: "PAUTA",
    step: "Pesquisar",
    title: "O radar encontra a pauta.",
    text: "Cadastre um site, um canal do YouTube, um blog ou um perfil: as publicações viram pautas priorizadas por interesse do público e aderência à sua marca.",
  },
  {
    id: "escrita",
    word: "ESCRITA",
    step: "Escrever",
    title: "Uma ideia, todos os formatos.",
    text: "O time de agentes escreve com a voz da sua marca. Cada versão testa um gancho diferente.",
    chips: ["Carrossel", "Reels", "Artigo", "Newsletter", "LinkedIn", "Anúncio UGC"],
  },
  {
    id: "refino",
    word: "REFINO",
    step: "Refinar",
    title: "Refinado até soar como você.",
    text: "Antes de chegar até você, cada versão é afinada no tom da sua marca, com frases mais claras e fontes conferidas. Você revisa o melhor texto, não o primeiro rascunho.",
  },
  {
    id: "aprovado",
    word: "APROVADO",
    step: "Aprovar",
    title: "A última palavra é sua.",
    text: "Você confere texto e fontes e aprova uma versão. Editou depois? A aprovação cai e o conteúdo volta para revisão.",
  },
  {
    id: "mundo",
    word: "NO MUNDO",
    step: "Publicar",
    title: "Sua marca onde o público está.",
    text: "Agenda por canal e conteúdos exportados no formato de cada rede. A mesma ideia vira presença constante — é isso que faz uma marca ser lembrada.",
  },
];

const CASES = [
  { brand: "Escritório de advocacia", title: "Um episódio, sete conteúdos", from: "Podcast de 40 min", to: "Carrossel, Reels, artigo, newsletter e LinkedIn" },
  { brand: "Grupo com seis marcas", title: "Uma operação, seis vozes", from: "DNA de cada marca", to: "Pautas, aprovação e agenda separadas por marca" },
  { brand: "Consultoria B2B", title: "Do radar ao LinkedIn", from: "Blog do setor monitorado", to: "Post com fonte citada, aprovado em um fluxo" },
  { brand: "Loja online", title: "Cinco anúncios UGC", from: "Uma foto do produto", to: "Cinco ganchos diferentes para testar" },
  { brand: "Clínica", title: "Dúvida virou série", from: "Perguntas do atendimento", to: "Série de Reels com roteiro de 15 s" },
  { brand: "Criador de conteúdo", title: "Constância sem equipe", from: "Notas e referências salvas", to: "Calendário semanal pronto para revisar" },
];

const STACK = [
  ["Radar de pautas e canais vigiados", "ferramenta de tendências"],
  ["Acervo de referências com resumo", "app de notas e leitura"],
  ["Redação multiformato com a voz da marca", "assistente de escrita"],
  ["Roteiros com cenas e tempo", "editor de roteiro"],
  ["Refino de voz, clareza e fontes", "revisor externo"],
  ["Aprovação por versão", "planilha e e-mail"],
  ["Imagens e vídeos com Higgsfield", "estúdio de mídia"],
  ["Agenda e exportação por canal", "agendador de redes"],
  ["Portfólio de cases", "pasta de apresentações"],
];

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduced;
};

function Brand() {
  return (
    <a className="mx-brand" href="#" aria-label="Memorable, início">
      <span className="mx-brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="mx-brand-name">
        Memorable<span>.</span>
      </span>
    </a>
  );
}

function Panel({ className = "", label, icon: Icon, children }) {
  return (
    <div className={`mx-panel ${className}`}>
      <div className="mx-panel-head">
        {Icon && <Icon size={14} aria-hidden="true" />}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function ActPanels({ id }) {
  if (id === "pauta")
    return (
      <>
        <Panel className="p-a" label="Radar · 3 pautas novas" icon={Radio}>
          <ul className="mx-topics">
            <li>
              <b>Clareza no primeiro atendimento</b>
              <small>Podcast · ep. 31</small>
              <em>9,1</em>
            </li>
            <li>
              <b>O que perguntar antes de contratar</b>
              <small>Blog do setor · canal vigiado</small>
              <em>8,4</em>
            </li>
            <li>
              <b>Prazo, custo e expectativa</b>
              <small>Perguntas do atendimento</small>
              <em>7,8</em>
            </li>
          </ul>
        </Panel>
        <Panel className="p-b" label="Fonte guardada" icon={Mic}>
          <div className="mx-wave" aria-hidden="true">
            {Array.from({ length: 28 }, (_, i) => (
              <i key={i} style={{ height: `${8 + Math.sin(i * 1.7) ** 2 * 26}px` }} />
            ))}
          </div>
          <p>“A clareza gera vínculo; o vínculo gera segurança.”</p>
          <dl className="mx-meter">
            <div style={{ "--v": "91%" }}>
              <dt>Interesse do público</dt>
              <dd>9,1</dd>
            </div>
            <div style={{ "--v": "86%" }}>
              <dt>Voz da marca</dt>
              <dd>8,6</dd>
            </div>
          </dl>
        </Panel>
      </>
    );
  if (id === "escrita")
    return (
      <>
        <Panel className="p-a mx-slide" label="Carrossel" icon={Layers}>
          <strong>Seu cliente entende o seu pitch?</strong>
          <small className="mx-more">
            Tela 1 de 6 ·
 próximas <ArrowRight size={14} aria-hidden="true" />
          </small>
        </Panel>
        <Panel className="p-b" label="Reels · roteiro de 15 s" icon={Play}>
          <ol className="mx-scenes">
            <li>
              <i>0–2 s</i>Mão desliza um contrato de 30 páginas pela mesa.
            </li>
            <li>
              <i>2–10 s</i>“Ninguém assina o que não entende. A gente explica antes.”
            </li>
            <li>
              <i>10–15 s</i>Chamada: agende uma conversa de 15 minutos.
            </li>
          </ol>
        </Panel>
      </>
    );
  if (id === "refino")
    return (
      <>
        <Panel className="p-a" label="Refino · versão 1 → 2" icon={ShieldCheck}>
          <ul className="mx-council">
            <li>
              <span>Clareza</span>
              <em>4,6</em>
            </li>
            <li>
              <span>Evidência</span>
              <em>4,4</em>
            </li>
            <li>
              <span>Voz da marca</span>
              <em>4,7</em>
            </li>
            <li className="is-up">
              <span>Ritmo e tempo</span>
              <em>2,1 → 4,5</em>
            </li>
          </ul>
        </Panel>
        <Panel className="p-b" label="Afinado na sua voz" icon={Sparkles}>
          <ul className="mx-fixes">
            <li>
              <s>“Somos referência em soluções jurídicas”</s>
              <span>
                <ArrowRight size={14} aria-hidden="true" /> “Seu contrato, explicado antes de você assinar”
              </span>
            </li>
            <li>
              <s>“um divisor de águas”</s>
              <span>
                <ArrowRight size={14} aria-hidden="true" /> “o contrato explicado em 3 frases”
              </span>
            </li>
          </ul>
        </Panel>
      </>
    );
  if (id === "aprovado")
    return (
      <>
        <div className="mx-panel p-a mx-approve">
          <strong>
            <CheckCheck size={22} aria-hidden="true" /> Versão 3 aprovada
          </strong>
          <ul>
            <li>
              <Check size={14} aria-hidden="true" /> Fontes conferidas
            </li>
            <li>
              <Check size={14} aria-hidden="true" /> Tom e clareza refinados
            </li>
            <li>
              <Check size={14} aria-hidden="true" /> Voz validada no DNA
            </li>
          </ul>
          <small>Aprovação humana. Editar o texto desfaz esta aprovação.</small>
        </div>
        <Panel className="p-b" label="Histórico" icon={FileText}>
          <ol className="mx-history">
            <li>v1 · refinada no tom da marca</li>
            <li>v2 · ajuste pedido: trocar termo técnico</li>
            <li>v3 · aprovada por Ana, aprovadora</li>
          </ol>
        </Panel>
      </>
    );
  if (id === "mundo")
    return (
      <>
        <Panel className="p-a" label="Agenda da semana" icon={CalendarDays}>
          <ul className="mx-agenda">
            <li>
              <i>Seg</i>Carrossel · Instagram
            </li>
            <li>
              <i>Qua</i>Reels · Instagram e TikTok
            </li>
            <li>
              <i>Qui</i>Artigo · LinkedIn
            </li>
            <li>
              <i>Sex</i>Newsletter · e-mail
            </li>
          </ul>
        </Panel>
      </>
    );
  return null;
}

function Screen({ variant, children }) {
  return (
    <>
      <i className={`mx-spill mx-spill-${variant}`} aria-hidden="true" />
      {variant === "store" && <i className="mx-reflect" aria-hidden="true" />}
      <div className={`mx-screen mx-screen-${variant}`}>{children}</div>
    </>
  );
}

function CityScreens({ t, still = false }) {
  const avenue = !still && t >= 0.55;
  return (
    <div className={`mx-city ${still ? "is-still" : ""}`} aria-hidden="true">
      <figure className="mx-scene mx-store" style={{ opacity: avenue ? 0 : 1 }}>
        <div className="mx-frame-store">
          <img src="/motion/storefront.webp" alt="" />
          <Screen variant="store">
            <span className="mx-screen-brand">Sua marca.</span>
            <strong>Seu cliente entende o seu pitch?</strong>
            <small>Carrossel · 1 / 6</small>
          </Screen>
        </div>
      </figure>
      {!still && (
        <figure className="mx-scene mx-avenue" style={{ opacity: avenue ? 1 : 0 }}>
          <img className="mx-avenue-bg" src="/motion/billboard.webp" alt="" />
          <div className="mx-frame-avenue">
            <img src="/motion/billboard.webp" alt="Outdoor 3D numa esquina de São Paulo à noite: a persona da Memorable, sentada numa cadeira cromada, parece sair da tela sobre a rua." />
          </div>
        </figure>
      )}
    </div>
  );
}

function HeroCopy({ account }) {
  return (
    <div className="mx-hero-copy">
      <div className="mx-select">
        <div className="mx-select-bar" aria-hidden="true">
          <span>Criar</span>
          <span>Aprovar</span>
          <span>Publicar</span>
        </div>
        <h1>
          <span className="mx-select-text">
            <i className="mx-handle mx-handle-a" aria-hidden="true" />
            Viralize sua Marca com IA
            <i className="mx-handle mx-handle-b" aria-hidden="true" />
          </span>
        </h1>
      </div>
      <p className="mx-lede">da pesquisa à publicação, em um só fluxo.</p>
      <p className="mx-signature">Memorable! O jeito certo de deixar sua marca no mundo.</p>
      <div className="mx-actions">
        <a className="mx-cta" href="#app/painel">
          Ver o fluxo funcionando <ArrowUpRight size={18} aria-hidden="true" />
        </a>
        <a className="mx-ghost" href={account ? "#app/painel" : "#auth"}>
          {account ? "Meu espaço" : "Criar conta"}
        </a>
      </div>
    </div>
  );
}

function ActCopy({ act }) {
  return (
    <div className="mx-act-copy" key={act.id}>
      <h2>{act.title}</h2>
      <p>{act.text}</p>
      {act.chips && (
        <div className="mx-chips" aria-label="Formatos">
          {act.chips.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const figureAlt = "Gestora de marketing sentada em uma cadeira cromada, em estúdio escuro";

function Stage({ reduced, account }) {
  const stage = useRef(null);
  const sticky = useRef(null);
  const [act, setAct] = useState(0);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = stage.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const span = Math.max(1, rect.height - innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / span));
      const position = progress * ACTS.length;
      const index = Math.min(ACTS.length - 1, Math.floor(position));
      const local = Math.min(1, position - index);
      sticky.current?.style.setProperty("--t", local.toFixed(3));
      setAct(index);
      if (index === ACTS.length - 1) setT(local);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule);
    return () => {
      removeEventListener("scroll", schedule);
      removeEventListener("resize", schedule);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);
  const goTo = (index) => {
    const el = stage.current;
    const span = el.offsetHeight - innerHeight;
    scrollTo({ top: el.offsetTop + (span * (index + 0.08)) / ACTS.length, behavior: "smooth" });
  };

  if (reduced)
    return (
      <section className="mx-static" id="fluxo" aria-label="Como o fluxo funciona">
        <div className="mx-static-hero">
          <div className="mx-word is-on" aria-hidden="true" style={{ "--len": 9 }}>
            MEMORABLE
          </div>
          <img className="mx-figure" src="/motion/hero.webp" alt={figureAlt} width="1000" height="1500" />
          <HeroCopy account={account} />
          <span className="mx-demo-note">Dados de demonstração</span>
        </div>
        {ACTS.slice(1).map((a) => (
          <article key={a.id} className={`mx-static-act act-${a.id}`}>
            {a.id === "mundo" && <CityScreens t={0} still />}
            <div className="mx-word is-on" aria-hidden="true" style={{ "--len": a.word.length }}>
              {a.word}
            </div>
            <ActCopy act={a} />
            <div className="mx-panels">
              <ActPanels id={a.id} />
            </div>
          </article>
        ))}
      </section>
    );

  const current = ACTS[act];
  return (
    <section ref={stage} className="mx-stage" id="fluxo" aria-label="Como o fluxo funciona">
      <div ref={sticky} className={`mx-sticky act-${current.id} ${current.id === "mundo" && t >= 0.55 ? "is-avenue" : ""}`} data-act={act}>
        <div className="mx-studio" aria-hidden="true" />
        {current.id === "mundo" && <CityScreens t={t} />}
        <div className="mx-words" aria-hidden="true">
          {ACTS.map((a, i) => (
            <div key={a.id} className={`mx-word ${i === act ? "is-on" : i < act ? "is-past" : ""}`} style={{ "--len": a.word.length }}>
              {a.word}
            </div>
          ))}
        </div>
        <img className="mx-figure" src="/motion/hero.webp" alt={figureAlt} width="1000" height="1500" fetchPriority="high" />
        {act === 0 ? <HeroCopy account={account} /> : <ActCopy act={current} />}
        <div className="mx-panels" key={`panels-${current.id}`}>
          <ActPanels id={current.id} />
        </div>
        <nav className="mx-rail" aria-label="Etapas do fluxo">
          {ACTS.map((a, i) => (
            <button key={a.id} className={i === act ? "is-on" : i < act ? "is-done" : ""} aria-current={i === act ? "step" : undefined} onClick={() => goTo(i)}>
              <span>{a.step}</span>
            </button>
          ))}
        </nav>
        {act === 0 && (
          <span className="mx-scrollhint" aria-hidden="true">
            Role para ver o fluxo
          </span>
        )}
        <span className="mx-demo-note">Dados de demonstração</span>
      </div>
    </section>
  );
}

function Portfolio({ reduced }) {
  const marquee = CASES.map((c) => c.title).join("  ·  ");
  return (
    <section className="mx-portfolio" id="portfolio" aria-labelledby="portfolio-title">
      <div className="mx-arena-stage" aria-hidden="true">
        <div className="mx-arena-frame">
          <img src="/motion/arena.webp" alt="" loading="lazy" />
          <svg className="mx-led" viewBox="0 0 1344 752" preserveAspectRatio="none">
            <defs>
              <path id="mx-ring-path" d="M 330 238 A 342 50 0 0 1 1014 238" />
              <linearGradient id="mx-ring-fade" x1="0" x2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0" />
                <stop offset="0.14" stopColor="#fff" />
                <stop offset="0.86" stopColor="#fff" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <mask id="mx-ring-mask">
                <rect x="330" y="120" width="684" height="180" fill="url(#mx-ring-fade)" />
              </mask>
            </defs>
            <g mask="url(#mx-ring-mask)">
              <text>
                <textPath href="#mx-ring-path" startOffset="0">
                  {marquee}  ·  {marquee}
                  {!reduced && <animate attributeName="startOffset" from="0%" to="-100%" dur="60s" repeatCount="indefinite" />}
                </textPath>
              </text>
            </g>
          </svg>
        </div>
      </div>
      <div className="mx-portfolio-body">
        <div className="mx-portfolio-copy">
          <h2 id="portfolio-title">Portfólio</h2>
          <p>Cada fluxo concluído vira um case: fonte de origem, conteúdos produzidos, versões aprovadas e os resultados que você registrar. Abaixo, cases de demonstração — os seus entram no lugar.</p>
          <a className="mx-ghost" href="#app/portfolio">
            Abrir o portfólio na plataforma <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
        <ul className="mx-cases">
          {CASES.map((c) => (
            <li key={c.title}>
              <strong>{c.title}</strong>
              <small>{c.brand}</small>
              <p>
                {c.from}
                <ArrowRight size={15} aria-hidden="true" />
                {c.to}
              </p>
              <em>Demonstração</em>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Stack() {
  return (
    <section className="mx-stack" id="planos" aria-labelledby="stack-title">
      <h2 id="stack-title">
        Uma assinatura
        <br />
        no lugar de várias ferramentas.
      </h2>
      <div className="mx-stack-table" role="table" aria-label="O que a Memorable reúne">
        <div role="row" className="mx-stack-head">
          <span role="columnheader">Na Memorable</span>
          <span role="columnheader">Hoje, costuma exigir</span>
        </div>
        {STACK.map(([ours, theirs]) => (
          <div role="row" key={ours}>
            <span role="cell">
              <Check size={16} aria-hidden="true" /> {ours}
            </span>
            <span role="cell">{theirs}</span>
          </div>
        ))}
      </div>
      <ol className="mx-adoption">
        <li>
          <b>Amostra</b>
          <span>Um fluxo real da sua marca, do radar à aprovação.</span>
        </li>
        <li>
          <b>Piloto</b>
          <span>Uma marca, metas de tempo de revisão, qualidade e custo combinadas antes.</span>
        </li>
        <li>
          <b>Assinatura</b>
          <span>Conteúdo perde validade rápido: a produção é contínua, e o plano acompanha o volume.</span>
        </li>
      </ol>
      <p className="mx-fineprint">Escopo, integrações e valores definidos em proposta. Parceria estratégica e investimento também são caminhos possíveis.</p>
    </section>
  );
}

export default function LandingMotion({ account, onLogout }) {
  const reduced = usePrefersReducedMotion();
  const [solidNav, setSolidNav] = useState(false);
  const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  useEffect(() => {
    const previous = document.title;
    document.title = "Memorable — Viralize sua Marca com IA";
    const onScroll = () => {
      const stage = document.getElementById("fluxo");
      setSolidNav(!!stage && scrollY > stage.offsetTop + stage.offsetHeight - innerHeight * (reduced ? 0.9 : 1.02));
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.title = previous;
      removeEventListener("scroll", onScroll);
    };
  }, [reduced]);
  return (
    <div className="mx-root">
      <a className="mx-skip" href="#fluxo" onClick={(e) => { e.preventDefault(); scrollToId("fluxo"); }}>
        Ir para o conteúdo
      </a>
      <header className={`mx-nav ${solidNav ? "is-solid" : ""}`}>
        <Brand />
        <nav aria-label="Principal">
          <button onClick={() => scrollToId("fluxo")}>Fluxo</button>
          <button onClick={() => scrollToId("portfolio")}>Portfólio</button>
          <button onClick={() => scrollToId("planos")}>Planos</button>
          <a href="#classica">Versão clássica</a>
        </nav>
        {account ? (
          <div className="mx-session">
            <a className="mx-enter" href="#app/painel">
              Meu espaço <ArrowUpRight size={15} aria-hidden="true" />
            </a>
            <button className="mx-logout" onClick={onLogout}>
              Sair
            </button>
          </div>
        ) : (
          <a className="mx-enter" href="#auth">
            Entrar <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        )}
      </header>
      <main>
        <Stage reduced={reduced} account={account} />
        <Portfolio reduced={reduced} />
        <Stack />
        <section className="mx-close" aria-labelledby="close-title">
          <h2 id="close-title">
            Seja
            <br />
            Memorable.
          </h2>
          <div>
            <p>Sua próxima pauta pode estar no ar esta semana — revisada, aprovada e com a sua voz.</p>
            <a className="mx-cta" href="#app/painel">
              Ver o fluxo funcionando <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>
      <footer className="mx-foot">
        <Brand />
        <span>O jeito certo de deixar sua marca no mundo.</span>
        <span>Imagens geradas com IA · conteúdo de demonstração</span>
      </footer>
    </div>
  );
}
