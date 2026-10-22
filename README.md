# Memorable AI-Powered Marketing

MVP para demonstrar ao Grupo BBMD uma operação editorial por marca: fontes, DNA, radar, campanhas, criação, revisão, distribuição e aprendizado.

## Executar

```sh
npm install
npm run dev:full
```

A interface abre em http://localhost:5173 e o serviço local em 127.0.0.1:5174. `npm run dev` executa apenas a interface; extração de DNA e coleta web precisam do serviço. `npm run build` gera a versão estática em dist. O build estático não hospeda as APIs.

## Recursos demonstráveis

- Acervo por marca, biblioteca compartilhada, fontes com origem, validade e etiquetas.
- DNA por site/documentação, cores e fontes com evidências, validação e aplicação ao contexto de criação.
- Radar com fontes cadastráveis, pesos configuráveis, classificação local e coleta de páginas públicas no serviço local.
- Campanhas com hipótese, evidência, oferta e sucesso esperado; snapshots de briefing por peça.
- Três entradas de escrita, sete formatos, três abordagens locais e adaptador opcional de IA.
- Conteúdo de origem e derivados relacionados, com conferência obrigatória após mudanças.
- Kanban independente da aprovação; conselho local, revisão humana, histórico e aprovação vinculada à versão.
- Agenda local, exportação e comprovante de publicação externa; alterações relevantes invalidam aprovações e agendamentos.
- Critérios editoriais por formato, exemplos, exceções e retirada reversível.
- Resultados manuais com evidência, revisão humana em minutos e custo informado; agregação por campanha.

## IA

- **Por conta (recomendado):** em Configurações → Conexões, cole a chave da **Claude (Anthropic)**, OpenAI ou Gemini. A chave fica criptografada em `.runtime` e os agentes passam a escrever, revisar e analisar pautas com ela. O padrão para Claude é `claude-opus-5-5`.
- **No servidor (vale para a demonstração sem login):** `ANTHROPIC_API_KEY` ativa Claude, e `MEMORABLE_CLAUDE_MODEL` troca o modelo. Também é possível usar um endpoint chat-completions com `MEMORABLE_AI_URL`, `MEMORABLE_AI_KEY` e `MEMORABLE_AI_MODEL`; os nomes antigos `SKYVIDYA_AI_*` continuam aceitos.
- **Mídia:** Higgsfield por **MCP** (OAuth) ou por **API** (chave `ID:SECRET` da Higgsfield Cloud), além de OpenAI e Gemini. Cada geração consome créditos do provedor.

Sem provedor, a escrita local entrega apenas estrutura com campos a completar, nunca texto apresentado como IA. Os custos reais das chamadas não estão incluídos nos valores ilustrativos da demonstração.

## Novidades de outubro/2026

- **Landing cinematográfica** em `/#motion`: o fluxo como pitch em movimento. As imagens foram geradas com Higgsfield (`public/motion`) e o design está registrado em `DESIGN.md` (seção #motion).
- **Canal inteiro como fonte:** em Pesquisar → Adicionar ao acervo → Canal inteiro, aceita YouTube (o canal todo, com título e descrição de cada vídeo), blogs (RSS, Atom ou sitemap) e Instagram (API oficial). O Vigiar acompanha o canal e importa só as novidades.
- **Portfólio de cases** em `/#app/portfolio`: reúne conteúdos aprovados, fontes, aprovações e só os resultados com evidência. Exporta uma apresentação em HTML.
- **Formatos do benchmark Higgsfield:** anúncio UGC, vídeo de produto, comercial, fotos de produto, fotos de imóvel e tour, site para negócio local, vídeo faceless para YouTube, thumbnail e produto digital, cada um com o método da skill correspondente (`src/playbooks.mjs`).
- **Sugestões de colaboradores:** o Administrador cria, em Organização e marcas, um acesso restrito para quem não é do marketing (advogados, RH). O colaborador entra por `/#sugerir`, envia o assunto com referência opcional e acompanha só as próprias ideias (Recebida, Aceita, Em produção, Publicada ou Não seguiu, com o motivo). O time faz a triagem em Vigiar → Sugestões: ao aceitar, o relato vira referência interna no acervo, marcada como não pública, e a ideia entra em Escrever. O colaborador tem sessão própria e nunca lê o documento da organização (`server/suggestions.mjs`, `.runtime/suggestions.sqlite`).
- **Vocabulário único:** ideia, conteúdo, marca e "em produção". Os status aparecem com os nomes das colunas do Kanban.
- Validação: `npm test`, `scripts/editorial-journey-check.mjs`, `scripts/growth-features-check.mjs`, `scripts/kanban-check.mjs`, `scripts/suggestions-check.mjs` e `scripts/motion-check.mjs`.

## Roteiro

1. Em Configurações, como Administrador, extrair e validar o DNA.
2. Em Campanhas, definir público, problema, hipótese e critério de sucesso.
3. Criar conteúdo, escolher fonte/prazo e desenvolver uma abordagem.
4. Criar um desdobramento e consultar sua relação com o conteúdo de origem.
5. Avaliar pelo conselho, enviar à revisão humana e aprovar a versão conferida.
6. Agendar localmente ou registrar uma publicação feita externamente.
7. Registrar resultado, evidência e esforço; transformar uma correção em critério validado.

## Validação

`npm test` verifica regras de negócio. Scripts Playwright usam o Chrome instalado no Windows: `scripts/journey-check.mjs`, `scripts/review-one-check.mjs`, `scripts/brand-check.mjs`, `scripts/campaign-check.mjs` e `scripts/final-inspection.mjs`.

## Limites

Dados editoriais persistem neste navegador. Papéis são demonstrativos, não autenticação nem autorização de produção. O serviço local guarda coleta e rotinas em `.runtime`; continua dependendo do computador e processo ligados. Redes autenticadas, transcrição do YouTube, publicação social, cobrança e métricas integradas exigem implantação. O DNA não executa JavaScript, lê PDFs ou interpreta screenshots. A geração local estrutura texto; o conselho local não certifica qualidade factual ou conformidade jurídica. Não há comprovação de ROI nem atribuição causal de resultados.

Veja `docs/IMPLEMENTACAO-DIAGNOSTICOS.md`, `../doc/MEMORABLE-SINERGIAS-E-EVOLUCAO.md` para decisões e pendências. A chave de armazenamento antiga é mantida para preservar dados anteriores. Os MVPs originais permanecem em `../mvp`.

## Contas locais e SQLite

A versão atual inclui cadastro/login em `/#auth` e persistência por conta em `.runtime/memorable.sqlite` (instalações antigas continuam usando `.runtime/skyvidya.sqlite`). Sem conta, permanece a demonstração em localStorage. A autenticação local não substitui ainda os papéis demonstrativos nem isola as rotinas compartilhadas de coleta. Detalhes, limites e preparação da migração para nuvem: `docs/AUTH-PERSISTENCIA-MOTION.md`.
