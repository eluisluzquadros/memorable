# Organização, marcas e cadastro

Implementado em 18/10/2026.

## Modelo apresentado ao usuário

Uma pessoa cria o acesso. A conta administra uma organização. A organização começa com uma marca ou com um grupo de marcas. Cada marca corresponde a um espaço com voz, público, DNA, fontes, conteúdos, orçamento e agenda próprios.

Criar marcas não cria logins nem envia convites. Esta entrega oferece uma organização por conta; gestão de equipe com convites e permissões individuais não foi acrescentada nesta etapa.

## Cadastro

1. Dados de acesso: nome da pessoa, e-mail e senha.
2. Estrutura da operação: escolher uma marca ou um grupo, informar o nome da organização e cadastrar as primeiras marcas.

O modo de uma marca usa o nome do negócio para a organização e sua primeira marca. O grupo recebe nome próprio e de 2 a 20 marcas iniciais. A interface mostra uma prévia da hierarquia antes de concluir e preserva os campos ao voltar entre etapas. Nomes vazios, repetidos ou fora dos limites são rejeitados.

O serviço valida os dados antes de criar o usuário. Usuário e estado inicial da organização são gravados na mesma transação. Não são inseridos exemplos da BBMD. Após o cadastro de um grupo, a navegação abre a visão consolidada; uma marca abre seu painel.

## Gestão posterior

Em `#app/organizacao`, a conta pode alterar o nome da organização, adicionar e renomear marcas, arquivar e restaurar. Alterar o nome do grupo não altera os nomes das marcas. Os identificadores permanecem estáveis, preservando vínculos de fontes e conteúdos.

Adicionar uma segunda marca transforma uma operação de marca única em grupo. Uma marca nova começa sem copiar a identidade, as fontes ou as peças da anterior. Esta versão permite até 50 marcas por organização na gestão posterior.

Arquivar mantém conteúdo, identidade e configurações, retira a marca da seleção ativa e dos totais consolidados e pausa o Radar. O serviço rejeita novas operações de coleta em uma marca arquivada e interrompe a coleta agendada. Restaurar torna o espaço disponível novamente; rotinas pausadas não são reativadas automaticamente. Pelo menos uma marca permanece ativa.

## Orquestração

Em `#app/grupo`, os totais consolidam as marcas ativas: quantidade de marcas, conteúdos, pendências de revisão e agenda local. Cada cartão mostra o andamento da marca e permite abri-la no contexto correto.

O Kanban continua imediatamente após a visão geral na navegação. A visão do grupo aparece na sequência. A produção e a aprovação continuam vinculadas à marca escolhida; não existe um contexto de escrita que misture todas automaticamente. Fontes só atravessam espaços quando marcadas para a biblioteca compartilhada.

## Verificações

- 66 testes de domínio/contratos: validação, cadastro atômico, dados independentes, adição de marcas, nomes estáveis, arquivo reversível, preservação de contexto e permissões.
- `scripts/organization-check.mjs`: cadastro de grupo em duas etapas, volta sem perda, contextos separados, criação de rascunho real pelo modo local, consolidação dos totais, renomeação, adição, arquivo/restauração, persistência e limites de coleta. Verifica layout desktop/mobile e acessibilidade automatizada.
- `scripts/account-isolation-check.mjs`: regressão das contas independentes, auth, logout e recuperação após conflito de salvamento, adaptada ao cadastro em etapas.
