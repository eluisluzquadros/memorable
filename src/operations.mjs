import {workspaces as demoSpaces} from './demo-workspaces.mjs';
import { brandTone } from './brand-tones.mjs';
import { editorialIssues, EDITORIAL_STANDARD } from './editorial-quality.mjs';
import { localVariants } from './local-scaffold.mjs';
import { invalidateSourceDependents } from './strategy.mjs';
import { productionSettings, timelineFor, scriptBody, scriptTiming, videoProductionPlan } from './production.mjs';
export const SOURCE_ROLES = [['reference', 'Referência externa'], ['owned', 'Conteúdo oficial da marca'], ['product', 'Produto ou solução própria'], ['competitor', 'Concorrente / benchmark']];
export const strategicSource = source => ['owned', 'product'].includes(source?.editorialRole);
export const AGENTS = [
  {
    id: "trend",
    name: "Trend Hunter / Cool Hunter",
    phase: 1,
    role: "Pesquisa de tendências",
    output: "Sinais, fontes e oportunidades verificáveis",
  },
  {
    id: "planner",
    name: "Content Planner",
    phase: 1,
    role: "Estratégia de conteúdo",
    output: "Tese, público, objetivo e prioridade",
  },
  {
    id: "copy",
    name: "Copywriter / Ghostwriter",
    phase: 2,
    role: "Copy & roteiro",
    output: "Uma versão por padrão; até três estratégias opcionais, com contribuição própria",
  },
  {
    id: "visual",
    name: "Visual Creator",
    phase: 2,
    role: "Direção visual",
    output: "Referências de marca, ativos consistentes e prefixo visual comum",
  },
  {
    id: "av",
    name: "AV Producer",
    phase: 2,
    role: "Áudio e vídeo",
    output: "Lista de cenas com tempo, continuidade, áudio e plano de teste",
  },
  {
    id: "seo",
    name: "SEO/GEO & Metadata Analyst",
    phase: 3,
    role: "Descoberta e acessibilidade",
    output: "Título, descrição, entidades, tags e texto alternativo",
  },
  {
    id: "compliance",
    name: "Compliance & Brand Safety",
    phase: 4,
    role: "Qualidade e critérios éticos",
    output: "Pendências de fonte, privacidade e critérios da marca",
  },
  {
    id: "publisher",
    name: "Social Media Publisher",
    phase: 4,
    role: "Agendamento e publicação",
    output: "Pacote por canal; envio depende de aprovação humana e conexão",
  },
];
export const FORMATS = [
  "Roteiro de vídeo",
  "LinkedIn",
  "Reels",
  "Carrossel",
  "Legenda Instagram",
  "Corte de podcast",
  "Podcast completo",
  "Artigo",
  "Newsletter",
  "Anúncio UGC",
  "Vídeo de produto",
  "Comercial",
  "Fotos de produto",
  "Fotos de imóvel e tour",
  "Site para negócio local",
  "Vídeo faceless YouTube",
  "Thumbnail",
  "Produto digital",
];
export const STAGES = [
  "Pedido",
  "Pauta escolhida",
  "Rascunho",
  "Em conferência",
  "Em revisão",
  "Ajustes",
  "Aprovado",
  "Agendado",
  "Publicado",
];
export const DEFAULT_RADAR = {
  weights: { relevance: 40, novelty: 30, brandFit: 30 },
  threshold: 7,
  enabled: false,
  frequency: "daily",
  minutes: 60,
  time: "09:00",
  weekdays: [1],
  monthDay: 1,
  lastRun: null,
  nextRun: null,
  notifyHot: true,
  scope: "workspace",
};
export const sourceCaptureProblem = (s) => {
  const value = `${s?.title || ""} ${s?.text || ""}`.toLowerCase();
  if (s?.captureStatus === "login-wall") return "A rede devolveu somente uma tela de login.";
  if (/instagram photos and videos/.test(value) && /\b(log in|sign up|posts|reels|tagged)\b/.test(value))
    return "A rede devolveu somente metadados de login, não o conteúdo publicado.";
  return "";
};
export const sourceValid = (s, now = new Date()) =>
  Boolean(
    s?.citable &&
    s.text?.trim() &&
    !sourceCaptureProblem(s) &&
    (!s.validUntil || new Date(s.validUntil + "T23:59:59") >= now),
  );
