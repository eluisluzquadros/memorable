# Gauntlet aplicado à Esteira

## Prompt adaptado

Construa um MVP de operação de conteúdo que o Grupo BBMD consiga experimentar e avaliar como assinatura de plataforma ou parceria estratégica. Preserve as funcionalidades úteis dos dois protótipos e substitua sua linguagem visual por uma identidade coerente e profissional. Divida o trabalho em implementação, crítica funcional e crítica visual independentes. Os críticos devem inspecionar o produto real, explicar a maior lacuna observável e devolver correções ao construtor. Repita até os fluxos centrais passarem e as falhas materiais encontradas estiverem resolvidas. Mantenha evidências de desktop, celular, acessibilidade e funcionamento. Não invente métricas, integrações, comparação cega ou perfeição.

## O que foi adaptado

A exigência vaga de “AAA/perfeito” virou critérios verificáveis: texto e CTA legíveis, fluxo completo utilizável, fonte preservada, aprovação da versão correta, ausência de publicação simulada como real, metadados no celular, estados vazios e exportação funcional. A crítica ficou separada da implementação. Não houve comparação A/B cega porque não havia artefatos equivalentes e anonimizados para sustentá-la.

O [gauntlet-loop](https://somethingbig.ai/gauntlet-loop) forneceu o ciclo construir → criticar → corrigir. O [Scrollcraft](https://github.com/nateherkai/scroll-craft) orientou profundidade, narrativa, composição móvel e inspeção de estados intermediários. Do [Scroll-world](https://github.com/oso95/scroll-world) foi adaptada a continuidade entre etapas; sua cadeia paga de vídeos não foi executada. O [Impeccable](https://impeccable.style/) orientou tipografia, hierarquia e estados. Seu carregador binário falhou no ambiente; as instruções foram lidas diretamente.

## Evidência das rodadas

**Crítica funcional inicial:** identificou publicação falsamente externa, aprovação contornável e indicadores fixos nos protótipos de origem. Esses comportamentos não foram mantidos.

**Revisão do novo código:** identificou prazo vazio, perda de edição entre abordagens, corrida entre geração e fonte e conflito do link de acessibilidade com rotas por hash. Corrigidos. A função de edição agora valida o papel, e a rejeição registra categoria e justificativa.

**Crítica visual independente:** direção aprovada, com três solicitações. Hero móvel empilhado para eliminar sobreposição de texto; responsável e prazo preservados na tabela móvel; quantidades zero sem barras positivas. O crítico reinspecionou as capturas e marcou os três pontos como resolvidos.

**Verificação técnica:** testes de domínio e jornada por navegador; conferência automatizada de acessibilidade e correção de contraste; capturas desktop, mobile e movimento reduzido. Os arquivos de evidência locais ficam em `qa/`, fora da publicação.

## Limites

Captura em viewport móvel não equivale a teste em um telefone físico. Aprovação humana demonstrativa não certifica conteúdo jurídico. O protótipo não valida autenticação, cobrança, infraestrutura multiusuário, IA externa nem postagem em redes. Esses itens pertencem à implantação.
