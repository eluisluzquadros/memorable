---
name: Memorable
description: Plataforma de produção de conteúdo com agentes; o estúdio da landing #motion, aceso para trabalhar, em papel quente (claro) e tinta de estúdio (escuro).
colors:
  paper-bg: "#f4efe6"
  paper-surface: "#fbf8f2"
  paper-surface-2: "#ede6da"
  paper-surface-3: "#e4dacb"
  paper-fg: "#17140f"
  paper-fg-muted: "#5c5448"
  paper-fg-subtle: "#7d7365"
  paper-line: "rgba(23, 20, 15, 0.13)"
  paper-line-strong: "rgba(23, 20, 15, 0.28)"
  stone-deep: "#7a5a2b"
  stone-deep-wash: "rgba(160, 121, 62, 0.15)"
  ember: "#ff7a1a"
  ember-hover: "#ff8b38"
  on-ember: "#08090c"
  focus-light: "#c2410c"
  hot-light: "#c81077"
  hot-wash-light: "rgba(200, 16, 119, 0.16)"
  ok-light: "#17603a"
  warn-light: "#8a5300"
  danger-light: "#b42318"
  glass-light: "rgba(251, 248, 242, 0.86)"
  ink-bg: "#08090c"
  ink-surface: "#111319"
  ink-surface-2: "#0c0d11"
  ink-surface-3: "#1b1e26"
  ink-fg: "#f4efe6"
  ink-fg-muted: "#b3aca2"
  ink-fg-subtle: "#8c867d"
  ink-line: "rgba(244, 239, 230, 0.11)"
  ink-line-strong: "rgba(244, 239, 230, 0.25)"
  stone: "#d9c6a3"
  stone-wash: "rgba(217, 198, 163, 0.13)"
  focus-dark: "#ff7a1a"
  hot-dark: "#ff2fa8"
  hot-wash-dark: "rgba(255, 47, 168, 0.3)"
  ok-dark: "#5fd39a"
  warn-dark: "#ffb050"
  danger-dark: "#ff8178"
  glass-dark: "rgba(17, 19, 25, 0.82)"
typography:
  page-title:
    fontFamily: "Anton, Archivo, sans-serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "0.004em"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 780
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 76"
  metric:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "'tnum'"
    fontVariation: "'wdth' 78"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    fontFeature: "'tnum'"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    fontVariation: "'wdth' 85"
  table-header:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 80"
rounded:
  pill: "999px"
  field: "10px"
  select: "14px"
  panel: "16px"
  dialog: "18px"
spacing:
  main-y: "42px"
  main-x: "44px"
  topbar-x: "42px"
  panel: "28px"
components:
  button-primary:
    backgroundColor: "{colors.ember}"
    textColor: "{colors.on-ember}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.ember-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.paper-fg}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  button-secondary-hover:
    backgroundColor: "{colors.paper-surface-3}"
  button-dark:
    backgroundColor: "{colors.paper-fg}"
    textColor: "{colors.paper-bg}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  nav-item:
    textColor: "{colors.paper-fg-muted}"
    rounded: "{rounded.pill}"
  nav-item-active:
    backgroundColor: "{colors.stone-deep-wash}"
    textColor: "{colors.paper-fg}"
    rounded: "{rounded.pill}"
  stage-rail-step-active:
    backgroundColor: "{colors.stone-deep}"
    textColor: "{colors.paper-bg}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  stage-rail-step-active-dark:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink-bg}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  badge:
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  input:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.paper-fg}"
    rounded: "{rounded.field}"
  panel:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel}"
  dialog:
    backgroundColor: "{colors.glass-light}"
    textColor: "{colors.paper-fg}"
    rounded: "{rounded.dialog}"
  dialog-dark:
    backgroundColor: "{colors.glass-dark}"
    textColor: "{colors.ink-fg}"
    rounded: "{rounded.dialog}"
  toast:
    backgroundColor: "{colors.paper-fg}"
    textColor: "{colors.paper-bg}"
    rounded: "{rounded.pill}"
  toast-dark:
    backgroundColor: "{colors.ink-fg}"
    textColor: "{colors.ink-bg}"
    rounded: "{rounded.pill}"
---

# Design System: Memorable (app)

