# Laboratório de modelos da Memorável

Como escolhemos, com evidência, quais modelos fazem cada parte do trabalho, e quanto custa um conteúdo completo em cada nível de qualidade.

## 1. Objetivo

Encontrar, para cada função do time de agentes, a combinação de modelos que entrega **a qualidade exigida pelo menor custo**, e manter isso medido ao longo do tempo, como fazem os benchmarks de mercado (LMArena, Artificial Analysis): método publicado, resultados versionados, cada número rastreável até a chamada que o gerou.

Desse laboratório saem os **perfis de configuração** que a plataforma oferece a cada conta, ajustados ao orçamento dela sem cair abaixo do piso de qualidade.

## 2. O que medimos

Cada saída de modelo é medida em quatro eixos:

| Eixo | Como | Fonte |
|---|---|---|
| **Qualidade** | Juízes cegos de famílias diferentes da do autor dão notas de 1 a 5 em clareza, evidência, voz e utilidade, com versões embaralhadas e anônimas; mais a checagem mecânica da plataforma (fontes válidas, citação literal, clichês, formato e tempo). Quando houver, a decisão humana (aprovado sem edição, com edição, reprovado) pesa mais que os juízes. | `bench_items.scores`, `editorialIssues`, aprovação no Kanban |
| **Velocidade** | Tempo até a resposta (p50 e p95) | `llm_calls.ms` |
| **Custo** | Custo real informado pelo provedor, por saída e por **conteúdo completo** | `llm_calls.cost`, créditos da Higgsfield |
| **Confiabilidade** | Taxa de sucesso, rodadas de reescrita, falhas de formato | `llm_calls.ok`, `editorialReview.rounds` |

**Piso de qualidade (proposta):** um modelo só é **qualificado** para uma função com nota média ≥ 4,0, nenhuma nota abaixo de 3 em evidência e ≥ 90% de aprovação na checagem mecânica, em N ≥ 3 peças por formato.

## 3. Funções avaliadas

- **Texto:** Planejador, Redator, Editor crítico, Revisor e Juiz do refino, DNA da marca, Leitura de referência.
- **Imagem:** quadros-chave, capa de carrossel, peças estáticas.
- **Vídeo, três caminhos:**
  - **A, Higgsfield:** geração de vídeo por modelo, pago em créditos.
  - **B, motion por código:** o Claude escreve a animação (tipografia, gráficos, transições) e a plataforma renderiza. Custo só de texto e de processamento.
  - **C, Blender:** cena 3D montada por script, sozinho ou junto com a Higgsfield quando indicado.
- **Áudio:** locução (TTS) e trilha, quando a integração existir.

## 4. Conteúdo completo de referência

Para comparar perfis, usamos uma unidade fixa: **um roteiro de vídeo de até 60 s, pronto para publicar.** Ela inclui:

- plano, roteiro e revisão;
- 6 a 8 cenas;
- quadros-chave em imagem;
- clipes de vídeo, ou motion e 3D;
- capa e SEO.

O custo médio dessa unidade é calculado em cada caminho de vídeo (A, B e C) e em cada perfil.

## 5. Perfis de configuração

Para cada função, o laboratório desenha a **fronteira de Pareto** entre qualidade e custo e escolhe três pontos:

| Perfil | Regra |
|---|---|
| **Essencial** | o modelo qualificado mais barato de cada função |
| **Equilibrado** | o melhor custo-benefício: o joelho da fronteira, onde subir de modelo passa a custar muito mais por pouca nota |
| **Excelência** | a maior qualidade medida, com o custo que for |

Os perfis não precisam ser todos de um mesmo fornecedor. Uma função pode ser Essencial num perfil e Excelência no outro; por exemplo, o redator caro e o revisor barato.

### Ajuste ao orçamento

Cada conta define um teto **semanal ou mensal** em dinheiro e um volume esperado de conteúdos. A plataforma calcula o custo de cada perfil para esse volume e sugere o **maior perfil que cabe**.

