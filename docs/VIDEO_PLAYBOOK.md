# Guia de produção de vídeo (com e sem Higgsfield)

Como a Memorável produz vídeo curto de marca (Reels 9:16, PT-BR) com IA. Fonte: material oficial da Higgsfield
(transcrições, tutoriais, skills e prompts em `ai-powered-content/benchmark/higgsfield`, lote de 2026-11-24), as
instruções do fluxo Content Factory lidas no MCP da Higgsfield e o EXP-328. Vale para quem implementa o fluxo de
vídeo na plataforma e para qualquer sessão que gere vídeo para um case.

Skills de referência (ler antes de produzir; não copiar para o repositório):
- `Claude Opus 5.5 + Higgsfield Make Insane Motion Graphics! (Claude Motion) - skills/higgsfield-motion.skill`:
  filme em código, a base do nosso caminho sem Higgsfield. Ler `SKILL.md` e `references/production-lessons.md`.
- `How I Get Perfect AI Realism in Every Shot (3 Steps)/Higgsfield-Seedance-Prompt-Writer.skill` e
  `Higgsfield-Acting-Director.skill`: prompts do Seedance 2.5 e direção de atuação.
- `The Secret YouTube Strategy Dominating in 2027/higgsfield-faceless-production.md`: narração, trilha, efeitos e
  mixagem de vídeo narrado sem apresentador.
- `5 Best AI Side Hustles in 2026 (ft. Iman Gadzhi) - skills/higgsfield-motion-skill.md`: anúncio em motion com
  storyboard aprovado antes de renderizar.

## 1. Regras que não mudam

1. **O modelo de vídeo nunca escreve texto.** Texto na tela, legenda, logo, números e CTA são feitos em código e
   compostos por cima. Todo prompt de vídeo termina com "No text, no letters, no logos". Números que importam (ex.:
   500 convidados) aparecem em código, nunca como contagem de pessoas geradas: o modelo "completa" multidões.
2. **Referências antes do vídeo.** Nada de texto-para-vídeo puro em produção. Primeiro os assets, cada um com um
   nome `@` igual na Higgsfield (Elements) e no prompt:
   - local: imagem vazia, ângulo de três quartos (dá profundidade), sem texto ou placas legíveis;
   - pessoa: folha de personagem em fundo cinza (rosto grande + corpo), uma pessoa por folha (Soul 2 ou Soul Cinema);
   - produto e logo: GPT Image 2 (gráfico limpo) ou foto real de frente e verso;
   - paleta: cartão com os HEX da marca.
   A referência define aparência; o prompt define o que acontece. Diga o que cada referência define e o que não herda
   ("define o rosto e o corpo; fundo, pose e luz não são herdados").
3. **O som nunca falta.** Todo vídeo sai com narração, trilha e efeitos, inclusive versões intermediárias. Áudio do
   modelo de vídeo desligado (`generate_audio: false`) quando a narração é externa.
4. **Aprovar no barato antes de gastar no caro.** Roteiro → storyboard em imagens → aprovação → vídeo. Revisões
   mudam o storyboard primeiro e só depois renderizam de novo os planos afetados.
5. **Uma mudança por tentativa**, numerando versões e sem sobrescrever o que o cliente já viu.
6. **Marca jurídica:** nada de advogado gerado por IA falando, nada de imagem gerada que finja ser o evento, o
   escritório ou clientes reais; imagens ilustrativas ou fotos reais. Rotular conteúdo de IA quando publicado como
   anúncio e respeitar as regras de publicidade da OAB.

## 2. Os dois caminhos

| | Sem Higgsfield (padrão) | Com Higgsfield (híbrido) |
|---|---|---|
| Imagem | Filme em código (HTML/CSS/Canvas/WebGL) | Planos do Seedance 2.5 sem texto (local, b-roll ilustrativo) dentro do filme em código |
| Texto e legenda | Código | Código |
| Narração | TTS (Gemini, voz Charon no case jurídico) ou ElevenLabs | Idem, ou `generate_audio` da Higgsfield (`elevenlabs_v4`, `seed_audio`) |
| Trilha e efeitos | Trilha sintetizada em código ou de biblioteca; efeitos por evento | Idem; conferir no MCP se há modelo de música disponível |
| Custo de um Reels de 15 s | Centavos (texto do LLM) + narração | + créditos: Seedance 2.5 ≈ 3 cr/s em rascunho 480p e ≈ 12 cr/s em 1080p, com ~30% de reserva para refazer |

