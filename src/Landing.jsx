import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  AudioLines,
  Layers,
  MoveRight,
  Play,
  ShieldCheck,
  Network,
  ChevronRight,
  Menu,
  X,
  CheckCheck,
  Bookmark,
  PenLine,
  CalendarDays,
  Radio,
} from "lucide-react";

export function Brand({ small = false }) {
  return (
    <a
      className={`brand ${small ? "brand-small" : ""}`}
      href="#"
      aria-label="Esteira, início"
    >
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      esteira<span className="brand-period">.</span>
    </a>
  );
}
const stages = [
  [
    "Guardar",
    "O conhecimento fica.",
    "Reúna referências, roteiros e conversas em um acervo que sua equipe consegue usar.",
    Bookmark,
  ],
  [
    "Vigiar",
    "A próxima pauta aparece.",
    "Transforme sinais dos seus canais e referências em assuntos com contexto.",
    Radio,
  ],
  [
    "Escrever",
    "Uma ideia ganha caminhos.",
    "Explore três abordagens, preserve a fonte e encontre a voz certa para cada marca.",
    PenLine,
  ],
  [
    "Aprovar",
    "O critério é da sua equipe.",
    "Revise a peça, registre o que precisa mudar e mantenha cada decisão no histórico.",
    CheckCheck,
  ],
  [
    "Publicar",
    "O aprovado encontra seu lugar.",
    "Organize canal e horário. Leve a peça aprovada para a agenda ou exporte o conteúdo.",
    CalendarDays,
  ],
];
function SourceDocument({ mini = false }) {
  return (
    <div className={`source-document ${mini ? "mini" : ""}`}>
      <div className="document-cap">
        <span>
          <AudioLines size={16} /> ACERVO · PODCAST
        </span>
        <span>31</span>
      </div>
      <div className="waveform" aria-hidden="true">
        {Array.from({ length: 45 }, (_, i) => (
          <i
            key={i}
            style={{ height: `${12 + Math.sin(i * 2.3) ** 2 * 34}px` }}
          />
        ))}
      </div>
      <h3>
        Conexão antes
        <br />
        do argumento.
      </h3>
      <p>
        “A clareza gera vínculo,
        <br />o vínculo gera segurança.”
      </p>
      <div className="source-credit">
        <span className="avatar">LR</span>
        <span>
          Lucas Rolim<small>ROLIM TALKS · Episódio 31</small>
        </span>
        <Bookmark size={16} />
      </div>
    </div>
  );
}
function HeroSurface() {
  return (
    <div
      className="hero-surface"
      aria-label="Uma fonte do acervo conectada à criação de conteúdo e à revisão"
    >
      <div className="scene-grid" />
      <div className="scene-orbit orbit-one" />
      <div className="scene-orbit orbit-two" />
      <div className="source-plane">
        <SourceDocument />
      </div>
      <div className="format-plane">
        <div className="format-label">
          <Layers size={17} />
          <span>PRÓXIMOS CAPÍTULOS</span>
        </div>
        <a href="#app/escrever" className="format-item">
          <span className="format-icon">
            <Play size={16} />
          </span>
          <div>
            <b>Um roteiro que aproxima</b>
            <small>Reels · gancho + contexto</small>
          </div>
          <ArrowUpRight size={17} />
        </a>
        <a href="#app/escrever" className="format-item">
          <span className="format-icon">
            <Layers size={16} />
          </span>
          <div>
            <b>Uma ideia em três telas</b>
            <small>Carrossel · leitura em sequência</small>
          </div>
          <ArrowUpRight size={17} />
        </a>
        <a href="#app/escrever" className="format-item">
          <span className="format-icon">
            <FileText size={16} />
          </span>
          <div>
            <b>Uma conversa que continua</b>
            <small>LinkedIn · reflexão editorial</small>
          </div>
          <ArrowUpRight size={17} />
        </a>
      </div>
      <div className="review-plane">
        <span className="review-seal">
          <Check size={19} />
        </span>
        <div>
          <b>A última palavra é humana.</b>
          <small>Revisão antes da publicação.</small>
        </div>
      </div>
      <span className="scene-caption">
        O valor de uma ideia está no que vem depois.
      </span>
    </div>
  );
}
export default function Landing() {
  const [stage, setStage] = useState(0);
  const [commercial, setCommercial] = useState("subscription");
  const [mobileMenu, setMobileMenu] = useState(false);
  const hero = useRef(null);
  const flow = useRef(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const scroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (hero.current && !media.matches) {
          hero.current.style.setProperty(
            "--hero-progress",
            String(Math.min(1, window.scrollY / 650)),
          );
        }
        if (flow.current && !media.matches && window.innerWidth > 850) {
          const r = flow.current.getBoundingClientRect();
          if (r.top < 100 && r.bottom > window.innerHeight * 0.6) {
            setStage(
              Math.max(
                0,
                Math.min(
                  4,
                  Math.floor(
                    (-r.top + 100) / ((r.height - window.innerHeight) / 5),
                  ),
                ),
              ),
            );
          }
        }
      });
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", scroll);
      cancelAnimationFrame(raf);
    };
  }, []);
  const CurrentIcon = stages[stage][3];
  return (
    <div className="landing">
      <a href="#main-content" className="skip-link">
        Ir para o conteúdo
      </a>
      <header className="landing-nav">
        <Brand />
        <nav className={mobileMenu ? "nav-open" : ""} aria-label="Principal">
          <a href="#como-funciona" onClick={() => setMobileMenu(false)}>
            Como funciona
          </a>
          <a href="#seu-time" onClick={() => setMobileMenu(false)}>
            Para o seu time
          </a>
          <a href="#modelos" onClick={() => setMobileMenu(false)}>
            Modelos de adoção
          </a>
        </nav>
        <a className="nav-entry" href="#app/painel">
          Entrar na demo <ArrowUpRight size={16} />
        </a>
        <button
          className="mobile-nav-button icon-button"
          onClick={() => setMobileMenu(!mobileMenu)}
          aria-label="Abrir navegação"
          aria-expanded={mobileMenu}
        >
          {mobileMenu ? <X /> : <Menu />}
        </button>
      </header>
      <main id="main-content">
        <section className="hero" ref={hero}>
          <div className="hero-copy">
            <div className="hero-category">
              <span /> INTELIGÊNCIA PARA O CONTEÚDO
            </div>
            <h1>
              Boas ideias.
              <br />
              <span>Novos capítulos.</span>
            </h1>
            <p>
              Transforme o conhecimento da sua equipe em conteúdo. Da primeira
              referência à aprovação, em um só fluxo.
            </p>
            <a href="#app/painel" className="button primary hero-cta">
              Explorar demonstração <ArrowUpRight size={19} />
            </a>
            <div className="hero-note">
              Sua criatividade. Um processo à altura.
            </div>
          </div>
          <HeroSurface />
        </section>
        <div className="brand-strip">
          <p>
            Uma operação.
            <br />
            <strong>A voz de cada marca.</strong>
          </p>
          <div>
            <span>Equipes de marketing</span>
            <span>Grupos empresariais</span>
            <span>Agências & estúdios</span>
          </div>
          <Network size={29} />
        </div>
        <section className="flow-section" id="como-funciona" ref={flow}>
          <div className="flow-sticky">
            <div className="flow-heading">
              <h2>
                O trabalho avança.
                <br />
                <span>O contexto vai junto.</span>
              </h2>
              <p>
                Uma fonte, cinco etapas.
                <br />
                Nenhuma ideia começa do zero.
              </p>
            </div>
            <div className="flow-body">
              <div
                className="flow-steps"
                role="tablist"
                aria-label="Etapas da esteira"
              >
                {stages.map(([name, title, desc, Icon], i) => (
                  <button
                    key={name}
                    role="tab"
                    aria-selected={stage === i}
                    aria-controls={`stage-panel-${i}`}
                    id={`stage-tab-${i}`}
                    onClick={() => setStage(i)}
                    className={stage === i ? "selected" : ""}
                  >
                    <span className="step-icon">
                      <Icon size={20} />
                    </span>
                    <span>{name}</span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
              <div
                className="flow-detail"
                role="tabpanel"
                id={`stage-panel-${stage}`}
                aria-labelledby={`stage-tab-${stage}`}
              >
                <div className="flow-detail-copy">
                  <span className="large-step-icon">
                    <CurrentIcon size={27} />
                  </span>
                  <h3>{stages[stage][1]}</h3>
                  <p>{stages[stage][2]}</p>
                  <a
                    href={`#app/${["guardar", "vigiar", "escrever", "aprovar", "publicar"][stage]}`}
                  >
                    Experimentar esta etapa <ArrowRight size={18} />
                  </a>
                </div>
                <div className={`flow-illustration stage-${stage}`} key={stage}>
                  {stage === 0 ? (
                    <SourceDocument mini />
                  ) : stage === 1 ? (
                    <>
                      <div className="radar-source">
                        <Radio size={25} />
                        <span>Uma oportunidade no seu acervo</span>
                      </div>
                      <h4>Como tornar uma conversa mais clara?</h4>
                      <p>
                        Relevante para o público. Apoiada em uma fonte que sua
                        equipe já conhece.
                      </p>
                      <span className="inline-label">
                        ROLIM TALKS · Episódio 31
                      </span>
                    </>
                  ) : stage === 2 ? (
                    <>
                      <span className="inline-label">
                        UMA FONTE, TRÊS ABORDAGENS
                      </span>
                      {[
                        "Uma pergunta que aproxima",
                        "Uma ideia, sem rodeios",
                        "Um convite à reflexão",
                      ].map((t, i) => (
                        <div className="variant-preview" key={t}>
                          <span>{String(i + 1).padStart(2, "0")}</span>
                          <b>{t}</b>
                          <ArrowUpRight size={16} />
                        </div>
                      ))}
                    </>
                  ) : stage === 3 ? (
                    <>
                      <div className="review-preview-head">
                        <span className="avatar">BT</span>
                        <div>
                          <b>Seu olhar faz diferença.</b>
                          <small>Revisão editorial</small>
                        </div>
                      </div>
                      <p className="review-quote">
                        “O contexto está bom. Vamos trocar o termo técnico por
                        um exemplo?”
                      </p>
                      <div className="review-check">
                        <Check size={17} /> Decisão preservada no histórico
                      </div>
                      <a href="#app/aprovar" className="button primary">
                        Abrir a revisão <ArrowUpRight size={16} />
                      </a>
                    </>
                  ) : (
                    <>
                      <div className="schedule-preview">
                        <CalendarDays size={28} />
                        <span>Conteúdo aprovado</span>
                      </div>
                      <h4>
                        Cada peça,
                        <br />
                        no seu momento.
                      </h4>
                      <div className="schedule-channel">
                        <span>LinkedIn</span>
                        <span>Instagram</span>
                        <span>YouTube</span>
                      </div>
                      <small>Agenda local e exportação na demonstração.</small>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="team-section" id="seu-time">
          <div className="team-intro">
            <span className="section-symbol">
              <Network size={27} />
            </span>
            <h2>
              Muitas marcas.
              <br />
              Nenhuma voz
              <br />
              <span>misturada.</span>
            </h2>
            <p>
              Compartilhe a operação. Preserve a identidade, os critérios e o
              espaço de cada time.
            </p>
          </div>
          <div className="team-editorial">
            <article>
              <span>01</span>
              <div>
                <h3>O repertório pertence à equipe.</h3>
                <p>
                  Fontes, peças e decisões permanecem acessíveis. O trabalho de
                  ontem alimenta o de amanhã.
                </p>
              </div>
              <Bookmark size={22} />
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Você sabe quem decide.</h3>
                <p>
                  Responsável, prazo e aprovação visíveis. Cada etapa tem um
                  próximo passo claro.
                </p>
              </div>
              <ShieldCheck size={22} />
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>O custo acompanha a criação.</h3>
                <p>
                  Veja o consumo por marca e por peça. Defina limites antes de
                  aumentar a produção.
                </p>
              </div>
              <Layers size={22} />
            </article>
            <div className="team-signature">
              <span className="brand-mark" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <p>
                Menos recomeços.
                <br />
                <b>Mais trabalho que fica.</b>
              </p>
            </div>
          </div>
        </section>
        <section className="commercial-section" id="modelos">
          <div className="commercial-heading">
            <h2>
              Uma plataforma.
              <br />O seu jeito de adotar.
            </h2>
            <p>
              Comece pelo time. Construa a relação
              <br />
              que faz sentido para o negócio.
            </p>
          </div>
          <div
            className="commercial-switch"
            role="tablist"
            aria-label="Modelos de adoção"
          >
            <button
              role="tab"
              aria-selected={commercial === "subscription"}
              onClick={() => setCommercial("subscription")}
              className={commercial === "subscription" ? "active" : ""}
            >
              Assinatura para a equipe
            </button>
            <button
              role="tab"
              aria-selected={commercial === "partnership"}
              onClick={() => setCommercial("partnership")}
              className={commercial === "partnership" ? "active" : ""}
            >
              Parceria estratégica
            </button>
          </div>
          <div className="commercial-content">
            <div>
              <h3>
                {commercial === "subscription"
                  ? "O método entra na rotina."
                  : "O grupo ajuda a escrever o próximo capítulo."}
              </h3>
              <p>
                {commercial === "subscription"
                  ? "Acesso por assinatura, licenças para o time de marketing e espaços para cada marca. Uma plataforma comum, com a operação organizada à sua maneira."
                  : "Uma proposta para organizações que desejam participar da evolução da plataforma, validar o método com sua equipe e discutir uma relação de longo prazo."}
              </p>
              <a className="button primary" href="#app/painel">
                Explorar demonstração <ArrowUpRight size={19} />
              </a>
            </div>
            <ul>
              {(commercial === "subscription"
                ? [
                    "Licenças de acesso por equipe",
                    "Acervo e fluxo editorial por marca",
                    "Critérios, custos e decisões visíveis",
                  ]
                : [
                    "Piloto com objetivos mensuráveis",
                    "Evolução orientada pelo uso da equipe",
                    "Condições de adoção e investimento a definir",
                  ]
              ).map((t) => (
                <li key={t}>
                  <Check size={18} />
                  {t}
                </li>
              ))}
              <li className="commercial-note">
                Escopo e condições comerciais sujeitos à proposta.
              </li>
            </ul>
          </div>
        </section>
        <section className="closing">
          <p>O próximo capítulo começa com o que você já sabe.</p>
          <a href="#app/painel">
            Coloque uma ideia
            <br />
            em movimento.
            <ArrowUpRight aria-hidden="true" />
          </a>
          <div className="closing-foot">
            <span>ESTEIRA · POR SKYVIDYA</span>
            <span>Demonstração disponível com o contexto Grupo BBMD.</span>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand small />
        <p>Inteligência no processo. Pessoas na decisão.</p>
        <a href="#app/painel">
          Conhecer a plataforma <ArrowRight size={16} />
        </a>
      </footer>
    </div>
  );
}
