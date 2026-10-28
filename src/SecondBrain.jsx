import React, { useContext } from "react";
import { ArrowRight, Fingerprint, FileText, CheckCheck, BookOpen, LineChart, Network } from "lucide-react";
import { AppContext } from "./context";
import { sourceValid, strategicSource, brandMemory } from "./operations.mjs";
import { BrandSources } from "./BrandSources";
import { VoiceSettings } from "./Advanced";
import { Subtabs, Subpanel, useSubtab } from "./Subtabs";

const VOICE_FIELDS = ["tone", "audience", "positioning", "pillars", "say", "avoid", "examples", "checklist"];

// The brand's second brain: five layers that every new piece receives, and where each is tended.
export function SecondBrain() {
  const { state, sources, goto } = useContext(AppContext);
  const voice = state.voices[state.workspace] || {};
  const dna = state.brandDNA?.[state.workspace];
  const filled = VOICE_FIELDS.filter((k) => String(voice[k] || "").trim()).length;
  const official = sources.filter((s) => s.workspace === state.workspace && strategicSource(s) && sourceValid(s));
  const lessons = state.rules.filter((r) => r.workspace === state.workspace && r.active !== false);
  const { approvedExamples, insights } = brandMemory(state);
  const [tab, setTab] = useSubtab("cerebro", ["visao", "dna", "materiais"]);
  const layers = [
    {
      icon: Fingerprint,
      title: "Identidade",
      count: dna ? `DNA versão ${dna.revision}` : "DNA a extrair",
      text: `${filled} de ${VOICE_FIELDS.length} campos da ficha de voz preenchidos. É a base de tom, público, pilares e do que a marca nunca diz.`,
      action: ["Revisar DNA e ficha de voz", "cerebro/dna"],
    },
    {
      icon: FileText,
      title: "Materiais oficiais",
      count: `${official.length} ${official.length === 1 ? "material" : "materiais"}`,
      text: "Entrevista, apresentações, manuais e páginas oficiais. Sustentam o que a marca afirma sobre si e alimentam o DNA.",
      action: ["Gerenciar materiais", "cerebro/materiais"],
    },
    {
      icon: CheckCheck,
      title: "Conteúdos aprovados",
      count: `${approvedExamples.length} em uso como exemplo`,
      text: approvedExamples.length
        ? `Os mais recentes ensinam a voz aprovada: ${approvedExamples.map((p) => `“${p.title}”`).join(", ")}.`
        : "Cada conteúdo que você aprova passa a ensinar a voz da marca para os próximos.",
      action: ["Abrir o Kanban", "kanban"],
    },
    {
      icon: BookOpen,
      title: "Decisões validadas",
      count: `${lessons.length} ${lessons.length === 1 ? "critério" : "critérios"}`,
      text: "Correções que a equipe transformou em regra. Entram em toda nova criação do formato a que se aplicam.",
      action: ["Abrir o Caderno de decisões", "caderno"],
    },
    {
      icon: LineChart,
      title: "Resultados",
      count: `${insights.length} ${insights.length === 1 ? "aprendizado" : "aprendizados"}`,
      text: "O que funcionou com o público, registrado com evidência. Orienta as próximas escolhas de tema e formato.",
      action: ["Registrar resultados", "resultados"],
    },
  ];
  return (
    <div className="brain-page">
      <div className="page-heading">
        <div>
          <h1>Um segundo cérebro para a sua marca.</h1>
          <p>Tudo o que a sua marca sabe, produz e aprende, guiando cada novo conteúdo.</p>
        </div>
      </div>
      <Subtabs
        label="Seções do segundo cérebro"
        value={tab}
        onChange={setTab}
        items={[
          ["visao", "Visão geral"],
          ["dna", "DNA e voz"],
          ["materiais", "Materiais"],
        ]}
      />
      {tab === "dna" && <Subpanel id="dna"><VoiceSettings /></Subpanel>}
      {tab === "materiais" && (
        <Subpanel id="materiais">
          <BrandSources
            selectable={false}
            title="Materiais oficiais da marca"
            intro="Apresentações, propostas, manuais, gravações e exportações do seu segundo cérebro (Notion, Google Drive, notas em Markdown, texto, PDF ou Word). A entrevista resolve quem não tem site. Tudo entra como material oficial e alimenta o DNA e a escrita."
          />
        </Subpanel>
      )}
      {tab === "visao" && <Subpanel id="visao">
      <section className="brain-layers" aria-label="Camadas do segundo cérebro">
        {layers.map(({ icon: Icon, title, count, text, action }) => (
          <article key={title} className="r-panel brain-layer">
            <header>
              <Icon size={20} aria-hidden="true" />
              <h2>{title}</h2>
              <span>{count}</span>
            </header>
            <p>{text}</p>
            <button className="text-button" onClick={() => goto(action[1])}>
              {action[0]} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </article>
        ))}
      </section>
      <p className="brain-truth">
        As cinco camadas seguem com cada pedido de escrita e de refino desta marca. Conteúdos aprovados servem de exemplo de voz, nunca de fonte de fatos.
      </p>
      <section className="r-panel brain-future">
        <h2>Conectar o conhecimento onde ele já vive.</h2>
        <p>Conectores contínuos ainda não estão implementados; por enquanto, a importação é por arquivo.</p>
        <div>
          {["Google Drive e documentos", "Notion e bases internas", "CRM, ofertas e objeções", "Reuniões e conversas autorizadas"].map((name) => (
            <article key={name}>
              <Network size={19} aria-hidden="true" />
              <b>{name}</b>
              <span>Planejado</span>
            </article>
          ))}
        </div>
      </section>
      </Subpanel>}
    </div>
  );
}