Escopo: o interior do app (rotas `#app/*`, `#auth`, `#sugerir`). Tokens em `src/theme.css`; camada de identidade em `src/app-skin.css`, importada por último; tons de avatar de marca em `src/brand-tones.mjs`; tema em `src/ThemeSwitch.jsx` e no script pré-pintura de `index.html`. A rota `#motion` tem mundo próprio, registrado na segunda parte deste arquivo.

**Landing clássica (`#classica`, `src/Landing.jsx`).** Não tem sistema próprio. Ela é estilizada por `styles.css` com os nomes legados (`--ink`, `--paper`, `--display`…), que agora apontam para os tokens do app; por efeito colateral, herda Archivo, o papel quente ou a tinta conforme o tema, e o âmbar como ação. Não foi redesenhada; o que ela mostra é o que os tokens do app produzem nela.

## Overview

**Creative North Star: "O estúdio aceso para trabalhar"**

O mesmo estúdio da landing #motion, com as luzes de trabalho acesas. O app continua sendo uma ferramenta de produção comum de navegar (barra lateral, trilha, tabelas, abas, formulários padrão), e a identidade entra nos detalhes: Archivo em tudo, Anton só no título da página, pílulas para o que é clicável, pedra marcando o que está selecionado, um único botão âmbar por tela, vidro só nos diálogos e a trilha de etapas da landing como indicador de andamento.

Dois temas com o mesmo desenho: claro em papel quente (`#f4efe6`, cartões `#fbf8f2`, lateral `#ede6da`, texto tinta) e escuro na tinta do estúdio (`#08090c`, superfícies `#111319`, texto papel). A escolha salva (`localStorage["memorable-theme"]`) define `html[data-theme]` antes da primeira pintura; sem escolha, `prefers-color-scheme` decide. O tema escuro é a referência da landing; o claro é a mesma paleta invertida para leitura longa. O painel SaaS cinza com azul de destaque que existia antes foi recusado.

**Key Characteristics:**
- Neutros quentes nos dois temas; nenhum cinza frio, nenhum azul.
- Pedra (`#7a5a2b` no claro, `#d9c6a3` no escuro) para seleção, item ativo, contagens e etapa atual.
- Âmbar `#ff7a1a` preenchido só no botão principal; também é o foco no escuro e o ponto da marca.
- Magenta só como luz: seleção de texto.
- Archivo variável com largura condensada (76–85%) para títulos e rótulos; números tabulares em toda parte.
- Pílula (999px) para controles; 16px para painéis; 18px e vidro para diálogos.

## Colors

Duas paletas espelhadas sobre os mesmos papéis: papel quente com tinta no claro, tinta com papel no escuro. Os nomes de token CSS são os mesmos nos dois temas; o frontmatter separa os valores por prefixo (`paper-*` claro, `ink-*` escuro).

### Primary
- **Brasa** (`ember`, hover `ember-hover`): o botão principal da tela ("Criar conteúdo", "Novo conteúdo"), com texto tinta `on-ember` nos dois temas e brilho `--action-glow`. Também o ponto final da marca "Memorable." e o ícone dos toasts.

### Secondary
- **Pedra** (`stone` no escuro; `stone-deep` no claro, mais escura para passar AA sobre papel): item ativo da barra lateral (como lavagem `stone-wash`/`stone-deep-wash`, ícone na cor cheia), aba selecionada (filete inferior + lavagem), contadores de navegação e do quadro, etapa atual da trilha, links de texto, `accent-color` de checkbox e rádio, `em` do título da tela de entrada. Como preenchimento de gráfico no claro, é misturada a 72% com o fundo para não ficar barrenta.

### Tertiary
- **Magenta de LED** (`hot-light` / `hot-dark`, lavagem `hot-wash-*`): só `::selection`. Não é cor de superfície nem de estado.

