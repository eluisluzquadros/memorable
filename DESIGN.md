# Direção: estúdio editorial em movimento

Self-authored under explicit creative delegation.
Marca Esteira, lettering Sora; texto DM Sans. Display até 96px, corpo 16px, metadata 12px. Azul cobalto #214cff, grafite #172027, papel frio #f6f8fb, branco #fff, texto secundário #596572, borda #dce1e8. Verde #167154 e âmbar #8c5700 somente para estados.
Landing: tese em grande escala à esquerda, diagrama funcional com profundidade à direita; navegação horizontal discreta. Produto: navegação lateral compacta, tabela editorial, detalhes em painel. Bordas finas, raios 8–16px, sem gradiente de texto e sem métricas inventadas.
Movimento transforma uma fonte em formatos de conteúdo, com scroll e escolha manual. Sem captura de scroll; reduced-motion mantém estados navegáveis. Desktop 1440 e celular 390 são composições distintas.

---

# Mundo #motion: landing cinematográfica (escopo isolado)

Escopo: somente a rota `#motion` (`src/LandingMotion.jsx`, `src/landing-motion.css`, `src/motion-fonts.css`). Tudo vive sob `.mx-root`; nada daqui vaza para o app nem para `src/Landing.jsx`, que seguem o mundo acima (Sora/DM Sans, cobalto, papel frio). Registrado a partir do código entregue; extensões (motion, breakpoints, componentes) em `.impeccable/design-motion.json`.

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
H1 com fundo rgba(255,47,168,.32) em `box-decoration-break: clone`, alças magenta de 2px com bolinha de 12px nas pontas e uma barra de ações (Copiar · Aprovar · Publicar, a última em âmbar) flutuando acima. O produto editando a própria promessa.

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
- **Don't** levar Anton, `--stone` ou o vidro para o app ou para a landing clássica.
