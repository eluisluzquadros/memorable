---
version: 1
slug: "src-main-jsx"
primary_target: "src/main.jsx"
related_targets: ["src/Advanced.jsx","src/Contribute.jsx","src/AuthPage.jsx"]
---

# Plataforma (interior do app): rotas #app/*, #auth, #sugerir

Modo: Operate. Público: time de marketing (gerente e equipe do Grupo BBMD), colaboradores convidados em #sugerir. Tarefas: pesquisar e vigiar referências, escrever com agentes, aprovar por versão, agendar, acompanhar custos e cases. Restrições: função, textos e fluxos atuais preservados; acessível (WCAG AA) nos dois temas; desktop 1440 e celular 390.

Decisões do usuário (2026-10-22): tema segue o sistema com alternância lembrada; identidade da landing nos detalhes; modo claro em papel quente.

## Direction contract

THESIS: O estúdio da landing, aceso para trabalhar. O app é uma ferramenta de produção comum de navegar (barra lateral, tabelas, abas, formulários padrão) e recusa o painel SaaS cinza com azul de destaque que existia antes.

OWN-WORLD: Escuro: tinta #08090c, superfícies #111319/#0d0f13, texto papel #f4efe6, secundário #b3aca2, filetes papel a 12%. Claro: papel quente #f4efe6, cartões #fbf8f2, lateral #ece5d8, texto tinta. Pedra (#d9c6a3 / #7a5a2b no claro) marca seleção e item ativo; âmbar #ff7a1a só no botão principal e no foco; magenta só como luz (seleção de texto, alças). Archivo em tudo; Anton só no título da página. Pílulas para o que é clicável, raio 16px nos painéis, vidro só em diálogos e menus.

STORY: A pessoa reconhece a landing ao entrar, encontra cada tarefa onde espera e lê em que etapa cada conteúdo está sem abrir nada.

FIRST VIEWPORT: Painel: lateral escura/papel com marca Memorável., escopo da marca e navegação; topo com trilha, alternância de tema e papel; título Anton grande à esquerda e um único botão âmbar "Criar conteúdo" à direita; números da operação em Archivo tabular; abaixo, próximo passo e gráfico da produção.

FORM: Assinatura: a trilha de etapas da landing (Ideia → Escrevendo → Em aprovação → Aprovado → Agendado → Publicado) como indicador de andamento no detalhe do conteúdo e como mapa do quadro sobre as colunas do Kanban (contagem por etapa, leva à coluna). Direção fixada pelo usuário (landing aprovada), que sobrepõe o sorteio; seed:00588c4e152ea4b6. Caminho code-led (Operate).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
