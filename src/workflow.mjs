import { workspaces } from './demo-workspaces.mjs';
import podcastData from "./podcast-data.mjs";
import { relationships, propagateChange } from "./strategy.mjs";
import {
  hydrateOperations,
  sourceValid,
  councilGate,
  assertEditor,
  safeUrl,
} from "./operations.mjs";
export const storageKey = "esteira-demo-v1";
export { workspaces } from './demo-workspaces.mjs';
const sourceText =
  "Conexão vem antes do argumento. A clareza gera vínculo, o vínculo gera segurança.";
export function initialState() {
  const now = new Date();
  const future = new Date(now.getTime() + 86400000 * 2)
    .toISOString()
    .slice(0, 10);
  return hydrateOperations(
    {
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
          owner: "Editor",
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
          owner: "Editor",
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
          owner: "Editor",
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
    },
    workspaces,
  );
}
export function accessibleSources(state, workspace) {
  return state.sources.filter((s) => s.workspace === workspace || s.shared);
}
export function blockers(state, piece) {
  const sources = accessibleSources(state, piece.workspace);
  const issues = [];
  if (piece.lineageReview) issues.push("Confira o conteúdo de origem antes de revisar este desdobramento.");
  if (!piece.body?.trim()) issues.push("Inclua o texto da peça.");
  if (!piece.owner?.trim()) issues.push("Defina um responsável.");
  if (!piece.deadline) issues.push("Defina o prazo.");
  if (!piece.sourceIds?.length)
    issues.push("Vincule ao menos uma fonte antes de enviar à revisão.");
  if (
    piece.sourceIds?.some(
      (id) => !sources.some((s) => s.id === id && sourceValid(s)),
    )
  )
    issues.push("Uma fonte vinculada não está disponível ou não é citável.");
  return issues;
}
export const WRITING_STAGES = ["Pedido", "Pauta escolhida", "Rascunho", "Em conferência", "Ajustes"];
// The board shows six working moments; finer statuses stay in the data and appear as card labels.
export const BOARD_COLUMNS = [
  { name: "Ideias", statuses: ["Pedido", "Pauta escolhida"], target: "Pauta escolhida" },
  { name: "Escrevendo", statuses: ["Rascunho", "Em conferência", "Ajustes"], target: "Rascunho" },
  { name: "Em aprovação", statuses: ["Em revisão"], target: "Em revisão" },
  { name: "Aprovado", statuses: ["Aprovado"], target: "Aprovado" },
  { name: "Agendado", statuses: ["Agendado"], target: "Agendado" },
  { name: "Publicado", statuses: ["Publicado"], target: "Publicado" },
];
export const boardColumn = (status) => BOARD_COLUMNS.find((c) => c.statuses.includes(status)) || BOARD_COLUMNS[1];
export const STATUS_DETAIL = { Pedido: "Sem fonte ainda", "Em conferência": "Checado pelo conselho", Ajustes: "Ajustes pedidos pelo aprovador" };
const assertWriter = (state) => {
  if (!["Editor", "Administrador"].includes(state.role))
    throw new Error("Use o papel Editor para movimentar peças.");
};

