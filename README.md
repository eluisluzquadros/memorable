# Esteira · MVP de apresentação

Plataforma de operação de conteúdo com identidade independente, construída para demonstrar ao Grupo BBMD tanto adoção por assinatura/licenças quanto parceria estratégica. Aplicação React + Vite, em português, com persistência local no navegador.

## Executar

```sh
npm install
npm run dev
```

Abra a URL exibida. A apresentação está em `/`; a demonstração em `/#app/painel`. `npm run build` gera a versão estática em `dist`. `npm test` verifica as regras centrais de negócio. Os scripts de navegador usam o Chrome instalado no Windows.

## Roteiro de apresentação (5–7 minutos)

1. Na landing, explore os cinco verbos e os modelos Assinatura e Parceria.
2. Abra a demo. Selecione **Guardar**, abra **Conexão antes do argumento** e escolha **Criar a partir daqui**.
3. Defina o assunto, formato, fonte, responsável e prazo. Explore três abordagens, edite uma e salve o rascunho.
4. No detalhe da peça, envie para revisão. Feche e troque o papel no topo para **Aprovador**.
5. Em **Aprovar**, confira o texto e as fontes, marque a conferência e aprove a versão. A peça sem fonte ilustra um bloqueio real.
6. Defina uma data futura. Em **Publicar**, confira a agenda e exporte o texto.
7. Abra **Caderno de decisões** e exporte o histórico. Edite a peça como Editor para mostrar a invalidação da aprovação e o cancelamento da agenda.
8. No espaço **Podcast do grupo**, consulte os 31 episódios do acervo fornecido. Resumos, autoria e links são reais; as peças e custos iniciais são demonstrações.

## O que funciona nesta entrega

- Seis espaços de marca, com acervos e peças filtrados, biblioteca compartilhada explícita e perfis de voz.
- Acervo pesquisável por texto, detalhe, origem, marcação de resultado, importação TXT/MD e inclusão manual.
- Radar demonstrativo explicável e conversão de oportunidade em briefing.
- Três abordagens locais por formato, edição, fontes, responsável e prazo.
- Revisão por papel demonstrativo; aprovação vinculada à versão; rejeição com critério e justificativa; histórico antes/depois.
- Agenda local somente para a versão aprovada, exportação TXT/CSV/JSON, persistência após recarregar e reinicialização confirmada.
- Métricas derivadas do estado, custo estimado por peça aprovada e teto por marca que bloqueia criação sem bloquear revisão.
- Layouts desktop/mobile, fontes hospedadas com o produto e movimento reduzido.

## Limites da demonstração

Não há servidor de dados, autenticação real, controle de acesso seguro, cobrança, geração de IA externa, busca semântica, varredura de redes nem publicação externa. A troca de papéis ilustra o processo. Dados pertencem a este navegador; não são sincronizados entre usuários. A agenda não executa posts. Custos são ilustrativos, sem chamadas ou cobranças. Nenhum selo de conformidade jurídica é prometido. O revisor humano verifica fatos, contexto e critérios.

## Próxima implantação

Definir o modelo comercial e o piloto; confirmar aprovadores e marca do podcast; configurar identidade e permissões com autenticação individual; conectar o repositório oficial, provedor de IA e canais; implementar banco, filas, rastreabilidade e testes de autorização no servidor. Medir a linha de base antes de afirmar redução de tempo ou crescimento de produção.

O nome **Esteira** é provisório, preservado dos MVPs. A direção visual e o método de revisão estão em `DESIGN.md` e `docs/BRIEF.md`. Os materiais originais permanecem em `../mvp`.
