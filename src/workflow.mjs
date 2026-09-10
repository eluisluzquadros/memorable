import podcastData from "./podcast-data.mjs";
export const storageKey = "esteira-demo-v1";
export const workspaces = [
  {
    id: "bbmd",
    name: "BBMD Advogados",
    initials: "BB",
    color: "#214cff",
    voice: "Claro, próximo e responsável",
    audience: "Pessoas buscando informação jurídica",
    budget: 300,
  },
  {
    id: "ativos",
    name: "2B Ativos Judiciais",
    initials: "2B",
    color: "#167154",
    voice: "Objetivo, transparente e consultivo",
    audience: "Titulares de créditos judiciais",
    budget: 200,
  },
  {
    id: "juris",
    name: "2B Juris",
    initials: "2J",
    color: "#7852a5",
    voice: "Técnico, didático e direto",
    audience: "Profissionais do direito",
    budget: 200,
  },
  {
    id: "esfera",
    name: "Esfera Legal",
    initials: "EL",
    color: "#8c5700",
    voice: "Colaborativo e especializado",
    audience: "Escritórios parceiros",
    budget: 200,
  },
  {
    id: "podcast",
    name: "Podcast do grupo",
    initials: "PO",
    color: "#b14d42",
    voice: "Conversacional, curioso e espontâneo",
    audience: "Gestores e empreendedores",
    budget: 150,
  },
  {
    id: "pessoal",
    name: "Marca pessoal",
    initials: "MP",
    color: "#4b6076",
    voice: "Pessoal, seguro e acessível",
    audience: "Comunidade do sócio",
    budget: 150,
  },
];
const sourceText =
  "Conexão vem antes do argumento. A clareza gera vínculo, o vínculo gera segurança.";