### Neutral
- **Fundo** (`paper-bg` / `ink-bg`): página, área principal, topo translúcido (fundo a 88% + blur 12px).
- **Superfície** (`paper-surface` / `ink-surface`): painéis, tabelas, campos, seletor de marca.
- **Superfície 2** (`paper-surface-2` / `ink-surface-2`): barra lateral, painel de história da entrada, cabeçalhos das colunas do Kanban, fundo da trilha.
- **Superfície 3** (`paper-surface-3` / `ink-surface-3`): hover de linha, de botão secundário, de ícone e de item de navegação; avatares.
- **Texto** (`*-fg`), **secundário** (`*-fg-muted`, também placeholder), **sutil** (`*-fg-subtle`).
- **Filete** (`*-line`) e **filete forte** (`*-line-strong`, bordas de campo, botão secundário e alternância de tema).
- **Inverso** (`--inverse`/`--on-inverse`): o texto principal do tema usado como fundo; botão escuro e toast.
- **Estados** (`ok-*`, `warn-*`, `danger-*`, cada um com lavagem própria): só para status, nunca decoração.
- **Tons de marca** (`src/brand-tones.mjs`: `#8a6420`, `#3f6b4f`, `#6b4766`, `#b4461a`, `#8e3b3b`, `#4a5560`): avatares de marca; cores legadas salvas em contas antigas (cobalto `#214cff` e afins) são remapeadas para esses tons.

### Named Rules
**The One Ember Rule.** Um botão âmbar preenchido por tela. Ações secundárias são pílulas com filete; a ação de contexto forte (ex.: "Abrir revisão") usa o botão escuro inverso, nunca um segundo âmbar.

**The Stone Means Selected Rule.** Pedra indica onde a pessoa está ou o que está escolhido (item ativo, aba, etapa atual, contagem com itens). Não usar pedra como decoração.

**The Warm Neutrals Rule.** Todo neutro tem matiz quente nos dois temas; nenhum cinza-azulado.

## Typography

**Display Font:** Anton 400 (com Archivo, sans-serif), self-hosted via `src/motion-fonts.css`
**Body Font:** Archivo variável (com system-ui, sans-serif), self-hosted, eixo de largura usado entre 76% e 100%

**Character:** Archivo condensado é a voz de trabalho (títulos de seção, rótulos, números); Anton aparece uma vez por tela, como o letreiro do estúdio no título da página.

### Hierarchy
- **Título da página** (`page-title`; 2.25rem abaixo de 760px; `text-wrap: balance`): o h1 de cada página do app, da tela de entrada e de `#sugerir`. Um por tela.
- **Headline** (`headline`, largura 76%): h2/h3 de seções, painéis e diálogos ("O ritmo da produção", "Em produção").
- **Métrica** (`metric`; faixa de estatística a 30px, lh 1.05): números do painel e totais.
- **Body** (`body`; lede da página a 15px, máx. 68ch): texto corrido; números sempre tabulares no shell inteiro.
- **Label** (`label`, largura 85%): trilha de etapas, cabeçalhos do Kanban, alternância de tema (13px/600), selos (11.5px/600).
- **Cabeçalho de tabela** (`table-header`, largura 80%, tracking .08em).

**The Anton Once Rule.** Anton só no h1 da página (e no título da história de entrada). Seções, cartões, diálogos e números ficam em Archivo.

## Layout

- **Shell:** barra lateral de 248px (superfície 2, filete à direita) com marca, seletor de marca (raio 14px), busca e navegação agrupada; topo de 76px com trilha à esquerda e, à direita, alternância de tema, tour, conta, indicador de demonstração e seletor de papel; área principal com padding 42px 44px 52px e máx. 1510px.
- **Cabeçalho de página:** título Anton à esquerda e o único botão âmbar à direita; abaixo, faixa de métricas separada por filetes.
- **Kanban:** a trilha do quadro ocupa a largura toda acima das colunas, uma estação por coluna; cada coluna abre com um cabeçalho em pílula.
- **≤850px:** a navegação vira gaveta; papel, conta e sincronização saem do topo e entram em `.sidebar-mobile-tools`, no fim da gaveta, separados por filete; a trilha do topo trunca com reticências; a trilha do quadro rola na horizontal.
- **≤760px:** título da página a 2.25rem; a alternância de tema fica só com o ícone; o indicador de demonstração sai do topo; a trilha de etapas mostra só a etapa atual com rótulo e as demais como pontos de 6px.

## Elevation & Depth

Plano por padrão, com profundidade por camadas tonais (fundo → superfície 2 → superfície → superfície 3) e filetes. Sombras existem só onde algo flutua ou é a ação; a cor delas vem de `--shadow` (marrom a 14% no claro, preto a 55% no escuro).

