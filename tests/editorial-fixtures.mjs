export const source = {
  id: "climate",
  workspace: "bbmd",
  title:
    "Dados climáticos confiáveis: o elo entre ciência e mercado segurador brasileiro - IRB(Re)",
  origin: "www.irbre.com",
  editorialRole: "reference",
  citable: true,
  text: "Para aplicações em seguros, resseguros e gestão de portfólio, a fonte de dados precisa ser validada no território, no tipo de variável e no uso de negócio pretendido. Satélites e modelos não substituem a observação em solo. A qualidade e a aderência da série climática podem afetar os gatilhos dos seguros paramétricos.",
};
export const carousel = `TELA 1
Dados globais. Risco local.
Uma base climática conhecida não garante aderência ao território que você precisa analisar.

TELA 2
A variável muda a decisão.
Antes de modelar risco, defina se a pergunta envolve precipitação, temperatura ou outro sinal. O uso pretendido orienta a escolha da base.

TELA 3
Valide antes de combinar.
Compare os dados com observações do território. Registre as limitações e reconheça a incerteza, especialmente onde há poucas estações em solo.

TELA 4
Transforme camadas em contexto.
Na Skyvidya, inteligência geoespacial e leitura territorial apoiam a interpretação de riscos. O ponto de partida é entender o que o dado permite concluir.

TELA 5
Três perguntas para a próxima análise.
Qual é a origem da base? Em qual região ela foi validada? Que limitações precisam acompanhar a decisão?

TELA 6
Sua próxima decisão começa pelo dado.
Conheça a abordagem da Skyvidya para transformar sinais do território em decisões com contexto.`;
export const shortSpeech =
  "Risco climático não cabe numa média. Na Skyvidya, conectamos dados e território para apoiar decisões com contexto. Conheça nossa abordagem.";
export const speeches = [
  "Uma base climática conhecida não garante aderência ao território analisado. O primeiro passo é definir qual decisão os dados precisam apoiar.",
  "Precipitação, temperatura e escala exigem cuidados distintos. Compare a série com observações locais e registre as limitações que podem mudar a interpretação.",
  "Na Skyvidya, inteligência geoespacial e contexto territorial orientam a leitura dos sinais. Conheça nossa abordagem e traga a pergunta da sua operação.",
];
export const badScript =
  "CENA 1 · 2s\nFala: Dados climáticos confiáveis: o\nDireção: Apresentação do tema; título legível.\n\nCENA 2 · 6s\nFala: Dados climáticos confiáveis: o elo entre ciência e mercado segurador brasileiro - IRB(Re).\nDireção: Apresentador e apoio visual da fonte; conferir evidências.\n\nCENA 3 · 2s\nFala: Qual dúvida você gostaria\nDireção: Fechamento com convite informativo.";
export const badCarousel = `TELA 1\n${source.title}: o que precisa ficar claro?\n\nTELA 2\n${source.title}\n\nTELA 3\n${source.title} Skip to content Assessoria de Imprensa Entre em contato Compartilhe Conteúdo Não basta escolher uma base climática por disponibilidade ou reconhecimento internacional.\n\nTELA 4\nQual dúvida você gostaria de esclarecer?`;
export const packet = {
  workspace: "bbmd",
  brand: { name: "Skyvidya" },
  voice: {
    positioning:
      "Inteligência geoespacial para leitura de riscos com contexto territorial.",
  },
  brief: {
    title: "Dados e risco local",
    brandName: "Skyvidya",
    format: "Carrossel",
    versionCount: 1,
  },
  sources: [source],
  brandKnowledge: [],
  lessons: [],
};
export const acceptedReviews = (versions) => ({
  reviews: versions.map((_, index) => ({
    index,
    coherent: true,
    brandAligned: true,
    evidenceSupported: true,
    complete: true,
    reason:
      "Ideias distintas, mensagem da marca e evidências fornecidas; conferir a interpretação antes da publicação.",
    issues: [],
  })),
});
