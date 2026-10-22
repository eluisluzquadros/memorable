import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectSources } from "./collector.mjs";
import { extractBrand } from "./brand.mjs";
import { generateSquad, generateVideoScripts, councilAI, providerReady, serverModelName, serverModel, allowedServerModel, analyseRadar } from "./ai.mjs";
import { nextRadarRun, validateRadar } from "../src/operations.mjs";
import { createAccounts, sessionCookie } from './accounts.mjs';
import { createSuggestions, contributorCookie, suggestionStatus } from './suggestions.mjs';
import { createIntegrations } from './integrations.mjs';
import { discoverChannel, importChannelItems } from './channels.mjs';
import { createObservability } from './observability.mjs';
import { LLM_CATALOG } from '../src/llm-catalog.mjs';
import { refinePiece } from './refine.mjs';
import { ingestFile, ingestUrl, sourceKind } from './ingestion.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".runtime");
fs.mkdirSync(dataDir, { recursive: true });
// Installs created before the rename keep their existing database file.
const legacyDb = path.join(dataDir, 'skyvidya.sqlite'), accountsDb = path.join(dataDir, 'memorable.sqlite');
const accounts = createAccounts(fs.existsSync(accountsDb) || !fs.existsSync(legacyDb) ? accountsDb : legacyDb);
const integrations = createIntegrations(dataDir);
const suggestions = createSuggestions(path.join(dataDir, 'suggestions.sqlite'));
const activeBrands = doc => (doc?.workspaces || []).filter(w => !w.archived);
const observability = createObservability(dataDir);
// Each role can run on its own model: the account's choice first, then MEMORABLE_MODEL_<ROLE>, then the default.
const ROLE_ENV = { writer: 'MEMORABLE_MODEL_WRITER', reviewer: 'MEMORABLE_MODEL_REVIEWER', judge: 'MEMORABLE_MODEL_JUDGE' };
function roleModelName(role, requested) {
  for (const candidate of [requested, process.env[ROLE_ENV[role]]]) {
    if (!candidate) continue;
    try { return allowedServerModel(candidate); } catch { /* Outside the catalog or no OpenRouter: fall through. */ }
  }
  return serverModelName();
}
const roleDefaults = () => providerReady() ? Object.fromEntries(Object.keys(ROLE_ENV).map(role => [role, roleModelName(role)])) : null;
function roleModel(role, requested, owner, route) {
  const name = roleModelName(role, requested);
  return { name, model: observability.instrument(serverModel(name), { owner, route, provider: 'server', runTag: role }) };
}
const modelChoice = () => { try { return providerReady() && !!allowedServerModel(LLM_CATALOG[0].id); } catch { return false; } };
// Live OpenRouter prices refresh the catalog at most every six hours.
let livePrices = { at: 0, byId: new Map() };
async function catalogWithPrices() {
  if (Date.now() - livePrices.at > 6 * 3600000) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000) });
      if (response.ok) livePrices = { at: Date.now(), byId: new Map((await response.json()).data.map(m => [m.id, m])) };
    } catch { /* Keep the bundled prices when OpenRouter is unreachable. */ }
  }
  return LLM_CATALOG.map(m => {
    const live = livePrices.byId.get(m.id);
    return live
      ? { ...m, input: Number(live.pricing?.prompt) * 1e6, output: Number(live.pricing?.completion) * 1e6, context: live.context_length, available: true, live: true }
      : { ...m, available: livePrices.byId.size ? false : null, live: false };
  });
}
const file = path.join(dataDir, "monitoring.json");
let db = { schedules: {}, sources: [], runs: [] };
try {
  db = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {}
const persist = () => {
  fs.writeFileSync(file + ".tmp", JSON.stringify(db));
  fs.renameSync(file + ".tmp", file);
};
const active = new Set();
const spaces = ["bbmd", "ativos", "juris", "esfera", "podcast", "pessoal"];
const scopeKey = (workspace,ownerId) => ownerId ? `${ownerId}:${workspace}` : workspace;
function workspaceOwner(req,workspace) {
  const user=accounts.lookup(req);
  const allowed=user ? accounts.read(user).state.workspaces.filter(w=>!w.archived).map(w=>w.id) : spaces;
  if(!allowed.includes(workspace)){const error=new Error('Este espaço não pertence à conta ativa.');error.status=403;throw error;}
  return user?.id || null;
}
const send = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
async function read(req) {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (Buffer.byteLength(text) > (req.url === '/api/account/state' ? 9 * 1024 * 1024 : req.url === '/api/ingest/file' ? 36 * 1024 * 1024 : 500000))
      throw new Error("Requisição excede o limite de tamanho.");
  }
  return JSON.parse(text || "{}");
}
async function run(workspace, sources,ownerId=null) {
  const key=scopeKey(workspace,ownerId);
  if (active.has(key))
    throw new Error("Já existe uma coleta em andamento neste espaço.");
  active.add(key);
  try {
    const result = await collectSources(workspace, sources);
    const run = {
      id: crypto.randomUUID(),
      workspace,
      ownerId,
      at: new Date().toISOString(),
      mode: "web",
      found: result.sources.length,
      detail:
        result.errors.map((e) => `${e.name}: ${e.error}`).join(" · ") ||
        "Coleta concluída no serviço local.",
    };
    db.sources = [
      ...result.sources.map(s=>({...s,ownerId})),
      ...db.sources.filter((s) => (s.ownerId||null)!==ownerId || !result.sources.some((n) => n.id === s.id)),
    ];
    db.runs = [run, ...db.runs].slice(0, 200);
    persist();
    return { ...result, run };
  } finally {
    active.delete(key);
  }
}
const server = http.createServer(async (req, res) => {
  try {
    const callbackUrl = new URL(req.url, 'http://127.0.0.1:5174');
    if(req.method==='GET' && callbackUrl.pathname==='/api/integrations/higgsfield/callback') {
      await integrations.callback(callbackUrl.searchParams);
      res.writeHead(302,{Location:'http://localhost:5173/#app/configuracoes','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
    }
    const origin = req.headers.origin;
    if (
      origin &&
      !["http://localhost:5173", "http://127.0.0.1:5173"].includes(origin)
    )
      return send(res, 403, {
        error: "Origem não autorizada para o serviço local.",
      });
    const url = new URL(req.url, "http://127.0.0.1:5174");
    if (req.headers['sec-fetch-site'] === 'cross-site') return send(res,403,{error:'Origem não autorizada.'});
    if (url.pathname.startsWith('/api/ingest/')) {
      if (req.method !== 'POST') return send(res,405,{error:'Método indisponível.'});
      const input = await read(req);
      if (url.pathname === '/api/ingest/url') {
        const user = accounts.lookup(req);
        const isInstagram = (() => { try { return sourceKind(input.url) === 'social'; } catch { return false; } })();
        return send(res,200,await ingestUrl(input, isInstagram ? { instagram: user ? value => integrations.ingestInstagram(user.id, value) : undefined } : {}));
      }
      if (url.pathname === '/api/ingest/channel') {
        const user = accounts.lookup(req);
        return send(res,200,await discoverChannel(input, { instagram: user ? value => integrations.ingestInstagram(user.id, value) : undefined }));
      }
      if (url.pathname === '/api/ingest/channel/import') return send(res,200,await importChannelItems(input));
      if (url.pathname === '/api/ingest/file') {
        const user = accounts.lookup(req);
        const isMedia = /^(audio|video)\//i.test(String(input.mimeType || '')) || /\.(mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm|flac)$/i.test(String(input.name || ''));
        return send(res,200,await ingestFile(input, isMedia ? { transcribe: user ? media => integrations.transcribe(user.id, media) : undefined } : {}));
      }
      return send(res,404,{error:'Rota de ingestão não encontrada.'});
    }
    if(url.pathname.startsWith('/api/integrations')||url.pathname.startsWith('/api/media/')) {
      const user=accounts.lookup(req);
      if(!user)return send(res,401,{error:'Entre na sua conta para configurar conexões e gerar mídia.'});
      if(req.method==='GET'&&url.pathname==='/api/integrations')return send(res,200,integrations.status(user.id));
      const match=url.pathname.match(/^\/api\/integrations\/(higgsfield-api|higgsfield|blotato|anthropic|openai|gemini|meta)(?:\/(test|tools|call|authorize))?$/);
      if(match){const [,provider,action]=match;
        if(req.method==='GET'&&action==='tools')return send(res,200,await integrations.tools(user.id,provider));
        if(req.method==='DELETE'&&!action)return send(res,200,integrations.remove(user.id,provider));
        if(req.method==='PUT'&&!action)return send(res,200,integrations.configure(user.id,provider,(await read(req)).key));
        if(req.method==='POST'&&action==='test')return send(res,200,await integrations.test(user.id,provider));
        if(req.method==='POST'&&action==='authorize'&&provider==='higgsfield')return send(res,200,await integrations.authorize(user.id));
        if(req.method==='POST'&&action==='call')return send(res,200,await integrations.call(user.id,provider,await read(req)));
      }
      if(req.method==='POST'&&url.pathname==='/api/media/generate')return send(res,200,await integrations.generate(user.id,await read(req)));
      if(req.method==='POST'&&url.pathname==='/api/media/poll')return send(res,200,await integrations.poll(user.id,(await read(req)).id));
      return send(res,404,{error:'Rota de integração não encontrada.'});
    }
    // Contributors only reach these routes: their session never opens the organization's document.
    if (url.pathname.startsWith('/api/contributor/')) {
      if (req.method === 'POST' && url.pathname === '/api/contributor/login') {
        const result = suggestions.login(await read(req), req.socket.remoteAddress);
        suggestions.revoke(req); res.setHeader('Set-Cookie', contributorCookie(result.token));
        return send(res, 200, { contributor: { name: result.contributor.name } });
      }
      if (req.method === 'POST' && url.pathname === '/api/contributor/logout') { suggestions.revoke(req); res.setHeader('Set-Cookie', contributorCookie('')); return send(res, 200, { ok: true }); }
      const person = suggestions.lookup(req);
      if (!person) return send(res, 401, { error: 'Entre com o acesso de colaborador.' });
      const doc = accounts.peek(person.ownerId), brands = activeBrands(doc).filter(w => person.workspaces.includes(w.id));
      if (req.method === 'GET' && url.pathname === '/api/contributor/me') {
        const names = new Map(activeBrands(doc).map(w => [w.id, w.name]));
        return send(res, 200, {
          contributor: { name: person.name, area: person.area }, organization: doc?.organizationName || '',
          brands: brands.map(w => ({ id: w.id, name: w.name })),
          suggestions: suggestions.mine(person).map(s => ({ id: s.id, title: s.title, brand: names.get(s.workspace) || 'Marca arquivada', createdAt: s.createdAt, reason: s.status === 'declined' ? s.reason : '', ...suggestionStatus(s, doc?.pieces) })),
        });
      }
      if (req.method === 'POST' && url.pathname === '/api/contributor/suggestions') return send(res, 200, { suggestion: suggestions.submit(person, await read(req), brands.map(w => w.id)) });
      return send(res, 404, { error: 'Rota não encontrada.' });
    }
    if (url.pathname.startsWith('/api/team/')) {
      const user = accounts.lookup(req);
      if (!user) return send(res, 401, { error: 'Sugestões de colaboradores exigem uma conta.' });
      const brandIds = () => activeBrands(accounts.peek(user.id)).map(w => w.id);
      if (req.method === 'GET' && url.pathname === '/api/team/contributors') return send(res, 200, { contributors: suggestions.list(user.id) });
      if (req.method === 'POST' && url.pathname === '/api/team/contributors') return send(res, 200, suggestions.invite(user.id, await read(req), brandIds()));
      if (req.method === 'POST' && url.pathname === '/api/team/contributors/remove') return send(res, 200, suggestions.remove(user.id, (await read(req)).id));
      if (req.method === 'GET' && url.pathname === '/api/team/suggestions') return send(res, 200, { suggestions: suggestions.forOwner(user.id) });
      if (req.method === 'POST' && url.pathname === '/api/team/suggestions/decide') return send(res, 200, { suggestion: suggestions.decide(user.id, await read(req), user.name) });
      return send(res, 404, { error: 'Rota não encontrada.' });
    }
    if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/account/')) {
      const user=accounts.lookup(req);
      if(req.method==='GET' && url.pathname==='/api/auth/session') return send(res,200,{user});
      if(url.pathname==='/api/account/backup') {
        if(!user)return send(res,401,{error:'Entre na sua conta para acessar a cópia.'});
        return send(res,200,{backup:accounts.backup(user)});
      }
      if(url.pathname==='/api/account/state') {
        if(!user) return send(res,401,{error:'Entre na sua conta para acessar os dados.'});
        if(req.method==='GET') return send(res,200,accounts.read(user));
        if(req.method==='PUT') {const input=await read(req);if(input.userId!==user.id)return send(res,403,{error:'A conta ativa mudou. Recarregue a página antes de salvar.'});return send(res,200,accounts.save(user,input));}
      }
      if(req.method==='POST' && ['/api/auth/login','/api/auth/register'].includes(url.pathname)) {
        const result=accounts.authenticate(await read(req),url.pathname.endsWith('/register'),req.socket.remoteAddress);
        accounts.revoke(req);res.setHeader('Set-Cookie',sessionCookie(result.token));return send(res,200,{user:result.user});
      }
      if(req.method==='POST' && url.pathname==='/api/auth/logout') {accounts.revoke(req);res.setHeader('Set-Cookie',sessionCookie(''));return send(res,200,{ok:true});}
      return send(res,405,{error:'Método indisponível.'});
    }
    if (req.method === "GET" && url.pathname === "/api/health")
      return send(res, 200, {
        ok: true,
        provider: providerReady(),
        mode: "local-service",
      });
    if (req.method === 'GET' && url.pathname === '/api/text/status') {
      const user = accounts.lookup(req);
      const configured = user ? integrations.status(user.id).connections.filter(c => ['anthropic','openai','gemini'].includes(c.provider) && c.configured).map(c => c.provider) : [];
      return send(res,200,{authenticated:!!user, serverModel:providerReady()?serverModelName():null, modelChoice:modelChoice(), providers:[...(providerReady() ? ['server'] : []),...configured]});
    }
    if (req.method === 'GET' && url.pathname === '/api/models') return send(res,200,{ modelChoice:modelChoice(), defaultModel:providerReady()?serverModelName():null, roleDefaults:roleDefaults(), models:await catalogWithPrices() });
    if (req.method === 'GET' && url.pathname === '/api/observability') {
      const user = accounts.lookup(req);
      return send(res,200,observability.summary({ owner:user?.id || null, days:Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30)) }));
    }
    if (req.method === "GET" && url.pathname === "/api/collected") {
      const workspace = url.searchParams.get("workspace");
      const ownerId=workspaceOwner(req,workspace);
      return send(res, 200, {
        sources: db.sources.filter((s) => s.workspace === workspace && (s.ownerId||null)===ownerId),
        runs: db.runs.filter((s) => s.workspace === workspace && (s.ownerId||null)===ownerId),
        schedule: db.schedules[scopeKey(workspace,ownerId)],
      });
    }
    if (req.method !== "POST")
      return send(res, 404, { error: "Rota não encontrada." });
    const input = await read(req);
    let writer;
    if (['/api/squad','/api/council','/api/video-scripts/generate','/api/radar/analyse'].includes(url.pathname)) {
      const user = accounts.lookup(req);
      if (input.provider && input.provider !== 'server') {
        if (!user) return send(res,401,{error:'Entre na sua conta e conecte Claude, OpenAI ou Gemini em Configurações.'});
        writer = await integrations.writer(user.id,input.provider,input.model);
      } else if (providerReady()) writer = serverModel(input.model || roleModelName('writer', input.roles?.writer));
      if (writer) writer = observability.instrument(writer, { owner:user?.id || null, route:url.pathname, provider:input.provider || 'server' });
    }
    if (url.pathname === '/api/radar/analyse') return send(res,200,await analyseRadar(input.packet,writer));
    if (url.pathname === "/api/collected/remove") {
      const ownerId=workspaceOwner(req,input.workspace);
      if (typeof input.id !== "string" || !/^web-[a-f0-9]{20}$/.test(input.id))
        throw new Error("Referência coletada inválida.");
      const before = db.sources.length;
      db.sources = db.sources.filter((source) => !(source.workspace === input.workspace && source.id === input.id && (source.ownerId||null)===ownerId));
      if (db.sources.length === before) throw new Error("Referência coletada não encontrada.");
      persist();
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/brand-dna") {
      const voiceModel = providerReady() ? roleModel('reviewer', input.roles?.reviewer, accounts.lookup(req)?.id || null, url.pathname) : null;
      return send(res, 200, await extractBrand(input, { voiceModel }));
    }
    if (url.pathname === "/api/video-scripts/generate")
      return send(res, 200, await generateVideoScripts(input.packet, input.selectedTopics, writer));
    if (url.pathname === "/api/squad") {
      const critic = (!input.provider || input.provider === 'server') && providerReady() ? roleModel('reviewer', input.roles?.reviewer, accounts.lookup(req)?.id || null, url.pathname).model : writer;
      return send(res, 200, await generateSquad(input.packet, writer, critic));
    }
    if (url.pathname === "/api/refine") {
      if (!providerReady()) throw new Error("Configure um provedor de IA no serviço para refinar.");
      const owner = accounts.lookup(req)?.id || null, roles = input.roles || {};
      return send(res, 200, await refinePiece(input.packet, input.piece, {
        reviewer: roleModel('reviewer', roles.reviewer, owner, url.pathname),
        writer: roleModel('writer', roles.writer, owner, url.pathname),
        judge: roleModel('judge', roles.judge, owner, url.pathname),
      }));
    }
    if (url.pathname === "/api/council")
      return send(
        res,
        200,
        await councilAI(
          input.packet,
          input.variant,
          input.threshold,
          input.maxRounds,
          writer,
        ),
      );
    const ownerId=workspaceOwner(req,input.workspace);
    if (!Array.isArray(input.sources) || input.sources.length > 20)
      throw new Error("Envie no máximo 20 fontes por espaço.");
    if (input.sources.some((s) => s.workspace !== input.workspace))
      throw new Error("As fontes precisam pertencer ao espaço da coleta.");
    if (url.pathname === "/api/monitor")
      return send(res, 200, await run(input.workspace, input.sources,ownerId));
    if (url.pathname === "/api/schedule") {
      validateRadar(input.config);
      db.schedules[scopeKey(input.workspace,ownerId)] = {
        workspace:input.workspace,
        ownerId,
        config: input.config,
        sources: input.sources,
        nextRun: input.config.enabled ? nextRadarRun(input.config) : null,
      };
      persist();
      return send(res, 200, {
        message: input.config.enabled
          ? "Coleta web agendada no serviço local."
          : "Coleta web pausada no serviço local.",
      });
    }
    send(res, 404, { error: "Rota não encontrada." });
  } catch (e) {
    send(res, e.status || 400, { error: e.message });
  }
});
server.listen(5174, "127.0.0.1", () =>
  console.log("Memorable local service: http://127.0.0.1:5174"),
);
setInterval(async () => {
  for (const [key, schedule] of Object.entries(db.schedules)) {
    const workspace=schedule.workspace || key,ownerId=schedule.ownerId || null;
    if(ownerId&&!accounts.workspaceActive(ownerId,workspace)){if(schedule.config.enabled){schedule.config.enabled=false;schedule.nextRun=null;persist();}continue;}
    if (
      schedule.config.enabled &&
      schedule.nextRun &&
      new Date(schedule.nextRun) <= new Date() &&
      !active.has(scopeKey(workspace,ownerId))
    ) {
      try {
        await run(workspace, schedule.sources,ownerId);
      } catch (e) {
        console.error("Coleta agendada falhou:", e.message);
      }
      schedule.nextRun = nextRadarRun(schedule.config);
      persist();
    }
  }
}, 15000).unref();
