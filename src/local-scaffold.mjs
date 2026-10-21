import {
  productionSettings,
  timelineFor,
  scriptBody,
  videoProductionPlan,
} from "./production.mjs";
export function localVariants(packet) {
  const b = packet.brief,
    settings = productionSettings(b),
    name = packet.brand?.name || b.brandName || "Sua marca";
  return ["Racional", "Storytelling", "Quebra de Objeção"]
    .slice(0, settings.versionCount)
    .map((strategy) => {
      const sections = [
        `[Gancho: formule uma abertura completa para ${name}, usando a abordagem ${strategy}.]`,
        "[Escreva a ideia central e o benefício para o público, sem copiar o título da fonte.]",
        "[Evidência: desenvolva um exemplo sustentado pela referência e explique sua relação com a marca.]",
        "[Ação: conclua com um próximo passo coerente com a oferta da marca.]",
      ];
      const scenes = settings.video
        ? timelineFor(settings.durationSeconds).map((part, i) => ({
            ...part,
            speech: sections[Math.min(i, sections.length - 1)],
            visual: "[Complete a direção visual da cena.]",
          }))
        : null;
      return {
        ...settings,
        strategy,
        mode: "local",
        localScaffold: true,
        sourceIds: packet.sources.map((s) => s.id),
        hook: "",
        body: scenes
          ? scriptBody({ scenes })
          : b.format === "Carrossel"
            ? sections.map((s, i) => `TELA ${i + 1}\n${s}`).join("\n\n")
            : sections.join("\n\n"),
        visual: `Direção para ${name}. Defina composição, paleta e identidade antes de gerar arquivos.`,
        av: "Estrutura para redação e gravação. Nenhum áudio ou vídeo foi gerado.",
        seo: {
          title: b.title,
          description: "Completar depois da redação.",
          tags: [],
          entities: [],
          alt: "",
        },
        facts: packet.sources.map((s) => ({
          source: s.title,
          excerpt: s.text.slice(0, 320),
          verified: false,
        })),
        ...(scenes
          ? { scenes, ...videoProductionPlan({ scenes }, packet) }
          : {}),
      };
    });
}