export function initialState() {
  const now = new Date();
  const future = new Date(now.getTime() + 86400000 * 2)
    .toISOString()
    .slice(0, 10);
  return {
    version: 1,
    workspace: "bbmd",
    role: "Editor",
    sources: workspaces
      .flatMap((w) => [
        {
          id: `${w.id}-voice`,
          workspace: w.id,
          title: "Guia de voz e critérios editoriais",
          type: "Documento",
          origin: "Material demonstrativo · equipe de marketing",
          url: "",
          text: `Voz: ${w.voice}. Público: ${w.audience}. Priorizar linguagem clara, explicar termos técnicos, preservar contexto e nunca prometer resultados. Todo conteúdo deve passar por revisão humana.`,
          citable: true,
          shared: false,
          date: now.toISOString(),
          feedback: "",
          demo: true,
        },
        ...(w.id === "podcast"
          ? [
              {
                id: "rolim31",
                workspace: "podcast",
                title: "Conexão antes do argumento",
                type: "Podcast",
                origin: "ROLIM TALKS 31 · Lucas Rolim",
                url: "https://youtu.be/m_Juu5wzSYk",
                text: sourceText,
                citable: true,
                shared: true,
                date: now.toISOString(),
                feedback: "",
                demo: false,
              },
            ]
          : []),
      ])
      .concat(podcastData),
    pieces: [
      {
        id: "piece-1",
        workspace: "bbmd",
        title: "Clareza no primeiro atendimento",
        format: "LinkedIn",
        owner: "Carol",
        deadline: future,
        status: "Em revisão",
        body: "Antes de explicar, escute.\n\nUma conversa clara começa pelo que a outra pessoa precisa entender. Trocar termos técnicos por exemplos concretos torna o atendimento mais acessível.\n\nNa sua próxima conversa, experimente perguntar: o que ainda não ficou claro?\n\nBase editorial: ROLIM TALKS 31, Lucas Rolim. Adaptação demonstrativa para revisão.",
        sourceIds: ["rolim31"],
        revision: 1,
        approvedRevision: null,
        approver: null,
        cost: 0.18,
        createdAt: now.toISOString(),
        scheduledAt: null,
        channel: null,
      },
      {
        id: "piece-2",
        workspace: "bbmd",
        title: "O que mudou nas últimas decisões?",
        format: "Carrossel",
        owner: "Lucas",
        deadline: future,
        status: "Em revisão",
        body: "Rascunho demonstrativo: incluir explicação sobre decisões recentes. O material de origem ainda precisa ser anexado e conferido.",
        sourceIds: [],
        revision: 1,
        approvedRevision: null,
        approver: null,
        cost: 0.12,
        createdAt: now.toISOString(),
        scheduledAt: null,
        channel: null,
      },
      {
        id: "piece-3",
        workspace: "bbmd",
        title: "Uma marca, um jeito de conversar",
        format: "Reels",
        owner: "Carol",
        deadline: future,
        status: "Rascunho",
        body: "Cada conversa é uma oportunidade de explicar com clareza. Ajuste a linguagem ao público e mantenha o contexto.",
        sourceIds: ["bbmd-voice"],
        revision: 1,
        approvedRevision: null,
        approver: null,
        cost: 0.09,
        createdAt: now.toISOString(),
        scheduledAt: null,
        channel: null,
      },
    ],
    events: [],
    rules: [],
    budgets: Object.fromEntries(workspaces.map((w) => [w.id, w.budget])),
  };
}
export function accessibleSources(state, workspace) {
  return state.sources.filter((s) => s.workspace === workspace || s.shared);
}
export function blockers(state, piece) {
  const sources = accessibleSources(state, piece.workspace);
  const issues = [];
  if (!piece.body?.trim()) issues.push("Inclua o texto da peça.");
  if (!piece.owner?.trim()) issues.push("Defina um responsável.");
  if (!piece.deadline) issues.push("Defina o prazo.");
  if (!piece.sourceIds?.length)
    issues.push("Vincule ao menos uma fonte antes de enviar à revisão.");
  if (
    piece.sourceIds?.some(
      (id) => !sources.some((s) => s.id === id && s.citable),
    )
  )
    issues.push("Uma fonte vinculada não está disponível ou não é citável.");
  return issues;
}
export function transition(state, pieceId, action, payload = {}) {
  const p = state.pieces.find((x) => x.id === pieceId);
  if (!p) throw new Error("Peça não encontrada.");
  if (p.workspace !== state.workspace)
    throw new Error("A peça pertence a outro espaço.");
  let next = { ...p };
  let event = "";
  if (action === "edit") {
    if (!["Editor", "Administrador"].includes(state.role))
      throw new Error("Use o papel Editor para editar uma peça.");
    if (typeof payload.body !== "string" || !payload.body.trim())
      throw new Error("O texto não pode ficar vazio.");
    next = {
      ...p,
      body: payload.body,
      sourceIds: payload.sourceIds ?? p.sourceIds,
      revision: p.revision + 1,
      status: "Rascunho",
      approvedRevision: null,
      approver: null,
      scheduledAt: null,
      channel: null,
    };
    next.id = p.id;
    next.workspace = p.workspace;
    next.cost = p.cost;
    event = "Texto atualizado; revisão anterior invalidada.";
  } else if (action === "review") {
    if (state.role !== "Editor" && state.role !== "Administrador")
      throw new Error("Entre como Editor para enviar uma peça.");
    const b = blockers(state, p);
    if (b.length) throw new Error(b.join(" "));
    if (p.status !== "Rascunho" && p.status !== "Ajustes")
      throw new Error("A peça já saiu da escrita.");
    next.status = "Em revisão";
    event = "Enviada para revisão humana.";
  } else if (action === "approve") {
    if (!["Aprovador", "Administrador"].includes(state.role))
      throw new Error("Troque para o papel Aprovador para aprovar esta peça.");
    if (p.status !== "Em revisão")
      throw new Error("A peça precisa estar em revisão.");
    const b = blockers(state, p);
    if (b.length) throw new Error(b.join(" "));
    next.status = "Aprovado";
    next.approvedRevision = p.revision;
    next.approver = payload.author || "Beto";
    event = "Aprovada após conferência humana.";
  } else if (action === "reject") {
    if (!["Aprovador", "Administrador"].includes(state.role))
      throw new Error("Troque para o papel Aprovador para solicitar ajustes.");
    if (p.status !== "Em revisão")
      throw new Error("A peça precisa estar em revisão.");
    if (!payload.reason?.trim())
      throw new Error("Explique o ajuste necessário.");
    next.status = "Ajustes";
    next.approvedRevision = null;
    next.approver = null;
    event = `Ajustes solicitados: ${payload.reason.trim()}`;
  } else if (action === "schedule") {
    if (p.status !== "Aprovado" || p.approvedRevision !== p.revision)
      throw new Error("Só a versão aprovada pode entrar na agenda.");
    if (blockers(state, p).length)
      throw new Error("Resolva as pendências das fontes.");
    if (
      !payload.date ||
      new Date(payload.date) <= new Date() ||
      !Number.isFinite(new Date(payload.date).getTime())
    )
      throw new Error("Escolha uma data e hora futuras.");
    if (
      !["Instagram", "LinkedIn", "YouTube", "TikTok", "Facebook"].includes(
        payload.channel,
      )
    )
      throw new Error("Escolha o canal.");
    next.status = "Agendado";
    next.scheduledAt = payload.date;
    next.channel = payload.channel;
    event = `Adicionada à agenda local: ${payload.channel}. Nenhuma publicação externa enviada.`;
  } else throw new Error("Ação inválida.");
  const entry = {
    id: crypto.randomUUID(),
    workspace: p.workspace,
    pieceId: p.id,
    title: p.title,
    action,
    event,
    category: action === "reject" ? payload.category || "Outro" : undefined,
    author: state.role === "Editor" ? "Carol" : "Beto",
    at: new Date().toISOString(),
    revision: next.revision,
    before: action === "edit" ? p.body : undefined,
    after: action === "edit" ? next.body : undefined,
  };
  return {
    ...state,
    pieces: state.pieces.map((x) => (x.id === p.id ? next : x)),
    events: [entry, ...state.events],
  };
}
export function createPiece(state, input) {
  const w = workspaces.find((x) => x.id === state.workspace);
  const spent = state.pieces
    .filter((x) => x.workspace === state.workspace)
    .reduce((s, p) => s + p.cost, 0);
  if (spent + 0.18 > state.budgets[state.workspace])
    throw new Error(
      "O teto estimado deste espaço foi atingido. Ajuste o orçamento para simular uma nova criação.",
    );
  if (!input.title?.trim() || !input.body?.trim())
    throw new Error("Preencha o assunto e o texto.");
  if (
    !input.deadline ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.deadline) ||
    !Number.isFinite(Date.parse(input.deadline))
  )
    throw new Error("Defina um prazo válido para a peça.");
  if (
    !input.sourceIds?.length ||
    input.sourceIds.some(
      (id) =>
        !accessibleSources(state, state.workspace).some(
          (s) => s.id === id && s.citable,
        ),
    )
  )
    throw new Error(
      "Escolha uma fonte citável deste espaço ou da biblioteca compartilhada.",
    );
  if (!["Editor", "Administrador"].includes(state.role))
    throw new Error("Use o papel Editor para criar uma peça.");
  const p = {
    id: crypto.randomUUID(),
    workspace: w.id,
    title: input.title,
    body: input.body,
    format: input.format,
    sourceIds: input.sourceIds,
    owner: input.owner || "Carol",
    deadline: input.deadline,
    status: "Rascunho",
    revision: 1,
    approvedRevision: null,
    approver: null,
    cost: 0.18,
    createdAt: new Date().toISOString(),
    scheduledAt: null,
    channel: null,
  };
  return { ...state, pieces: [p, ...state.pieces] };
}
export function variants(topic, source, format) {
  const context =
    source?.text || "Adicione uma fonte do acervo para orientar o conteúdo.";
  const excerpt = context.slice(0, 320);
  return [
    {
      strategy: "Uma pergunta que aproxima",
      hook: `O que ${topic.toLocaleLowerCase("pt-BR")} muda na sua próxima conversa?`,
      body: `${topic}: por onde começar?\n\n${excerpt}\n\nAntes de seguir, vale uma pergunta: qual parte deste assunto ainda precisa ficar mais clara?`,
    },
    {
      strategy: "Uma ideia, sem rodeios",
      hook: `${topic}. Comece pelo que importa.`,
      body: `${topic}\n\nUma ideia para levar com você:\n${excerpt}\n\nClareza começa quando a mensagem faz sentido para quem está do outro lado.`,
    },
    {
      strategy: "Um convite à reflexão",
      hook: `Nem toda boa conversa começa com uma resposta.`,
      body: `Nem toda boa conversa começa com uma resposta.\n\nAo falar sobre ${topic.toLocaleLowerCase("pt-BR")}, comece pelo contexto:\n${excerpt}\n\nQue pergunta você faria antes de continuar?`,
    },
  ].map((x) => ({
    ...x,
    body:
      format === "Reels"
        ? `CENA 1 · ABERTURA\n${x.hook}\n\nCENA 2 · CONTEXTO\n${excerpt}\n\nCENA 3 · FECHAMENTO\nQue parte desta conversa merece continuar?`
        : format === "Carrossel"
          ? `TELA 1\n${x.hook}\n\nTELA 2\n${excerpt}\n\nTELA 3\nSalve esta ideia para a sua próxima conversa.`
          : x.body,
  }));
}
