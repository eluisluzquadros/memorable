# Tour guiado — Memorable

Implementado em 14/10/2026.

O tour aparece na primeira entrada na plataforma; não abre na landing page nem na autenticação. Oito etapas apresentam o contexto, a pesquisa, o Radar, a escrita, a aprovação, a agenda e o aprendizado. As telas são as da própria app. Nenhum botão de produção, aprovação ou publicação é acionado pelo tour.

## Controles e persistência

- **Pular tour**, fechar e Escape: interrompem e retornam à tela de origem. Sem a opção permanente, a oferta automática fica suspensa durante a sessão daquele usuário no navegador.
- **Não mostrar automaticamente novamente**: preferência permanente no estado do usuário, inclusive quando uma futura versão do tour for disponibilizada.
- **Concluir tour**: a versão concluída deixa de abrir automaticamente.
- **Tour guiado**, no topo: permite repetir mesmo após concluir ou optar por não exibir automaticamente. Está acessível também no celular e com a sidebar oculta.

A preferência fica em `onboarding.tour`: no SQLite da conta autenticada por meio da persistência de estado já existente; na demonstração, no armazenamento local do navegador. A suspensão temporária usa `sessionStorage` separado pelo identificador da conta ou pela demo.

A tela de origem permanece montada durante a navegação do tour, preservando inclusive campos ainda não salvos. As telas de apresentação são desmontadas ao sair. O tour não modifica fontes, peças, identidade ou permissões. Apenas sua preferência de onboarding é registrada.

## Verificação

`tests/tour.test.mjs`: primeira visita, suspensão temporária, preferência permanente, conclusão, versão e hidratação do estado.

`scripts/tour-check.mjs`: teste em navegador isolado de primeira visita, pular, recarregar, nova sessão, Escape, repetir, voltar/próximo, rotas, concluir, preservar conteúdo e campo de voz não salvo. Inclui navegação por teclado, foco dentro do diálogo, layout mobile e verificação automatizada WCAG no tour.

`scripts/demo-esfera-check.mjs`: a regressão do fluxo de produção suspende o onboarding apenas no contexto isolado do teste, para exercitar a jornada da Esfera independentemente do tour.