### Shadow Vocabulary
- **Brilho da ação** (`0 12px 28px -16px var(--action-glow)`; hover `0 16px 32px -16px`): só o botão âmbar.
- **Diálogo** (`-24px 34px 70px -30px var(--shadow), inset 1px 1px 0` branco a 12%): cai para baixo-esquerda, como a luz do estúdio da landing.
- **Toast** (`0 18px 40px -16px var(--shadow)`).
- **Carimbo da etapa** (animação `rail-stamp` .45s: escala 1.18 → 1 com anel de 6px em lavagem de pedra): quando um conteúdo muda de etapa; desligada em reduced motion.

### Named Rules
**The Glass Is for Dialogs Rule.** Vidro (`--glass` + `backdrop-filter: blur(22px) saturate(140%)`, fundo do modal tinta a 50% com blur 4px) só em diálogos. Painéis, cartões e colunas são opacos. O topo e a trilha usam blur 12px apenas como véu de leitura, sem borda de vidro.

## Shapes

Pílula (999px) para tudo que é clicável ou é estado: botões, itens de navegação, botão de ícone, busca, alternância de tema, selos, contadores, trilha de etapas, cabeçalhos de coluna, toasts. Abas são pílulas cortadas embaixo (`999px 999px 0 0`). Campos de texto e selects com 10px; seletor de marca com 14px; painéis e estados vazios com 16px; diálogos com 18px. A marca usa barras com 2px de raio.

## Components

### Buttons
- **Shape:** pílula, padding 12px 20px, peso 650; transição de fundo, borda, sombra e posição com `--ease` cubic-bezier(.16, 1, .3, 1).
- **Primary:** âmbar com texto tinta e brilho; hover clareia e sobe 1px.
- **Secondary:** transparente com filete forte; hover em superfície 3.
- **Escuro:** fundo inverso (tinta no claro, papel no escuro); hover mistura 14% de pedra.
- **Perigo:** fundo `danger` com texto `on-state`.
- **Texto:** link em pedra, sublinhado no hover (offset 3px).
- **Ícone:** pílula sem fundo em texto secundário; hover em superfície 3.
- **Foco (todos os interativos):** `outline: 2px solid var(--focus)`, offset 3px (laranja queimado `#c2410c` no claro, âmbar no escuro).

### Chips / Selos
- **Style:** pílula 11.5px/600, padding 4px 10px, cor e lavagem do estado.
- **Contadores:** pílula de 24px em pedra cheia com texto `on-accent`; vazios ficam em superfície 3 com texto secundário.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** superfície sobre o fundo; padding 28px.
- **Shadow Strategy:** nenhuma; ver Elevation & Depth.
- **Border:** filete `--line`.
- **Tabelas:** cabeçalho condensado com tracking; hover de linha em superfície 3.

### Inputs / Fields
- **Style:** superfície, filete forte, raio 10px; hover escurece a borda (texto a 40%); placeholder em texto secundário. A regra usa `:where()` (especificidade zero) para que invólucros como a busca mantenham o campo interno sem borda.
- **Busca:** pílula com filete forte; `:focus-within` troca a borda para a cor de foco.
- **Checkbox / rádio:** `accent-color` em pedra.

### Navigation
- **Barra lateral:** itens em pílula, texto secundário; hover em superfície 3; ativo em lavagem de pedra com texto principal e ícone em pedra. Rótulos de grupo em caixa alta 10px, funcionais.
- **Topo:** fundo a 88% com blur 12px e filete inferior.
- **Abas:** selecionada com texto principal, filete inferior em pedra e lavagem de pedra.
- **Celular:** gaveta com as ferramentas de papel e conta no fim.

### Alternância de tema
Pílula de 36px com filete forte, ícone lua/sol de 16px e rótulo do tema de destino ("Escuro"/"Claro", 13px/600); alterna entre claro e escuro e salva a escolha. Em Configurações, o select "Tema da plataforma" oferece "Seguir o sistema", "Claro (papel)" e "Escuro (estúdio)"; "Seguir o sistema" apaga a escolha salva e remove `data-theme`.

### Diálogo
Vidro do tema, filete do texto a 16%, raio 18px, sombra de diálogo, cabeçalho transparente, título em headline Archivo.

