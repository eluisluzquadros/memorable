# Contas independentes e saída da sessão

Correção em 18/10/2026.

## Causas

O estado inicial autenticado reutilizava `initialState()` da demonstração. Além dos exemplos, a navegação e a criação de peças dependiam da lista fixa de espaços BBMD. A rota `#auth` só renderizava autenticação sem uma sessão ativa. O logout aguardava o salvamento e desistia em caso de erro; o writer mantinha o erro de forma permanente, impedindo novas tentativas.

## Comportamento corrigido

- Cadastro inicia com uma organização e um espaço próprios, fontes e peças vazias e papel Administrador.
- Lista de espaços, criação de conteúdo, Kanban e configurações usam os espaços da conta. O nome do negócio pode ser alterado nas configurações.
- A demonstração anônima mantém seus exemplos e o armazenamento separado no navegador. O botão de reiniciar a demo não aparece numa conta.
- A página de auth também funciona para quem já está conectado: oferece continuar ou sair para trocar de conta. A landing autenticada exibe conta e saída; a sidebar tem saída real.
- Falhas de salvamento podem ser tentadas novamente. Ao sair após uma falha, a app mantém uma cópia de recuperação por usuário e oferece exportação. Se o armazenamento do navegador falhar, avisa para exportar antes de fechar a página. A sessão só é declarada encerrada após o serviço confirmar a revogação.
- Coletas, histórico e agendamentos no serviço usam proprietário e espaço. Uma conta não lê nem modifica a coleta de outra, mesmo que tente enviar um identificador conhecido.

## Dados existentes

O inicializador do servidor guarda uma cópia do documento anterior em `account_state_backups` antes de migrar estados legados. Apenas estados equivalentes aos exemplos, sem alterações próprias, são substituídos por um espaço vazio. Estados com conteúdo modificado ou campos adicionais são preservados. A cópia é acessível apenas à conta pela API `/api/account/backup`.

O cliente hidrata o documento recebido sem acrescentar fontes da demonstração. A conta Skyvidya foi conferida com um espaço chamado Skyvidya, zero fontes e zero peças. Os exemplos continuam disponíveis na demonstração anônima.

## Verificação

60 testes de domínio/contratos, incluindo criação em espaço próprio, migração conservadora, cópia de estado legado, isolamento e recuperação do writer.

`scripts/account-isolation-check.mjs` testa duas contas novas em navegador isolado: cadastro, fonte própria, alteração de nome, persistência após reload/login, auth autenticada, saída pela landing, erro 409 com exportação de recuperação, rejeição de coleta de outro espaço e preservação da demo. As contas de teste são removidas ao terminar.
