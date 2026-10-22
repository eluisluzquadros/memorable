import React, { useEffect, useRef, useState } from "react";
import ScrollStory from './ScrollStory';
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
      aria-label="Memorable, início"
    >
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      Memorable<span className="brand-period">.</span>
    </a>
  );
}
const stages = [
  [
    "Pesquisar",
    "Reúna o material que alimenta a criação.",
    "Guarde páginas, documentos, podcasts e canais inteiros — YouTube, blog ou perfil — de uma vez. Cada publicação vira referência com resumo e texto completo.",
    Bookmark,
  ],
  [
    "Vigiar",
    "Encontre pautas sem começar do zero.",
    "Acompanhe canais e sites: as novas publicações entram sozinhas e viram pautas priorizadas pelo interesse do público e pela aderência à sua marca.",
    Radio,
  ],
  [
    "Escrever",
    "Transforme uma pauta em vários formatos.",
    "O time de agentes escreve posts, carrosséis, roteiros, artigos, anúncios UGC e vídeos de produto com a voz da sua marca, e cada versão é refinada até soar como você.",
    PenLine,
  ],
  [
    "Aprovar",
    "Receba conteúdo para decidir e aprovar.",
    "Confira texto e fontes, peça ajustes e aprove a versão final. Os critérios validados orientam as próximas produções.",
    CheckCheck,
  ],
  [
    "Publicar",
    "Organize a entrega do conteúdo aprovado.",
    "Organize canal e horário. Leve o conteúdo aprovado para a agenda ou exporte o conteúdo.",
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
            Para sua rotina
          </a>
          <a href="#modelos" onClick={() => setMobileMenu(false)}>
            Modelos de adoção
          </a>
          <a href="#" onClick={() => setMobileMenu(false)}>
            Ver em movimento
          </a>
        </nav>
        <a className="nav-entry" href="#auth">
          Entrar <ArrowUpRight size={16} />
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
              <span /> AI-POWERED MARKETING
            </div>
            <h1>
              Automatize a produção
              <br />
              <span>do seu conteúdo.</span>
            </h1>
            <p>
              Viralize sua Marca com IA — da pesquisa à publicação, em um só
              fluxo.
            </p>
            <p className="hero-signature">
              Memorable! O jeito certo de deixar sua marca no mundo.
            </p>
            <ul className="hero-outcomes"><li><Check size={17}/> Vigie canais e sites e receba pautas priorizadas.</li><li><Check size={17}/> Agentes escrevem cada formato com a voz da sua marca.</li><li><Check size={17}/> Você aprova; o trabalho vira portfólio de cases.</li></ul>
            <a href="#app/painel" className="button primary hero-cta">
              Ver o fluxo funcionando <ArrowUpRight size={19} />
            </a>
            <div className="hero-note">
              Demonstração sem cadastro. Conecte Claude, OpenAI ou Gemini para os agentes escreverem.
            </div>
          </div>
          <HeroSurface />
        </section>
        <ScrollStory />
        <div className="brand-strip">
          <p>
            Para quem precisa
            <br />
            <strong>produzir com constância.</strong>
          </p>
          <div>
            <span>Empreendedores</span>
            <span>Criadores de conteúdo</span>
            <span>Times de marketing</span>
            <span>Agências e freelancers</span>
          </div>
          <Network size={29} />
        </div>
        <section className="flow-section" id="como-funciona" ref={flow}>
          <div className="flow-sticky">
            <div className="flow-heading">
              <h2>
                Pesquisa, criação e aprovação.
                <br />
                <span>Um fluxo de produção.</span>
              </h2>
              <p>
                Configure o processo uma vez.
                <br />
                Reutilize o contexto a cada novo conteúdo.
              </p>
            </div>
            <div className="flow-body">
              <div
                className="flow-steps"
                role="tablist"
                aria-label="Etapas da memorable"
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
                    href={`#app/${["pesquisar", "vigiar", "escrever", "aprovar", "publicar"][stage]}`}
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
                        "Racional · explique com evidência",
                        "Storytelling · desenvolva uma narrativa",
                        "Quebra de objeção · responda à dúvida",
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
                        Cada conteúdo,
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
              Produzir conteúdo não precisa
              <br />
              <span>ocupar toda a sua rotina.</span>
            </h2>
            <p>
              Para quem faz o marketing sozinho ou trabalha com uma equipe:
              reúna o contexto, organize as tarefas recorrentes e concentre
              sua atenção nas ideias e na revisão.
            </p>
          </div>
          <div className="team-editorial">
            <article>
              <span>01</span>
              <div>
                <h3>Comece pelo DNA da marca.</h3>
                <p>
                  Informe o site ou cole a documentação. Confira cores e fontes
                  encontradas, ajuste a voz e valide a identidade antes de usá-la.
                </p>
              </div>
              <Bookmark size={22} />
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>Aprove uma versão, com suas fontes.</h3>
                <p>
                  Confira de onde veio a informação e registre os ajustes.
                  Alterações no conteúdo aprovado exigem uma nova revisão.
                </p>
              </div>
              <ShieldCheck size={22} />
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>Transforme correções em critérios.</h3>
                <p>
                  Valide as lições que devem orientar as próximos conteúdos.
                  Registre resultados para avaliar o que merece continuar.
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
                <a href="#app/configuracoes">Conhecer o DNA da marca <ArrowUpRight size={16} /></a>
              </p>
            </div>
          </div>
        </section>
        <section className="landing-stack" aria-labelledby="landing-stack-title">
          <h2 id="landing-stack-title">Uma assinatura no lugar de várias ferramentas.</h2>
          <ul>
            {[
              ["Radar de pautas e canais vigiados", "ferramenta de tendências"],
              ["Acervo com resumo e texto completo", "app de notas e leitura"],
              ["Redação multiformato com a voz da marca", "assistente de escrita"],
              ["Roteiros, anúncios UGC e vídeos de produto", "editor de roteiro e estúdio"],
              ["Refino de voz e aprovação por versão", "revisor, planilha e e-mail"],
              ["Imagens e vídeos com Higgsfield", "estúdio de mídia"],
              ["Agenda, exportação e portfólio de cases", "agendador e pasta de apresentações"],
            ].map(([ours, theirs]) => (
              <li key={ours}>
                <b><Check size={16} /> {ours}</b>
                <span>{theirs}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="commercial-section" id="modelos">
          <div className="commercial-heading">
            <h2>
              Uma plataforma.
              <br />O seu jeito de adotar.
            </h2>
            <p>
              Comece com uma marca e um fluxo real. Meça tempo de revisão,
              qualidade e custo antes de ampliar a operação.
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
              Assinatura da plataforma
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
                  ? "Comece pelo conteúdo que você precisa produzir."
                  : "Valide o produto. Participe da evolução."}
              </h3>
              <p>
                {commercial === "subscription"
                  ? "Escolha o fluxo, os formatos e o volume de produção. A assinatura acompanha sua necessidade, trabalhando sozinho ou em equipe. Implantação, conexões e acompanhamento têm escopo definido na proposta."
                  : "O Grupo BBMD pode iniciar um piloto com sua equipe e discutir uma parceria de desenvolvimento ou investimento. Objetivos, prioridades e direitos são definidos em proposta própria, com base na experiência de uso."}
              </p>
              <a className="button primary" href="#app/painel">
                Explorar demonstração <ArrowUpRight size={19} />
              </a>
            </div>
            <ul>
              {(commercial === "subscription"
                ? [
                    "Piloto: teste uma rotina real de produção",
                    "Assinatura: capacidade de uso e integrações acordadas",
                    "Expansão: mais volume, pessoas ou marcas, se precisar",
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
        <section className="landing-questions" aria-labelledby="landing-questions-title">
          <h2 id="landing-questions-title">Como isso entra na sua rotina?</h2>
          <details><summary>Serve para quem produz conteúdo sozinho?</summary><p>Sim. Comece com seu negócio, suas fontes e os formatos que você precisa publicar. Você pode planejar, revisar e aprovar no mesmo espaço. Equipes e múltiplas marcas são possibilidades de expansão.</p></details>
          <details><summary>O que a automação faz e o que fica comigo?</summary><p>O fluxo reúne coleta de referências, preparação de pautas, criação e conferência. Você define público e objetivo, valida a identidade e aprova o conteúdo. Os critérios registrados acompanham as próximas produções.</p></details>
          <details><summary>O que posso testar agora?</summary><p>Tudo: importar páginas, arquivos e canais inteiros, extrair o DNA do site, vigiar fontes, gerar com o time de agentes (com uma chave Claude, OpenAI ou Gemini em Configurações), refinar, aprovar, agendar, exportar e montar cases no Portfólio. Imagens e vídeos usam sua conta Higgsfield. Publicação direta nas redes entra com a integração da implantação.</p></details>
          <details><summary>Preciso criar uma campanha para cada post?</summary><p>Não. Vá direto a Escrever para um conteúdo avulsa. Use Campanhas quando vários conteúdos compartilham um objetivo e precisam ser avaliados em conjunto.</p></details>
        </section>
        <section className="closing">
          <p>Sua próxima pauta pode virar um fluxo de produção.</p>
          <a href="#app/painel">
            Veja seu conteúdo
            <br />
            sair do papel.
            <ArrowUpRight aria-hidden="true" />
          </a>
          <div className="closing-foot">
            <span>MEMORABLE · AI-POWERED MARKETING</span>
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