// Translates a Kanban drop into the workflow action it means, so dragging never skips a rule.
export function planKanbanMove(state, pieceId, target) {
  const p = state.pieces.find((x) => x.id === pieceId);
  if (!p) throw new Error("Peça não encontrada.");
  if (p.status === target) return { kind: "none" };
  if (p.status === "Publicado")
    throw new Error("Peça publicada não volta de etapa: o registro de publicação é definitivo.");
  if (WRITING_STAGES.includes(target)) {
    if (WRITING_STAGES.includes(p.status)) return { kind: "apply", action: "move", payload: { status: target } };
    if (p.status === "Em revisão")
      return target === "Ajustes" ? { kind: "needs", need: "reason" } : { kind: "apply", action: "retract", payload: { status: target } };
    return {
      kind: "confirm",
      action: "reopen",
      payload: { status: target },
      message: `Voltar "${p.title}" para ${target} desfaz a aprovação${p.status === "Agendado" ? " e cancela o agendamento" : ""}. A peça precisará de nova revisão.`,
    };
  }
  if (target === "Em revisão") {
    if (WRITING_STAGES.includes(p.status)) return { kind: "apply", action: "review" };
    throw new Error("Para revisar de novo, volte a peça para a escrita primeiro.");
  }
  if (target === "Aprovado") {
    if (p.status === "Em revisão") return { kind: "apply", action: "approve" };
    if (p.status === "Agendado") return { kind: "apply", action: "unschedule" };
    throw new Error("Só uma peça em revisão pode ser aprovada.");
  }
  if (target === "Agendado") {
    if (p.status === "Aprovado") return { kind: "needs", need: "schedule" };
    throw new Error("Só a versão aprovada pode entrar na agenda.");
  }
  if (target === "Publicado") {
    if (["Aprovado", "Agendado"].includes(p.status)) return { kind: "needs", need: "publish" };
    throw new Error("Só uma versão aprovada pode ser registrada como publicada.");
  }
  throw new Error("Etapa desconhecida.");
}