O caminho sem Higgsfield é o mesmo que a própria Higgsfield usa no **Content Factory** (vídeos narrados de 60 s em
9:16): cada quadro desenhado em código, e a única chamada paga é a narração. Foi também o que teve a melhor nota no
EXP-328.

## 3. Processo

1. **Briefing:** objetivo, público, mensagem-chave, idioma, formato e duração, texto obrigatório, assets, CTA.
2. **Cenário (antes de construir qualquer coisa):** a ideia em uma linha, os atos e uma tabela de planos na grade de
   batidas:

   | # | Tempo | Imagem | Câmera | Texto na tela | Som | Ralo / denso |
   |---|---|---|---|---|---|---|

   Mais um mapa de gatilhos: toda transição tem uma causa visível no plano anterior. Alternar planos ralos e densos
   a cada 1–2 cortes. 15 s pedem ~10 planos com durações variadas (ex.: 2-1-1-4-6 batidas), não 4 blocos iguais.
   Um grande momento no clímax, em ~70–78% da duração.
3. **Narração primeiro, depois a imagem.** Uma única gravação do roteiro inteiro (não uma por frase), escrita no
   idioma nativo, números por extenso. Ritmo em português: ~2,5 palavras/s (medido no case: 17 palavras em ~9 s).
   Direção de voz só em modelo que aceita marcação (ElevenLabs v4 com `[colchetes]`); o Gemini TTS lê a direção em
   voz alta. Conferir a gravação por transcrição e duração. Os tempos de cada palavra (Whisper com
   `word_timestamps`) viram o arquivo de eventos.
4. **Um arquivo de eventos** comanda imagem e som: cada entrada com quadro, tipo, peso e nota. Mudou o tempo, tudo
   continua sincronizado.
5. **Storyboard:** quadros-chave renderizados (ou uma folha única de 6–9 quadros gerada em imagem), aprovação.
6. **Render de rascunho**, QA, versão final.

## 4. Filme em código

- A página expõe `window.__comp = {width, height, fps, duration}` e `window.__seek(t)`, **função pura de t**: sem
  `requestAnimationFrame`, transições CSS, `Date.now` ou aleatório sem semente. Nosso
  `scripts/render-animation.mjs` congela animações CSS por quadro; funciona, mas o padrão é o `__seek`.
- 24 fps (casa com o Seedance). Versão final com motion blur por sub-quadros (obturador de 180°); nunca imitar blur
  em CSS.
- **Nada aparece de repente:** entrada = deslocamento + escala 0,96→1 + opacidade + desfoque 8→0 px em curva expo-out;
  a saída espelha em cubic-in. Elemento importante nunca entra ou sai só por opacidade.
- **Sem tempo morto:** algo novo a cada 0,5–0,6 s. Pausas só para leitura: status 1,0 s, item de lista 0,8 s,
  três números 1,2 s, assinatura final ≥1,5–2 s.
- **Câmera ativa e motivada:** segue o que se move ou revela a próxima informação; sem zoom brusco sem motivo nem
  tremor. No corte, a velocidade está no máximo e a direção se mantém.
- **Legibilidade:** tempo de leitura = max(1,0 s; 0,35 s × palavras + 0,5 s). Legenda com ≤32 caracteres por linha,
  ≥20 quadros na tela, fora das áreas da interface do Reels. Contraste ≥4,5:1 medido no pior pixel sob o texto.
- **Mínimo não é vazio:** cada quadro tem uma camada de mundo (foto, plano gerado, desenho da identidade), nunca
  enfeite solto.
- Cores, fontes e curvas vêm de tokens da marca (cadastro da Organização), não escritas à mão em cada vídeo.

## 5. Planos gerados (Seedance 2.5 na Higgsfield)

- Modelo `seedance_2_5`, modo `omni_reference`, referências em `image_references` (identidade, local, produto),
  `start_image` só para macro, natureza ou composições exatas. 9:16 tem prompt próprio. Duração inteira de 4 a 30 s,
  com vários planos e cortes secos marcados no tempo num único take.
