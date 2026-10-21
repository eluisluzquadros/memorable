# DNA de marcas em sites dinâmicos

## Problema e correção

O site https://www.skyvidya.org/ entrega inicialmente uma estrutura HTML sem o conteúdo da aplicação. A leitura anterior removia JavaScript e apresentava uma proposta quase vazia como resultado de uma extração.

A extração agora tenta HTML/CSS primeiro. Quando não há títulos ou texto suficiente, monta a página em uma instância isolada do Chrome e coleta texto visível e estilos calculados. Propostas sem conteúdo suficiente são rejeitadas; resultados parciais aparecem sinalizados. A documentação explícita continua tendo prioridade.

A interface mostra o método, quantidade de texto, fontes, trecho extraído e evidências por campo. Voz, público e composição inferidos são sugestões heurísticas para revisão, sem alegação de análise por IA. Aplicar o DNA continua sendo uma decisão explícita da equipe. A leitura pode ser cancelada e respostas pendentes são descartadas ao trocar de marca.

## Rede e limites

O navegador não recebe cookies da conta nem credenciais do usuário. As requisições são interceptadas e passam pelo leitor de endereços públicos, com resolução DNS fixada e redirecionamentos revalidados. Requisições de escrita, WebSocket, EventSource, service workers, imagens, fontes remotas e rastreadores conhecidos são bloqueados. Há limites de tempo, quantidade e tamanho dos recursos.

As famílias tipográficas são as declaradas nos estilos de elementos visíveis; isso não confirma o carregamento dos arquivos remotos de fontes. Imagens, animações e páginas internas não são analisadas. Sites que exigem login ou bloqueiam a leitura podem continuar indisponíveis, com erro explícito.

## Validação

- `npm test`: testes de renderização real em fixture JavaScript, bloqueio de rede privada/escrita, prioridade da documentação, recusa de estruturas vazias e ausência de execução de scripts em páginas estáticas legíveis.
- `npm run build`: compilação de produção.
- `node scripts/brand-check.mjs`: documentação, revisão, aplicação, persistência, responsividade e acessibilidade.
- `node scripts/skyvidya-dna-check.mjs`: site real, aprovação, persistência, integração com a voz, cancelamento, troca de marca, erro de serviço, telas desktop/mobile e acessibilidade. Usa contexto de demonstração isolado e não altera a conta do usuário.

Resultado público observado em 18/10/2026: 8.796 caracteres, Inter Tight nos títulos/texto, cor de ação `#ff5c2e` e fundo `#e9e3d5`. Evidência em `qa/skyvidya-dna-result.json` e capturas `qa/skyvidya-dna-desktop.png` e `qa/skyvidya-dna-mobile.png`. O conteúdo do site pode mudar.