// Deleting keeps the audit trail: the event log records who removed what, and cases lose the reference.
export function removePiece(state, pieceId) {
  assertWriter(state);
  const p = state.pieces.find((x) => x.id === pieceId);
  if (!p || p.workspace !== state.workspace) throw new Error("Peça não encontrada neste espaço.");
  if (p.status === "Publicado")
    throw new Error("Peças publicadas não são excluídas: o registro de publicação faz parte do histórico.");
  if (state.pieces.some((x) => x.parentId === p.id))
    throw new Error("Esta peça tem desdobramentos. Exclua ou desvincule os desdobramentos primeiro.");
  return {
    ...state,
    pieces: state.pieces.filter((x) => x.id !== p.id),
    cases: (state.cases || []).map((c) => ({ ...c, pieceIds: c.pieceIds.filter((id) => id !== p.id) })),
    writingQueue: (state.writingQueue || []).filter((q) => q.pieceId !== p.id),
    events: [
      { id: crypto.randomUUID(), workspace: p.workspace, pieceId: p.id, title: p.title, action: "delete", event: `Peça excluída na etapa ${p.status}.`, author: state.role, at: new Date().toISOString(), revision: p.revision },
      ...state.events,
    ],
  };
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
      council: null,
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
    if (!["Rascunho", "Ajustes", "Em conferência"].includes(p.status))
      throw new Error("A peça já saiu da escrita.");
    if (state.schemaRevision >= 2) councilGate(state, p);
    next.status = "Em revisão";
    event = "Enviada para revisão humana.";
  } else if (action === "approve") {
    if (!["Aprovador", "Administrador"].includes(state.role))
      throw new Error("Troque para o papel Aprovador para aprovar esta peça.");
    if (p.status !== "Em revisão")
      throw new Error("A peça precisa estar em revisão.");
    const b = blockers(state, p);
    if (b.length) throw new Error(b.join(" "));
    if (state.schemaRevision >= 2) councilGate(state, p);
    next.status = "Aprovado";
    next.sourceReview = false;
    next.approvedRevision = p.revision;
    next.approver = payload.author || "Aprovador";
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
    if (state.role === "Observador")
      throw new Error("Observadores não podem agendar conteúdos.");
    if (p.status !== "Aprovado" || p.approvedRevision !== p.revision)
      throw new Error("Só a versão aprovada pode entrar na agenda.");
    if (blockers(state, p).length)
      throw new Error("Resolva as pendências das fontes.");
    if (state.schemaRevision >= 2) councilGate(state, p);
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
  } else if (action === "unschedule") {
    assertEditor(state);
    if (p.status !== "Agendado")
      throw new Error("Esta peça não está agendada.");
    next = { ...p, status: "Aprovado", scheduledAt: null, channel: null };
    event =
      "Agendamento local cancelado. A aprovação da versão foi preservada.";
  } else if (action === "publish") {
    assertEditor(state);
    if (blockers(state, p).length) throw new Error("Resolva as pendências antes de registrar a publicação.");
    if (state.schemaRevision >= 2) councilGate(state, p);
    if (
      !["Agendado", "Aprovado"].includes(p.status) ||
      p.approvedRevision !== p.revision
    )
      throw new Error(
        "Somente uma versão aprovada pode receber comprovante de publicação.",
      );
    next = {
      ...p,
      status: "Publicado",
      liveUrl: safeUrl(payload.url),
      publishedAt: new Date().toISOString(),
    };
    event =
      "Publicação externa registrada manualmente com URL. Nenhum envio automático realizado.";
  } else if (action === "move") {
    assertWriter(state);
    if (!WRITING_STAGES.includes(p.status) || !WRITING_STAGES.includes(payload.status))
      throw new Error("Movimento livre só entre as etapas de escrita.");
    next.status = payload.status;
    event = `Movida de ${p.status} para ${payload.status}.`;
  } else if (action === "retract") {
    assertWriter(state);
    if (p.status !== "Em revisão" || !WRITING_STAGES.includes(payload.status))
      throw new Error("Só uma peça em revisão pode ser recolhida para a escrita.");
    next.status = payload.status;
    event = `Recolhida da revisão para ${payload.status}.`;
  } else if (action === "reopen") {
    assertWriter(state);
    if (!["Aprovado", "Agendado"].includes(p.status) || !WRITING_STAGES.includes(payload.status))
      throw new Error("Só peças aprovadas ou agendadas podem ser reabertas.");
    next = { ...p, status: payload.status, approvedRevision: null, approver: null, scheduledAt: null, channel: null };
    event = `Reaberta para ${payload.status}: aprovação ${p.status === "Agendado" ? "e agendamento desfeitos" : "desfeita"}.`;
  } else throw new Error("Ação inválida.");
  next.stageAt = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    workspace: p.workspace,
    pieceId: p.id,
    title: p.title,
    action,
    event,
    category: action === "reject" ? payload.category || "Outro" : undefined,
    author: state.role === "Editor" ? "Editor" : "Aprovador",
    at: new Date().toISOString(),
    revision: next.revision,
    before: action === "edit" ? p.body : undefined,
    after: action === "edit" ? next.body : undefined,
  };
  return {
    ...state,
    pieces: action === "edit" ? propagateChange(state.pieces.map((x) => (x.id === p.id ? next : x)), p.id) : state.pieces.map((x) => (x.id === p.id ? next : x)),
    events: [entry, ...state.events],
  };
}
export function createPiece(state, input) {
  const w = (state.workspaces || workspaces).find((x) => x.id === state.workspace);
  if(!w || w.archived) throw new Error('Espaço de trabalho indisponível. Recarregue sua conta.');
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
          (s) => s.id === id && sourceValid(s),
        ),
    )
  )
    throw new Error(
      "Escolha uma fonte citável deste espaço ou da biblioteca compartilhada.",
    );
  if (!["Editor", "Administrador"].includes(state.role))
    throw new Error("Use o papel Editor para criar uma peça.");
  const p = {
    ...relationships(state, input),
    id: crypto.randomUUID(),
    workspace: w.id,
    title: input.title,
    body: input.body,
    format: input.format,
    sourceIds: input.sourceIds,
    owner: input.owner || "Editor",
    deadline: input.deadline,
    status: "Rascunho",
    revision: 1,
    approvedRevision: null,
    approver: null,
    cost: 0.18,
    createdAt: new Date().toISOString(),
    scheduledAt: null,
    channel: null,
    topicId: input.topicId,
    delivery: input.delivery,
    brief: input.brief,
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
