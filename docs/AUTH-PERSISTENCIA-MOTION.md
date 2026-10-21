# Autenticação, persistência e apresentação

Atualizado em 15/09/2026.

## Dois modos explícitos

- Sem conta: demonstração com dados editoriais em `localStorage`, preservando o acervo já existente neste navegador.
- Com conta: cadastro/login em `/#auth`; estado editorial salvo por usuário em `.runtime/skyvidya.sqlite`. A demonstração não é importada automaticamente para uma conta.

O serviço depende de Node com `node:sqlite` (verificado com Node 24). `npm run dev:full` executa interface e API. O diretório `.runtime` está fora do Git; deve ser incluído no backup local. Para uma cópia simples consistente, pare o serviço e copie o diretório completo, incluindo os arquivos auxiliares SQLite caso presentes.

## Implementação

Tabelas `users`, `sessions` e `account_state`. Senhas passam por scrypt com salt individual. Cookies de sessão são HttpOnly e SameSite=Strict, com expiração em sete dias; o banco guarda somente o hash do token. Logout revoga a sessão. A API verifica sessão e identidade da conta antes de ler/gravar seu estado. Revisões impedem que outra aba sobrescreva uma versão mais recente sem aviso. A interface mostra quando o salvamento terminou.

O documento editorial é salvo como JSON versionado por conta nesta primeira etapa. Não é ainda um esquema relacional de campanhas, peças e fontes. O adaptador em `server/accounts.mjs` separa persistência da interface, mas uma migração para Supabase ainda exigirá schema, políticas de acesso, migração de dados e troca do provedor de identidade — não é apenas alterar uma URL.

## Limites que permanecem

A aplicação é local. Cookie Secure/HTTPS, verificação e recuperação de e-mail, convites e permissões organizacionais precisam ser implementados antes de disponibilização pública. A troca de papéis editoriais continua sendo demonstrativa dentro da conta. Coleta e rotinas ainda usam o arquivo local compartilhado `monitoring.json`; a autenticação não tornou todas as APIs do protótipo multitenant. Não apresentar esta versão como SaaS multiusuário pronto.

## Landing

Posicionamento principal: automatizar a produção de conteúdo para empreendedores, criadores e times de marketing. Múltiplas marcas são capacidade adicional. A FAQ diferencia demonstração local, IA configurada e publicação externa dependente de integração.

A seção de scroll usa posição nativa da página para conduzir camadas de documentos e quatro capítulos. Não usa vídeo gerado nem bloqueia a rolagem. Celular e preferência por movimento reduzido recebem conteúdo estático legível. Os princípios de narrativa contínua e profundidade foram estudados em [Scroll World](https://github.com/oso95/scroll-world), [Scroll Craft](https://github.com/nateherkai/scroll-craft) e [Impeccable](https://impeccable.style/); o motor foi implementado no projeto, sem copiar seus engines nem instalar dependências de geração paga.

## Verificação

23 testes de regras incluem autenticação, sessão, isolamento de estado e conflito de revisão. `scripts/auth-motion-check.mjs` valida cadastro/login/logout, persistência após reload, acesso sem sessão recusado, quatro estados do scroll e fallback de movimento reduzido. Conta de teste temporária é removida ao terminar. A tela de autenticação foi verificada em desktop e celular com axe. A inspeção geral anterior à última adição da FAQ retornou zero violações em 24 superfícies.