### Toast
Pílula no inverso do tema com ícone âmbar; erro troca o fundo para `danger` e ícone e fechar para `on-state`.

### Trilha de etapas (assinatura)
A trilha de passos da landing, em `<ol>` com `aria-current="step"`: Ideia → Escrevendo → Em aprovação → Aprovado → Agendado → Publicado. Pílula externa (padding 4px, filete, superfície 2 a 80% com blur 12px); cada etapa em pílula com label 12px. Concluídas em texto principal com check de 13px em pedra; atual em pedra cheia com texto da cor do fundo e o carimbo de entrada; futuras em texto secundário.
- **No detalhe do conteúdo:** acima do título, mostra onde a peça está.
- **No Kanban (trilha do quadro):** largura total, uma estação por coluna, cada uma um botão com contador (pedra quando há itens) que leva à coluna. Os cabeçalhos das colunas repetem a forma: pílula em superfície 2 com contador em pedra; a coluna que recebe um arraste acende a borda em pedra.

### Tela de entrada
O painel de história é a avenida noturna da landing (`public/motion/avenue.webp`) com a torre de LED acesa com a frase da marca ("Sua voz. Seu contexto.", gradiente `--screen`, scanlines e spill), presa ao enquadramento por uma moldura com o `aspect-ratio` da foto (688/1024). Por ser fotografia noturna, o painel mantém a paleta do estúdio nos dois temas: título Anton em papel, `em` em pedra, véus de tinta no topo e na base para leitura. Abaixo de 850px a foto sai e fica só o texto. O formulário à direita segue o tema e os campos e botões do app.

## Do's and Don'ts

### Do:
- **Do** usar os nomes de `src/theme.css` (`--bg`, `--surface*`, `--fg*`, `--line*`, `--accent*`, `--action*`, `--focus`, estados) em toda folha nova; os nomes legados existem só para o código antigo.
- **Do** verificar cada tela nos dois temas, em 1440 e em 390.
- **Do** manter um único botão âmbar por tela e usar o botão escuro inverso para a ação forte de contexto.
- **Do** mostrar a etapa de um conteúdo com a trilha de etapas, não com um selo solto.
- **Do** usar números tabulares para todo dado.
- **Do** respeitar `prefers-reduced-motion` em qualquer animação de estado, como faz o carimbo da trilha.

### Don't:
- **Don't** reintroduzir Sora, DM Sans, cobalto `#214cff` ou o papel frio `#f6f8fb` no app.
- **Don't** usar âmbar preenchido em mais de um botão por tela.
- **Don't** usar Anton fora do título da página.
- **Don't** aplicar vidro fora de diálogos.
- **Don't** usar magenta como superfície, estado ou decoração; ele é só a luz da seleção de texto.
- **Don't** trazer para o app os dispositivos cinematográficos da landing: telas de LED, `--screen`, figura recortada, palavra-cenário, palco de scroll.

---

# Mundo #motion: landing cinematográfica (escopo isolado)

Escopo: somente a rota `#motion` (`src/LandingMotion.jsx`, `src/landing-motion.css`, `src/motion-fonts.css`). Tudo vive sob `.mx-root`, e os tokens daqui não vazam para fora dele. O app tomou deste mundo, por decisão do usuário, apenas tipo (Archivo, Anton no título), paleta (tinta, papel, pedra, âmbar, magenta como luz), pílulas, o trilho de passos e o vidro dos diálogos, recriados com tokens próprios em `src/theme.css` (ver a primeira parte). A landing não mudou. Registrado a partir do código entregue; extensões (motion, breakpoints, componentes) em `.impeccable/design-motion.json`.

## Overview

**Creative North Star: "O estúdio à noite"**

O pipeline do produto encenado como filme em cinco atos (pauta, escrita, crítica, aprovado, no mundo) num estúdio escuro: palavra-cenário em tipo de madeira cor de pedra atrás de uma figura recortada, painéis de produção em vidro fosco orbitando o lado aberto da figura e, no último ato, telas de LED na cidade acendendo com a peça publicada. Escuro, quente, alta escala tipográfica; a cor saturada aparece como luz emitida, nunca como superfície de interface.

