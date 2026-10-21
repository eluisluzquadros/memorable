# Implementação dos diagnósticos — 10/09/2026

Esta entrega implementa a camada de campanha, rastreabilidade de derivados e memória editorial proposta em `../../doc/DIAGNOSTICO-ESTRATEGICO-SKYVIDYA.md`. Preserva o MVP local e os dados existentes.

## Entregas verificáveis

| Diagnóstico | Implementação | Verificação |
|---|---|---|
| A produção precisa responder a uma hipótese | Nova área Campanhas, com público, problema, evidência, oferta, objeção, hipótese, critério de sucesso, qualificação e referência inicial | Criar campanha, iniciar peça a partir dela, recarregar |
| Mudanças de estratégia não podem reescrever o passado | Peça guarda campanha e versão do briefing usadas na criação | Editar campanha preserva o snapshot da peça existente |
| Conteúdo central e derivados precisam permanecer relacionados | Criação de desdobramentos pela campanha, detalhe da peça e Resultados | Origem e versão acessíveis no detalhe; vínculo incluído no contexto da produção |
| Alterações podem afetar vários conteúdos | Propagação transitiva a derivados; agenda cancelada e revisão invalidada; conferência explícita da origem | Testes de edição da peça principal e alteração da fonte |
| Publicação realizada não pode desaparecer | Comprovante preservado quando a fonte muda; alerta de conferência; seção de publicações registradas | Verificação de status e URL em teste de dependências |
| Correção não é regra universal | Critérios por formato, exemplo, exceção e vínculo à rejeição; retirada reversível | Só critérios ativos e compatíveis entram no contexto |
| Volume não basta para avaliar valor | Resultados incluem evidência, critério de qualificação, minutos humanos e custo real informado | Contagens por campanha, mantendo atualização por peça sem duplicação de registros |
| Uma resposta atrasada da IA não pode substituir contexto novo | Retorno descartado se briefing, versão ou papel mudar durante a requisição | Guarda explícita de contexto no adaptador; chamada real ao provedor não executada sem configuração |

## Roteiro para conferir

1. Em Campanhas, cadastrar uma hipótese para uma marca.
2. Criar conteúdo da campanha, selecionar fonte e prazo, explorar abordagens e salvar.
3. No detalhe, criar desdobramento, escolher formato, editar e salvar.
4. Voltar à campanha e consultar as peças vinculadas.
5. Editar o conteúdo de origem: o derivado pede conferência e perde eventual aprovação/agendamento.
6. Conferir o vínculo e submeter a peça novamente aos controles editoriais. A conferência de origem não aprova o texto.
7. Em Resultados, registrar medição, evidência, esforço e aprendizado; consultar o agregado na campanha.
8. No Caderno, validar um critério para um formato, com exemplo e exceção. Retirar o critério preserva seu registro.

## Validação realizada

- 22 testes de regras, incluindo isolamento, snapshots, dependências transitivas, publicação preservada e contexto com critérios por formato.
- Jornada de campanha no navegador com criação real de peça e derivado, persistência e abertura do detalhe.
- Verificação visual da campanha em desktop; checagens de responsividade e acessibilidade em desktop e celular.
- Jornadas anteriores de radar, voz, Kanban, memória, resultados, aprovação, agenda e exportação continuaram passando.
- Build de produção verificado. A configuração do provedor e a publicação social real não foram exercitadas.

## Limites e continuidade do diagnóstico

Não há atribuição automática de receita nem comprovação de ganho causal. Métricas são informadas pelo time; uma conversa pode aparecer em mais de uma peça. A relação entre fontes e derivados é por documento/peça, ainda não por afirmação individual. Campanhas existentes são versionadas para novas peças; não alteram retroativamente os snapshots.

O conselho local continua sendo um conjunto de verificações, sem calibração contra uma amostra de editores. O próximo teste de produto precisa comparar tempo humano e qualidade com a rotina atual. O DNA ainda usa extração de declarações e validação humana, não análise visual de páginas renderizadas.

Permanecem como implantação: identidade individual, autorização no servidor, banco multiusuário, filas duráveis, publicação autenticada e resultados integrados. Permanecem como evolução de produto: ativos visuais editáveis/renderizados, extração semântica de trechos, medição de presença em respostas de IA e experimentos de aprendizado editorial. Não foram anunciados como módulos operacionais nesta entrega.