export function sourceFingerprint(sources) {
  const raw = sources
    .map((s) =>
      JSON.stringify([
        s.id,
        s.text,
        s.origin,
        s.validUntil,
        s.citable,
        s.shared,
      ]),
    )
    .sort()
    .join("|");
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++)
    hash = Math.imul(hash ^ raw.charCodeAt(i), 16777619);
  return raw.length + ":" + (hash >>> 0).toString(16);
}
export function mergeCollection(state, data) {
  const received = data.sources.map(source => {
    const previous = state.sources.find(s => s.id === source.id || s.collectionId === source.id || (s.workspace===source.workspace && s.url && source.url && safeUrl(s.url)===safeUrl(source.url)));
    if (!previous) return source;
    const metadata = {editorialRole:previous.editorialRole,tags:previous.tags,shared:previous.shared,validUntil:previous.validUntil,whySaved:previous.whySaved,pattern:previous.pattern};
    const overrides = previous.manualOverride ? Object.fromEntries(['title','url','type','text','origin','citable','transcript','summary','keywords','extraction','manualOverride'].map(key=>[key,previous[key]])) : {};
    return {...previous,...source,id:previous.id,collectionId:source.id,title:previous.title,origin:previous.origin||source.origin,...metadata,...overrides};
  });
  const changed = new Set(
    received
      .filter((s) =>
        state.sources.some(
          (old) =>
            old.id === s.id &&
            sourceFingerprint([old]) !== sourceFingerprint([s]),
        ),
      )
      .map((s) => s.id),
  );
  return {
    ...state,
    sources: [
      ...received,
      ...state.sources.filter((s) => !received.some((n) => n.id === s.id)),
    ],
    pieces: invalidateSourceDependents(state.pieces, changed),
    radarRuns: [
      ...(data.runs || []),
      ...state.radarRuns.filter(
        (r) => !(data.runs || []).some((n) => n.id === r.id),
      ),
    ].slice(0, 200),
  };
}
const clean = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function hydrateOperations(state, spaces) {
  return {
    ...state,
    ...(Array.isArray(state.workspaces) ? { workspaces: state.workspaces.map((w, i) => ({ ...w, color: brandTone(w.color, i) })) } : {}),
    schemaRevision: 2,
    writingQueue: state.writingQueue || [],
    monitors: state.monitors || [],
    radarItems: state.radarItems || [],
    radarRuns: state.radarRuns || [],
    executions: state.executions || [],
    outcomes: state.outcomes || [],
    campaigns: state.campaigns || [],
    cases: state.cases || [],
    radar: Object.fromEntries(
      spaces.map((w) => [
        w.id,
        {
          ...DEFAULT_RADAR,
          ...state.radar?.[w.id],
          weights: {
            ...DEFAULT_RADAR.weights,
            ...state.radar?.[w.id]?.weights,
          },
        },
      ]),
    ),
    voices: Object.fromEntries(
      spaces.map((w) => [
        w.id,
        {
          tone: w.voice,
          audience: w.audience,
          positioning: "Informação clara com contexto e responsabilidade.",
          pillars: "Educação\nDúvidas do público\nBastidores e conhecimento",
          say: "Explique com exemplos concretos.",
          avoid: "resultado garantido\nganhe sua causa\no melhor do mercado",
          examples: "",
          checklist:
            "Conferir fontes\nPreservar privacidade\nRevisar adequação à marca",
          ...state.voices?.[w.id],
        },
      ]),
    ),
    agentConfig: {
      threshold: 4,
      maxRounds: 3,
      mode: "local",
      ...state.agentConfig,
    },
  };
}
export function assertEditor(state) {
  if (!["Editor", "Administrador"].includes(state.role))
    throw new Error(
      "Use o papel Editor ou Administrador para alterar a operação.",
    );
}
export function assertAdmin(state) {
  if (state.role !== "Administrador")
    throw new Error("Esta configuração exige o papel Administrador.");
}
export function safeUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Informe uma URL completa, começando por https://.");
  }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
    throw new Error("Use uma URL http(s) sem credenciais.");
  u.hash = "";
  return u.href;
}
export function saveMonitor(state, input) {
  assertEditor(state);
  const url = safeUrl(input.url.trim());
  if (!input.name?.trim()) throw new Error("Dê um nome à fonte monitorada.");
  if (
    !["Próprio", "Concorrente", "Referência", "Pesquisa aberta"].includes(
      input.category,
    )
  )
    throw new Error("Selecione uma categoria válida.");
  if (
    state.monitors.some(
      (m) =>
        m.workspace === state.workspace && m.url === url && m.id !== input.id,
    )
  )
    throw new Error("Esta URL já está cadastrada nesta marca.");
  if (
    input.id &&
    !state.monitors.some(
      (m) => m.id === input.id && m.workspace === state.workspace,
    )
  )
    throw new Error("Fonte não encontrada nesta marca.");
  const item = {
    id: input.id || crypto.randomUUID(),
    workspace: state.workspace,
    name: input.name.trim(),
    url,
    category: input.category,
    kind: input.kind || "Site",
    mode: input.mode === "channel" ? "channel" : "page",
    notes: input.notes || "",
    active: input.active !== false,
  };
  return {
    ...state,
    monitors: [item, ...state.monitors.filter((m) => m.id !== item.id)],
  };
}
export function validateRadar(config) {
  const values = Object.values(config.weights).map(Number);
  if (
    values.length !== 3 ||
    values.some((v) => !Number.isFinite(v) || v < 0 || v > 100) ||
    Math.abs(values.reduce((a, b) => a + b, 0) - 100) > 0.001
  )
    throw new Error("Os três pesos devem somar 100%.");
  if (
    !Number.isFinite(+config.threshold) ||
    +config.threshold < 0 ||
    +config.threshold > 10
  )
    throw new Error("A nota mínima deve estar entre 0 e 10.");
  if (!["minutes", "daily", "weekly", "monthly"].includes(config.frequency))
    throw new Error("Escolha uma frequência válida.");
  if (
    !Number.isInteger(+config.minutes) ||
    +config.minutes < 5 ||
    +config.minutes > 43200
  )
    throw new Error("O intervalo deve ser de 5 a 43.200 minutos.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.time))
    throw new Error("Escolha um horário válido.");
  if (
    config.frequency === "weekly" &&
    (!config.weekdays?.length ||
      config.weekdays.some((n) => !Number.isInteger(+n) || +n < 0 || +n > 6))
  )
    throw new Error("Selecione ao menos um dia da semana.");
  if (
    !Number.isInteger(+config.monthDay) ||
    +config.monthDay < 1 ||
    +config.monthDay > 28
  )
    throw new Error("Escolha um dia do mês entre 1 e 28.");
  return config;
}
export function nextRadarRun(config, from = new Date()) {
  validateRadar(config);
  const d = new Date(from);
  if (config.frequency === "minutes")
    return new Date(+d + Number(config.minutes) * 60000).toISOString();
  const [h, m] = config.time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  if (config.frequency === "daily") {
    if (d <= from) d.setDate(d.getDate() + 1);
  }
  if (config.frequency === "weekly") {
    for (
      let i = 0;
      i < 8 && (d <= from || !config.weekdays.map(Number).includes(d.getDay()));
      i++
    )
      d.setDate(d.getDate() + 1);
  }
  if (config.frequency === "monthly") {
    d.setDate(Number(config.monthDay));
    if (d <= from) d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString();
}
export function radarScore(breakdown, weights) {
  return Number(
    ["relevance", "novelty", "brandFit"]
      .reduce(
        (sum, k) =>
          sum +
          (Math.max(0, Math.min(10, Number(breakdown[k]) || 0)) *
            Number(weights[k])) /
            100,
        0,
      )
      .toFixed(1),
  );
}
export function rankedTopics(state, workspace = state.workspace) {
  const voice = state.voices[workspace];
  const terms = [...new Set(clean([voice.pillars, voice.audience, voice.positioning, ...(state.sources.filter(s => s.workspace === workspace && strategicSource(s)).flatMap(s => [s.title, ...(s.keywords || [])]))].join(' '))
    .split(/\W+/)
    .filter((t) => t.length > 4))];
  const sources = state.sources.filter(
    (s) =>
      (s.workspace === workspace || s.shared) &&
      sourceValid(s) &&
      !s.id.endsWith("-voice"),
  );
  const stored = state.radarItems.filter((t) => t.workspace === workspace && (!t.sourceFingerprint || t.sourceFingerprint === sourceFingerprint(state.sources.filter(s => s.id === t.sourceId))));
  const items = [
    ...stored,
    ...sources
      .filter((s) => !stored.some((t) => t.sourceId === s.id))
      .map((s) => {
        // Ingestion time is not publication time: an evergreen page is not a new trend.
        const publishedAge = s.publishedAt ? (Date.now() - new Date(s.publishedAt).getTime()) / 86400000 : null;
        const matches = terms.filter((t) =>
          clean(s.title + " " + s.text).includes(t),
        ).length;
        return {
          id: `acervo-${workspace}-${s.id}`,
          workspace,
          title: s.title,
          sourceId: s.id,
          category: s.category || "Acervo próprio",
          date: s.date,
          reason:
            "Sugestão de reaproveitamento. O sinal usa palavras da ficha de voz; não mede a qualidade do produto ou seu potencial de mercado.",
          breakdown: {
            relevance: Math.min(10, 6 + matches),
            novelty: publishedAge === null ? 5 : publishedAge < 7 ? 8 : publishedAge < 90 ? 6 : 4,
            brandFit: Math.min(10, 6 + matches),
            risk: 0,
          },
        };
      }),
  ];
  return items
    .map((t) => {
      const duplicate = state.pieces.find(
        (p) =>
          p.workspace === workspace &&
          (p.topicId === t.id || clean(p.title) === clean(t.title)) &&
          Date.now() - new Date(p.createdAt).getTime() < 60 * 86400000,
      );
      return {
        ...t,
        strategic: strategicSource(state.sources.find(s => s.id === t.sourceId)),
        editorialRole: state.sources.find(s => s.id === t.sourceId)?.editorialRole || 'reference',
        score: radarScore(t.breakdown, state.radar[workspace].weights),
        duplicate,
        blocked:
          !state.sources.some(
            (s) =>
              s.id === t.sourceId &&
              (s.workspace === workspace || s.shared) &&
              sourceValid(s),
          ) || t.breakdown.risk >= 8,
      };
    })
    .sort((a, b) => Number(a.blocked) - Number(b.blocked) || Number(b.strategic) - Number(a.strategic) || b.score - a.score || a.title.localeCompare(b.title));
}
export function runLocalRadar(
  state,
  workspace = state.workspace,
  scheduled = false,
) {
  const now = new Date().toISOString();
  const config = state.radar[workspace];
  const topics = rankedTopics(state, workspace);
  const run = {
    id: crypto.randomUUID(),
    workspace,
    at: now,
    mode: "local",
    scheduled,
    found: topics.length,
    hot: topics.filter(
      (t) => (t.strategic || t.score >= config.threshold) && !t.duplicate && !t.blocked,
    ).length,
    detail: "Reclassificação do acervo local. Nenhuma URL externa consultada.",
  };
  return {
    ...state,
    radarRuns: [run, ...state.radarRuns].slice(0, 200),
    radar: {
      ...state.radar,
      [workspace]: {
        ...config,
        lastRun: now,
        nextRun: config.enabled ? nextRadarRun(config) : null,
      },
    },
  };
}
// An approved brand DNA is first-party evidence: its positioning and site text may back brand claims.
export function dnaKnowledge(state) {
  const dna = state.brandDNA?.[state.workspace];
  if (!dna?.approvedAt) return [];
  const positioning = typeof dna.positioning === "string" ? dna.positioning : dna.positioning?.value || "";
  const text = [positioning, dna.excerpt || ""].filter(Boolean).join("\n\n").slice(0, 8000);
  if (text.length < 80) return [];
  const site = (dna.sources || []).find((url) => !/fonts\.(googleapis|gstatic)/.test(url)) || "";
  return [{ id: `dna-${state.workspace}`, title: `Site oficial da marca${site ? ` (${site})` : ""} · DNA aprovado`, editorialRole: "owned", summary: positioning, text }];
}
export function contextPacket(state, brief) {
  const ids = brief.sourceIds || [brief.source].filter(Boolean);
  const settings = productionSettings(brief);
  const inspiration = state.sources.find(s => s.id === brief.inspirationId && (s.workspace === state.workspace || s.shared) && sourceValid(s));
  return {
    workspace: state.workspace,
    brand: {name: (state.workspaces||demoSpaces).find(w=>w.id===state.workspace)?.name || brief.brandName || "Sua marca", purpose:"Comunicar a marca do cliente. Fontes externas são evidências, nunca o anunciante."},
    voice: state.voices[state.workspace],
    brandDNA: state.brandDNA?.[state.workspace] || null,
    campaign: (state.campaigns || []).find(c => c.id === brief.campaignId && c.workspace === state.workspace) || null,
    parent: state.pieces.filter(p => p.id === brief.parentId && p.workspace === state.workspace).map(p => ({ id: p.id, title: p.title, revision: p.revision, body: p.body.slice(0, 6000), sourceIds: p.sourceIds }))[0] || null,
    inspiration: inspiration ? {id:inspiration.id,title:inspiration.title,url:inspiration.url,whySaved:inspiration.whySaved || '',pattern:inspiration.pattern || '',excerpt:inspiration.text.slice(0,5000),use:'Referência de estrutura; não é evidência factual sobre a marca.'} : null,
    brandKnowledge: [...dnaKnowledge(state), ...state.sources.filter(s => s.workspace === state.workspace && strategicSource(s) && sourceValid(s)).slice(0,8).map(s=>({id:s.id,title:s.title,editorialRole:s.editorialRole,summary:s.summary,text:s.text.slice(0,5000)}))],
    brief: {
      title: brief.title,
      brandName: (state.workspaces||demoSpaces).find(w=>w.id===state.workspace)?.name || brief.brandName || "Sua marca",
      audience: brief.audience || state.voices[state.workspace].audience,
      objective: brief.objective || "Informar",
      thesis: brief.thesis || brief.title,
      angle: brief.angle || "",
      cta: brief.cta || "Qual dúvida você gostaria de esclarecer?",
      format: brief.format,
      ...settings,
      topicId: brief.topicId,
      deadline: brief.deadline,
      experience: brief.experience || '',
      offer: brief.offer || '',
      inspirationId: inspiration?.id || null,
    },
    sources: state.sources
      .filter(
        (s) =>
          ids.includes(s.id) &&
          (s.workspace === state.workspace || s.shared) &&
          sourceValid(s),
      )
      .map((s) => ({
        id: s.id,
        title: s.title,
        // A colleague's account guides the piece but is not a public record, and its author stays unnamed.
        origin: s.internal ? `Relato interno · ${s.internalArea || 'colaborador'}` : s.origin,
        ...(s.internal ? { usage: 'Relato interno de colaborador: use como ponto de partida e contexto. Não cite o nome de quem relatou nem o apresente como documento público; confirme fatos e números com fonte pública antes de afirmá-los.' } : {}),
        url: s.url,
        editorialRole: s.editorialRole || 'reference',
        summary: s.summary,
        keywords: s.keywords || [],
        whySaved: s.whySaved || '',
        pattern: s.pattern || '',
        text: s.text.slice(0, 24000),
      })),
    lessons: state.rules
      .filter((r) => r.workspace === state.workspace && r.active !== false && (!r.scope || r.scope === 'Todos' || r.scope === brief.format))
      .map((r) => [r.text || r.rule || r.title, r.example ? `Exemplo: ${r.example}` : '', r.exception ? `Exceção: ${r.exception}` : ''].filter(Boolean).join(' · '))
      .filter(Boolean)
      .slice(0, 10),
  };
}
export const productionVariants = localVariants;
export function evaluateCouncil(state, piece) {
  const sourceList = state.sources.filter(
    (s) =>
      piece.sourceIds?.includes(s.id) &&
      (s.workspace === piece.workspace || s.shared),
  );
  const text = piece.body || "";
  const voice = state.voices?.[piece.workspace];
  const prohibited = (voice?.avoid || "")
    .split("\n")
    .filter(Boolean)
    .filter((t) => clean(text).includes(clean(t)));
  const privateData =
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/.test(
      text,
    );
  const valid =
    piece.sourceIds?.length > 0 &&
    sourceList.length === new Set(piece.sourceIds).size &&
    sourceList.every((s) => sourceValid(s));
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const maxLine = Math.max(...text.split("\n").map((l) => l.length), 0);
  let timing=null, durationError='';
  try { const settings=productionSettings({...piece.brief,format:piece.format}); if(settings.video)timing=scriptTiming(text,{...piece.brief,format:piece.format}); } catch(error){durationError=error.message;}
  const issues=editorialIssues({body:text,format:piece.format,brief:piece.brief,brand:{name:state.workspaces?.find(w=>w.id===piece.workspace)?.name},sources:sourceList});
  if(durationError)issues.push({code:'duration',message:durationError});
  const checks = [
    {
      lens: "Primeiros princípios",
      name: "Base e rastreabilidade",
      score: valid ? 5 : 1,
      blocker: !valid,
      reason: valid
        ? "Fontes citáveis, disponíveis e dentro da validade. A veracidade ainda exige conferência humana."
        : "Fonte ausente, vencida ou indisponível nesta marca.",
    },
    {
      lens: "Contraponto",
      name: "Privacidade e critérios da marca",
      score: privateData || prohibited.length ? 1 : 5,
      blocker: privateData || prohibited.length > 0,
      reason: privateData
        ? "Possível identificador pessoal ou processual. Remova ou anonimze antes de continuar."
        : prohibited.length
          ? `Expressões a revisar: ${prohibited.join(", ")}.`
          : "Nenhum padrão restrito identificado nas verificações locais. Não é um parecer jurídico.",
    },
    {
      lens: "Olhar externo",
      name: "Clareza de leitura",
      score: words < 20 ? 2 : maxLine > 700 ? 3 : 5,
      blocker: false,
      reason:
        words < 20
          ? "O texto precisa desenvolver a ideia."
          : maxLine > 700
            ? "Divida o bloco longo para facilitar a leitura."
            : "Extensão mínima e tamanho dos blocos atendidos.",
    },
    {
      lens: "Expansão",
      name: "Contexto e intenção",
      score: piece.title?.trim() && text.includes("?") ? 5 : 3,
      blocker: false,
      reason: text.includes("?")
        ? "Há uma abertura para a dúvida do leitor."
        : "Inclua uma pergunta ou explicite a ação que o leitor pode realizar.",
    },
    {
      lens: "Execução",
      name: "Formato e entrega",
      score:
        FORMATS.includes(piece.format) && piece.owner && piece.deadline ? 5 : 2,
      blocker: false,
      reason:
        "Conferência de formato, responsável e prazo. Adequação criativa continua na revisão humana.",
    },
  ];
  if (timing) checks.push({lens:'Execução', name:'Duração e completude do roteiro', score:timing.passed ? 5 : 1, blocker:!timing.passed, reason:timing.passed ? `Meta: ${timing.durationSeconds}s; cenas: ${timing.plannedSeconds}s. ${timing.scriptMode === 'outline' ? 'Pauta por blocos; tempo de discussão a validar na gravação.' : `Falas: ${timing.wordCount} palavras; leitura estimada em ${timing.estimatedSeconds}s.`}` : 'O roteiro está incompleto ou não cabe na duração escolhida. Ajuste as cenas/falas ou altere a entrega para pauta por blocos.'});
  checks.push({lens:'Integridade',name:'Completude, progressão e marca',score:issues.length?1:4,blocker:issues.length>0,reason:issues.length?issues.map(i=>i.message).join(' '):'Nenhuma falha mecânica identificada. Coerência, originalidade e veracidade exigem revisão editorial.'});
  const score = Number(
    (checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(1),
  );
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    revision: piece.revision,
    standardVersion: EDITORIAL_STANDARD,
    qualityReviewed: false,
    issues,
    sourceFingerprint: sourceFingerprint(sourceList),
    score,
    checks,
    passed:
      score >= (state.agentConfig?.threshold || 4) &&
      !checks.some((c) => c.blocker),
    mode: "local",
    summary:
      `${checks.length} checagens básicas. Não medem qualidade criativa nem confirmam fatos. A revisão editorial continua pendente.`,
  };
}
export function runCouncil(state,piece) {
  const audit=evaluateCouncil(state,piece),rounds=[{...audit,round:1}];
  return {piece:{...piece,council:{...audit,rounds},status:audit.passed?'Rascunho':'Em conferência'},rounds};
}
export function councilGate(state, piece) {
  const audit = evaluateCouncil(state, piece);
  if (
    !piece.council ||
    piece.council.standardVersion !== EDITORIAL_STANDARD ||
    piece.council.revision !== piece.revision ||
    piece.council.sourceFingerprint !== audit.sourceFingerprint ||
    !piece.council.passed ||
    piece.council.score < state.agentConfig.threshold ||
    !audit.passed
  )
    throw new Error(
      "Execute o conselho na versão atual e resolva os bloqueios antes de enviar à aprovação humana.",
    );
}
export function executionRecord(state, piece, delivery) {
  return {
    id: crypto.randomUUID(),
    workspace: state.workspace,
    pieceId: piece.id,
    title: piece.title,
    at: new Date().toISOString(),
    mode: delivery.mode || "local",
    steps: AGENTS.map((a) => ({
      agentId: a.id,
      name: a.name,
      phase: a.phase,
      status:
        a.id === "publisher"
          ? "Aguardando aprovação"
          : a.id === 'compliance' ? 'Conferência pendente'
          : a.id === 'trend' ? 'Fontes fornecidas pelo briefing'
          : delivery.mode === "provider"
            ? "Produzido pelo provedor"
            : "Preparado localmente",
      contribution:
        a.id === "copy"
          ? delivery.body
          : a.id === "visual"
            ? delivery.visual
            : a.id === "av"
              ? delivery.av
              : a.id === "seo"
                ? JSON.stringify(delivery.seo)
                : a.output,
    })),
    delivery,
  };
}