- **Rascunho em 480p (`draft: true`), 2–4 takes, e finalizar só o escolhido** (`draft_job_id`, 1080p ou 4K, mesmo
  take e mesma câmera). Quatro rascunhos + final em 4K custaram 320 créditos contra 896 de quatro tentativas em 4K.
- **Prompt em inglês, em blocos:** SCENE CONTEXT · ACTIVE REFERENCES · LOCATION MAP · FIRST FRAME / BLOCKING ·
  FORMAT MODE · OPTICS · CAMERA · ACTION · PERFORMANCE · PHYSICS · LIGHTING · COLOR GRADE · AUDIO · STYLE ·
  OUTPUT SETTINGS · POSITIVE LOCKS. O estilo fica distribuído nos blocos, não num prefixo.
- **Descrever o visível:** campo de visão em graus (84°, 63°, 47°, 29°, 18°), luz em Kelvin, velocidade em km/h,
  neblina em %, esquerda e direita a partir da câmera, sempre em forma positiva ("fica de pé", não "não cai"),
  sem nomes de diretores ou equipamentos. Cada trecho termina com o estado final do quadro.
- Pessoas em cena levam um bloco ACTING TASK (direção da cena, motivo, objetivo, obstáculo, tática), com o trabalho
  nos olhos e sem adjetivo de emoção.
- Consultar `models_explore` uma vez por projeto; checar saldo e custo antes; registrar o gasto.
- QA de cada take: folha de contato a cada 0,5 s, diferença entre quadros para achar cortes escondidos, logo ou texto
  aparecendo, anatomia, identidade. Reprovado: refazer no máximo 1–2 vezes, uma correção por vez. Um detalhe errado
  num take bom se corrige editando o quadro e devolvendo como referência para aqueles segundos.

## 6. Som

- Narração mais alta; trilha abaixa ~10 dB sob as falas-chave.
- Efeito só quando tem função: o que aconteceu, o que o espectador deve notar e por que o som ajuda. Uma família de
  sons no tom da trilha; whoosh acompanha a câmera; o impacto cai no ponto mais rápido do movimento.
- Trilha com arco (ex.: pergunta → descoberta) e duração exata, sem voz, sem imitar artista.
- Master a −14 LUFS integrado, pico real ≤ −1 dBTP, nenhuma amostra saturada. Quem não ouve o áudio confere por
  números e diz isso.

## 7. QA antes de entregar

- Conferir o MP4 final, não a fonte: duração, quadros, áudio presente.
- Diferença entre quadros (picos = corte escondido; ≥6 quadros iguais = congelamento), tempo morto, tamanho e
  contraste do texto, sincronia nos pontos de impacto, quadros a cada 2 quadros ±0,5 s em volta de cada corte.
- Revisar no tamanho de celular e **assistindo**, não só por quadros soltos.
- Lista honesta do que ainda está errado, com tempo.

## 8. Avaliação (benchmark)

O EXP-328 (rodada 1) não mediu a Higgsfield como os especialistas a usam: texto para vídeo sem referência, prompt
sem estrutura, texto em português pedido ao modelo, modelos que eles não usam (Happy Horse, Kling 2.5) em vez do
Seedance 2.5, sem rascunho, sem plano de áudio, julgamento por 4 quadros. Avaliações futuras de vídeo:

- comparam o vídeo inteiro com som (folha de contato a cada 0,5 s + transcrição da narração), não 4 quadros;
- testam a Higgsfield no caminho híbrido acima, com Seedance 2.5, referências e rascunho;
- usam juiz independente e cético, no tamanho do celular, com a lista de critérios das seções 4–7.

## 9. O que falta na plataforma

O roteirista hoje gera cenas `{duração, fala, visual}` a 132 palavras/min. Para produzir vídeo com estas práticas:

1. Roteiro de vídeo vira cenário: tabela de planos (câmera, texto na tela, som, ralo/denso) + mapa de gatilhos, com
   ritmo de ~2,5 palavras/s, números por extenso e uma narração contínua.
2. Etapa de storyboard com aprovação antes de qualquer render pago.
3. Render: narração (uma gravação, conferida) → arquivo de eventos → filme em código com tokens da marca → trilha e
   efeitos → master → QA automático → MP4.
4. Opcional com Higgsfield: planos Seedance 2.5 sem texto, em rascunho, finalizados só depois da aprovação, com o
   custo em créditos do plano do cliente.
5. Voz do narrador por marca, em Organização.