- **Nunca abaixo do piso:** se nem o Essencial cabe, a plataforma avisa e sugere reduzir o volume. Ela não troca por um modelo que não passou no piso de qualidade.
- **Gasto acompanhado no caminho:** o custo real é somado continuamente. Ao chegar a 80% do teto, a conta é avisada. Ao chegar a 100%, novas gerações pedem confirmação.

## 6. Rastreabilidade

Cada rodada é um experimento **EXP-NNN** pré-registrado no ledger (hipótese, método, critério, teto de gasto), com estas garantias:

- **Registro no banco:**
  - `bench_runs`: a rodada, com briefs, funções, modelos, juízes, teto e estado;
  - `bench_items`: cada saída, com modelo, custo, tempo, tokens, notas por juiz e checagens;
  - `llm_calls`, com `run_tag = EXP-NNN`: cada chamada paga.
- **Retomada sem perda:** cada resposta é salva ao chegar. Se a rodada cair (tempo, falta de crédito, erro), ela retoma de onde parou e não paga de novo. Mídia sem crédito na Higgsfield fica "aguardando crédito", com os textos e prompts já salvos.
- **Tudo visível na plataforma:** os conteúdos gerados nas rodadas entram nas contas como peças com a tag **Validação** ou **Demonstração**, fora das métricas reais e do portfólio público.
- **Juízes também têm custo e viés registrados:** juízes que "raciocinam" custam mais que redatores baratos, então o juiz também é escolhido por custo e qualidade.

## 7. Base de testes: os 6 cases da landing

| Case | Conta e contexto | Funções exercitadas |
|---|---|---|
| Um episódio, sete conteúdos | Podcast Bastidores, da BBMD (YouTube e Instagram) | transcrição, Redator multiformato, vídeo curto |
| Uma operação, seis vozes | Grupo BBMD | DNA, voz por marca, coerência do grupo |
| Do radar ao LinkedIn | Skyvidya | Radar, Redator com fonte, imagem |
| Cinco anúncios UGC | conta de demonstração (loja) | imagem e vídeo, 5 ganchos |
| Dúvida virou série | conta de demonstração (clínica) | série de roteiros de 15 s |
| Constância sem equipe | marca pessoal do Isaac (quando existir) ou demonstração | calendário semanal |

Os cases resultantes são aprovados por uma pessoa antes de entrar no portfólio. Só os de contas reais podem ser mostrados como cases reais.

## 8. Painel

Em **Time de agentes > Laboratório**:

- **Mapa qualidade × custo por função:** a fronteira de Pareto, com os pontos dos perfis marcados.
- **Tabela por modelo:** nota, custo por saída, p50, taxa de sucesso, número de peças avaliadas e data da última medição.
- **Perfis:** Essencial, Equilibrado e Excelência, com o custo do conteúdo completo de referência em cada caminho de vídeo.
- **Simulador de orçamento:** teto semanal ou mensal e volume, mostrando qual perfil cabe.
- **Histórico de rodadas (EXP):** estado, gasto e acesso às saídas comparadas, com o autor oculto até a pessoa revelar.

## 9. Fases

1. **Base:** tabelas `bench_runs` e `bench_items` com retomada; gasto real ligado ao Orçamento; painel v1 com as rodadas de texto já feitas.
2. **Redator e funções de texto:** rodada 2 refeita pelo laboratório, N ≥ 3 por formato, dois juízes.
3. **Perfis e orçamento:** cálculo dos perfis, simulador e aplicação em "Quem faz o quê".
4. **Cases de portfólio, parte de texto:** os 6 cases pelo fluxo real, com a tag Validação ou Demonstração.
5. **Mídia:** imagem e vídeo de 60 s nos caminhos A, B e C, com custo por conteúdo completo, retomável quando faltar crédito.
6. **Decisão humana:** as aprovações reais passam a calibrar as notas dos juízes.