**Key Characteristics:**
- Tinta noturna como base única; papel quente para texto; pedra só na tipografia de cenário.
- Um gradiente de LED (magenta para âmbar) como luz de tela; âmbar sozinho como a ação.
- Anton para escala de cenário, Archivo variável (largura 72–100%) para todo o resto.
- Vidro fosco com inclinação 3D como único material de painel.
- Imagens geradas com IA (Higgsfield), declaradas no rodapé.

## Colors

Paleta escura comprometida: neutros quentes sobre tinta, um par de acentos de luz.

| Token CSS | Valor | Papel |
|---|---|---|
| `--ink` | #08090c | Fundo da página inteira; texto sobre âmbar e LED |
| `--paper` | #f4efe6 | Texto principal, títulos |
| `--muted` | #b3aca2 | Texto secundário, nav inativa, legendas |
| `--stone` | #d9c6a3 | Palavras-cenário Anton, displays de seção, passo ativo do trilho |
| `--line` | rgba(244,239,230,.14) | Todos os filetes e bordas |
| `--glass` | rgba(17,19,25,.66) | Corpo dos painéis de vidro |
| `--ember` | #ff7a1a | CTA primário, foco, ícones de confirmação, números de dados |
| `--hot` | #ff2fa8 | Seleção, alças, início dos gradientes de luz |
| `--screen` | linear-gradient(135deg, #ff2fa8, #ff7a1a 70%, #ffb050) | Telas de LED, spill, reflexo |

**The Ember Is the Action Rule.** Âmbar preenchido é só o CTA primário ("Ver o fluxo funcionando", hover #ff8b38); no resto, âmbar aparece como traço, ícone ou número, nunca como segundo botão cheio.

**The Light Not Paint Rule.** Magenta e `--screen` existem como luz emitida (LED, onda de áudio, barras de medidor, slide de carrossel, halo do fechamento). Não usar como fundo de seção ou de cartão comum.

## Typography

**Display Font:** Anton 400 (com Archivo, sans-serif), self-hosted `public/fonts/motion-0/1.woff2`
**Body Font:** Archivo variável 400–800, largura 62–100% (com system-ui), self-hosted `motion-2/3.woff2`

**Character:** Anton é o letreiro de madeira do cenário; Archivo 800 condensado a 72% é a voz editorial dos títulos; Archivo a 100% é o texto.

### Hierarchy
- **Cenário** (Anton 400, `min(calc(94vw / var(--len) / 0.5), 44svh)`, lh .84, `--stone`): a palavra do ato, dimensionada pelo número de letras (`--len`) para encher a largura.
- **Display de seção** (Anton 400, lh .86–.9, `--stone`): Portfólio clamp(64px, 7.4vw, 120px); fechamento clamp(84px, 13vw, 210px).
- **Headline** (Archivo 800, largura 72%, lh .98–1, tracking -0.015 a -0.02em, `text-wrap: balance`): h1 clamp(42px, 5.2vw, 82px); atos clamp(36px, 3.8vw, 60px); Planos clamp(40px, 4.6vw, 72px).
- **Título de cartão** (Anton 400, 30–34px, lh 1): slide, aprovação, cases.
- **Body** (Archivo 400, 16–17px, lh 1.5, máx. 42–44ch; lede clamp(18px, 1.6vw, 22px)).
- **Label de UI** (Archivo 700, largura 75%, 11–12px, tracking .12em, caixa alta, `--muted`): apenas cabeçalho funcional de painel simulado ou de tabela.

**The Numbers Are Tabular Rule.** Todo número de dado (notas, horários, contagens) usa `tabular-nums`; notas grandes em Anton âmbar.

## Layout

- Gutter único `--pad: clamp(20px, 5vw, 72px)`; seções de conteúdo com 120px vertical (88/80px no celular), separadas por filete `--line`.
- **Palco de atos:** `.mx-stage` de 680svh com filho sticky de 100svh. O scroll vira progresso global sobre 6 atos (início + 5); `--t` (0–1) é o progresso local, escrito direto no sticky por um único listener rAF passivo e consumido em CSS (parallax da palavra, figura, painéis, zoom da cidade). Sem captura de scroll; o trilho rola até `index + 0.08` do ato.
- **Composição de ato:** palavra no topo (14svh), figura em `left: 58%` com 92svh, cópia em baixo à esquerda (`bottom: 11–12svh`, máx. 470–560px), painéis à direita inclinados para a figura, trilho embaixo ao centro, aviso de demonstração embaixo à direita.
- **Ato "no mundo":** figura e painéis saem, a cidade entra (vitrine com zoom `1.04 + t·0.12`); em `t ≥ 0.55` corta para a avenida (`.is-avenue`), a palavra vira título à esquerda, os painéis somem e a cópia ganha caixa de vidro.
- **Abaixo do palco:** arena + Portfólio (grade `0.75fr / 1.5fr`, cases `auto-fill minmax(230px, 1fr)`), Planos (tabela `1fr / 1.2fr` + adoção em 3 colunas numeradas em Anton), fechamento (`1.2fr / 1fr`, halo magenta no canto inferior esquerdo).
- **≤1100px:** painéis `min(310px, 34vw)`, cópia 44vw.
- **≤760px (composição própria, não espremida):** figura centralizada a 74svh; cópia na largura toda sobre um véu de tinta; só o painel A, 46vw, à esquerda e inclinado ao contrário (`rotateY(14deg) scale(.86)`); trilho vira pontos de 6px com rótulo só no passo ativo; vitrine a 180vw, avenida centralizada sem máscara; arena 46svh/200vw; todas as grades em uma coluna; dica de scroll e assinatura somem.
- **Reduced motion:** `prefers-reduced-motion: reduce` troca o palco por `.mx-static`: hero parado e cada ato como seção comum (grade 2 colunas, 1 no celular) com a palavra a 60% de opacidade, painéis empilhados sem 3D nem animação, cidade parada (`.is-still`, só vitrine). Mesma história e mesmo conteúdo, sem sticky nem `--t`.

## Elevation & Depth

Profundidade por luz, desfoque e perspectiva. Camadas fixas no sticky: estúdio (z -2, radial quente no canto superior direito), cidade (-1), palavra (0), figura (1, `drop-shadow(0 40px 60px rgba(0,0,0,.55))`), painéis (2, `perspective: 1400px`), cópia (3), trilho (5).

### Shadow Vocabulary
- **Vidro** (`-28px 34px 60px -26px rgba(0,0,0,.8), inset 1px 1px 0 rgba(255,255,255,.14)`): painéis de produção.
- **Cartão** (`0 24px 40px -28px rgba(0,0,0,.9)`): cases.
- **CTA aceso** (`0 18px 40px -16px rgba(255,122,26,.7)`, hover `0 24px 48px -16px rgba(255,122,26,.85)`).

**The Light Casts Shadow Rule.** Sombras são difusas e caem para baixo-esquerda, vindas da luz do estúdio; a única sombra colorida é o brilho âmbar do CTA e da figura no ato "aprovado".

## Shapes

Pílula (999px) para tudo que é clicável (CTA, ghost, nav, trilho, chips); 16–18px para vidro (painéis, caixa do ato final); 14px para cases; 10px para a barra de seleção; 2–3px para barras de dados. Telas de LED não têm raio: são retângulos encaixados na perspectiva da foto.

## Components

### Buttons
- **Primário:** pílula âmbar, texto `--ink` 700/16px, padding 15px 24px; sobe 2px no hover com `--ease` cubic-bezier(.16, 1, .3, 1) em .35s.
- **Ghost / Entrar:** pílula com borda `--line`, 600/14–15px; hover clareia a borda (.4–.45) e o fundo (.06).
- **Foco:** `outline: 2px solid var(--ember)`, offset 3px.

### Painel de vidro (assinatura)
Largura `min(340px, 25vw)`, padding 14px 16px 16px, `--glass` + `backdrop-filter: blur(18px) saturate(140%)`, borda rgba(244,239,230,.16), brilho quente diagonal no `::before` (rgba(255,214,160,.16) até transparente em 38%). Dois por ato: **A** alto à direita, `rotateY(-16deg)`; **B** mais baixo e recuado, `rotateY(-9deg) translateZ(30px)`; ambos derivam em Y com `--t`. Variantes: slide (gradiente magenta→âmbar, texto tinta), reprovação (borda rosa), aprovação (borda âmbar, título Anton âmbar). Linhas internas separadas por `--line`, a primeira sem filete.

### Entrada por ato
Cada ato tem um verbo de movimento, tocado uma vez na entrada: **pauta** varre (`mx-scan`: rotateY -48deg + blur 8px); **escrita** distribui como cartas (`mx-deal`); **crítica** sacode o painel reprovado (`mx-jolt`) e esfria o estúdio (`hue-rotate(-24deg)`, figura dessaturada a .72); **aprovado** carimba (`mx-stamp`: scale 1.35 com overshoot) e a palavra vira âmbar inclinada -3deg; **no mundo** sobe (`mx-rise`). A palavra entra desfocando (blur 14px → 0, scale 1.06 → 1) e sai encolhendo para .94. O painel B atrasa .12–.2s.

### Seleção do título (hero)
H1 com fundo rgba(255,47,168,.32) em `box-decoration-break: clone`, alças magenta de 2px com bolinha de 12px nas pontas e uma barra de ações (Criar · Aprovar · Publicar, a última em âmbar) flutuando acima. O produto editando a própria promessa.

### Trilho de passos
Pílula escura com blur 12px; passo ativo em `--stone` com texto tinta, concluídos em papel .8, futuros `--muted`; `aria-current="step"`.

### Tela de LED
`container-type: size`, para a tipografia escalar com a tela (`cqh` na vitrine horizontal, `cqw` na avenida vertical); fundo `--screen`, texto tinta; marca 800/80% + manchete Anton + legenda de formato. Scanlines no `::after` (`repeating-linear-gradient(0deg, rgba(0,0,0,.07) 0 1px, transparent 1px 3px)`). Atrás, **spill** do mesmo gradiente (`blur(70px)`, opacidade .5–.55, `mix-blend-mode: screen`); na vitrine, **reflexo** no piso (`scaleY(-1)`, blur 12px, opacidade .6, máscara até transparente em 85%). Posições em % medidas sobre a foto, dentro de uma moldura com o `aspect-ratio` da imagem (1344/752, 688/1024), então a tela fica presa ao enquadramento em qualquer viewport.

### Anel da arena (marquee)
SVG com o viewBox da foto (1344×752, `preserveAspectRatio="none"`) sobre a imagem; texto Anton 40px em tinta .8 com `mix-blend-mode: multiply` corre num `textPath` elíptico (`A 342 50`) pela faixa de LED; títulos dos cases repetidos duas vezes, `startOffset` 0 → -100% em 60s via SMIL; máscara com fade de 14% nas pontas. Moldura e foto escalam juntas, então o texto acompanha o anel.

### Cases
Cartão 14px, gradiente 160deg #1a1b21→#101115, título Anton 32px, marca em âmbar 600/13px, origem → resultado com seta âmbar, selo "Demonstração" em 11.5px. Hover sobe 4px e acende a borda em âmbar .5.

## Do's and Don'ts

### Do:
- **Do** rotular todo dado sintético na própria tela: "Dados de demonstração" fixo no palco (e na versão estática), "Demonstração" em cada case, "Imagens geradas com IA · conteúdo de demonstração" no rodapé.
- **Do** descrever resultados como transformação (fonte → peças, versões, agenda), não como número.
- **Do** amarrar o movimento de scroll a `--t` em CSS, com um único listener rAF passivo.
- **Do** manter a versão `.mx-static` completa para reduced motion: o mesmo conteúdo, nunca menos.
- **Do** posicionar telas e textos sobre fotos em % de uma moldura com o `aspect-ratio` da imagem.

### Don't:
- **Don't** inventar métricas, clientes, logos ou depoimentos (alcance, engajamento, ROI). As notas dos painéis (9,1, 8,4…) existem só como UI simulada sob o aviso de demonstração.
- **Don't** usar âmbar preenchido em mais de um botão por viewport.
- **Don't** usar `--screen` em texto (`background-clip: text`) ou como fundo de seção.
- **Don't** capturar o scroll (snap ou scroll-jacking); o trilho apenas rola até o ato.
- **Don't** levar os dispositivos cinematográficos desta landing (telas de LED e `--screen`, figura recortada, palavra-cenário, palco de scroll, painéis de vidro inclinados) para o app ou para a landing clássica. O app leva só tipo, paleta, pílulas, o trilho e o vidro dos diálogos.
