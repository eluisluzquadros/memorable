import http from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectSources } from "./collector.mjs";
import { extractBrand } from "./brand.mjs";
import { generateSquad, generateProduction, generateVideoScripts, councilAI, providerReady, serverModelName, serverModel, allowedServerModel, analyseRadar, providerUsage } from "./ai.mjs";
import { nextRadarRun, validateRadar } from "../src/operations.mjs";
import { createAccounts, sessionCookie } from './accounts.mjs';
import { createSuggestions, contributorCookie, suggestionStatus } from './suggestions.mjs';
import { createIntegrations } from './integrations.mjs';
import { discoverChannel, importChannelItems } from './channels.mjs';
import { createObservability } from './observability.mjs';
import { LLM_CATALOG } from '../src/llm-catalog.mjs';
import { refinePiece } from './refine.mjs';
import { checkGroupCoherence } from './group.mjs';
import { enrichReference } from './keywords.mjs';
import { ingestFile, ingestUrl, sourceKind } from './ingestion.mjs';
import { PORT, HOST, APP_ORIGIN, ALLOWED_ORIGINS, clientAddress, canonicalRedirect } from "./config.mjs";
import { openDb, usingPostgres } from './sql.mjs';
import { createTasks, bufferedRequest, capturedResponse } from './tasks.mjs';
import { createLabStore, labView, canOpenRun, generationSetups, billCheck } from './lab.mjs';
import { writerFor } from '../src/model-roles.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// In the cloud this service also delivers the built screens (npm run build → dist/), so pages and API share one address.
const distDir = path.join(root, "dist");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".woff2": "font/woff2", ".mp4": "video/mp4", ".webm": "video/webm", ".txt": "text/plain; charset=utf-8" };
function serveStatic(req, res, pathname) {
  if (!fs.existsSync(distDir) || !["GET", "HEAD"].includes(req.method)) return false;
  let target = path.join(distDir, decodeURIComponent(pathname));
  if (!target.startsWith(distDir)) return false;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(distDir, "index.html");
  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    // Hashed bundles never change; the page itself is always revalidated so a deploy reaches everyone.
    "Cache-Control": pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : ext === ".html" ? "no-cache" : "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (req.method === "HEAD") return res.end(), true;
  fs.createReadStream(target).pipe(res);
  return true;
}
const dataDir = path.join(root, ".runtime");
fs.mkdirSync(dataDir, { recursive: true });
// Installs created before the rename keep their existing database file.
const legacyDb = path.join(dataDir, 'skyvidya.sqlite'), accountsDb = path.join(dataDir, 'memorable.sqlite');
const accounts = createAccounts(fs.existsSync(accountsDb) || !fs.existsSync(legacyDb) ? accountsDb : legacyDb);
const integrations = createIntegrations(dataDir);
const suggestions = createSuggestions(path.join(dataDir, 'suggestions.sqlite'));
const activeBrands = doc => (doc?.workspaces || []).filter(w => !w.archived);
// The brand of the request being served travels with it, so every AI call is recorded under that brand.
const requestContext = new AsyncLocalStorage();
const observability = createObservability(dataDir, { context: () => requestContext.getStore() });
// The account AI budget (state.aiBudget = { amount in US$, period "semana" or "mês" }) against real spend.
const periodStart = (period) => {
  const now = new Date();
  if (period === "semana") { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString(); }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};
async function budgetStatus(user) {
  const doc = (await accounts.read(user)).state;
  const budget = doc.aiBudget && Number(doc.aiBudget.amount) > 0 ? { amount: Number(doc.aiBudget.amount), period: doc.aiBudget.period === "semana" ? "semana" : "mês" } : null;
  const since = periodStart(budget?.period || "mês");
  const spend = await observability.spend(user.id, since);
  return { budget, since, ...spend, share: budget ? spend.total / budget.amount : null };
}
const BUDGET_ROUTES = new Set(["/api/squad", "/api/production", "/api/council", "/api/refine", "/api/video-scripts/generate", "/api/brand-dna", "/api/group-coherence", "/api/radar/analyse"]);
const lab = createLabStore(path.join(dataDir, 'lab.sqlite'));
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
// A reference read on request gets the reviewer's summary and themes; the local heuristic stays as fallback.
async function enrich(reference, user, route, roles = {}) {
  if (!providerReady() || !reference?.text) return { ...reference, keywordSource: 'heuristic' };
  try { return { ...reference, ...(await enrichReference(reference, roleModel('reviewer', roles?.reviewer, user?.id || null, route).model)) }; }
  catch { return { ...reference, keywordSource: 'heuristic' }; }
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
// Collected references and radar schedules: one JSON value in service_state (Postgres in the cloud,
// .runtime/service.sqlite locally). The old monitoring.json is imported once.
const serviceState = openDb(path.join(dataDir, "service.sqlite"), "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS service_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);");
const legacyMonitoring = path.join(dataDir, "monitoring.json");
let db = { schedules: {}, sources: [], runs: [] };
let savedMonitoring;
try {
  savedMonitoring = await serviceState.get("SELECT value FROM service_state WHERE key=?", "monitoring");
} catch (error) {
  // The first query is also the connection test: say plainly why the service cannot start.
  let host = "";
  try { host = new URL(process.env.SUPABASE_DB_URL).hostname; } catch {}
  console.error(`Banco indisponível (${error.code || "erro"}: ${error.message})${host ? ` · host ${host}` : ""}.`);
  if (/^db\..+\.supabase\.co$/.test(host)) console.error("Esse é o endereço direto do Supabase, que só responde por IPv6. Em servidores só-IPv4 (como o Render) use a string do Session pooler (…pooler.supabase.com).");
  process.exit(1);
}
if (savedMonitoring) db = JSON.parse(savedMonitoring.value);
else { try { db = JSON.parse(fs.readFileSync(legacyMonitoring, "utf8")); } catch {} }
let saving = Promise.resolve();
// Writes are queued so they land in order; a failed write is logged and the next one carries the full state.
const persist = () => {
  const value = JSON.stringify(db), at = new Date().toISOString();
  saving = saving
    .then(() => serviceState.run("INSERT INTO service_state VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", "monitoring", value, at))
    .catch((e) => console.error("Falha ao salvar a coleta:", e.message));
};
if (!savedMonitoring) persist();
const active = new Set();
const spaces = ["bbmd", "ativos", "juris", "esfera", "podcast", "pessoal"];
const scopeKey = (workspace,ownerId) => ownerId ? `${ownerId}:${workspace}` : workspace;
async function workspaceOwner(req,workspace) {
  const user=await accounts.lookup(req);
  const allowed=user ? (await accounts.read(user)).state.workspaces.filter(w=>!w.archived).map(w=>w.id) : spaces;
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
// Routes that can take longer than a proxy waits. Asked with the X-Memoravel-Async header, they answer
// 202 with a task id at once and run the same handler in the background.
const ASYNC_ROUTES = new Set(['/api/squad', '/api/production', '/api/council', '/api/refine', '/api/brand-dna', '/api/group-coherence', '/api/video-scripts/generate', '/api/radar/analyse', '/api/ingest/url', '/api/ingest/file', '/api/ingest/channel', '/api/ingest/channel/import', '/api/monitor']);
const tasks = createTasks();
const originRefused = (req) => (req.headers.origin && !ALLOWED_ORIGINS.includes(req.headers.origin)) || req.headers['sec-fetch-site'] === 'cross-site';
async function readRaw(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Requisição excede o limite de tamanho.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://service.local').pathname;
  // The health check keeps answering on any address; page visits move to the official one.
  const canonical = pathname !== '/api/health' && ['GET', 'HEAD'].includes(req.method) && canonicalRedirect(req);
  if (canonical) { res.writeHead(301, { Location: canonical, 'Cache-Control': 'no-store' }); return res.end(); }
  try {
    if (req.method === 'GET' && pathname.startsWith('/api/tasks/')) {
      if (originRefused(req)) return send(res, 403, { error: 'Origem não autorizada.' });
      const task = tasks.get(pathname.slice('/api/tasks/'.length), (await accounts.lookup(req))?.id || null);
      return task ? send(res, 200, task) : send(res, 404, { error: 'Esta geração não está mais disponível. O serviço pode ter reiniciado: tente de novo.' });
    }
    if (req.method === 'POST' && ASYNC_ROUTES.has(pathname) && req.headers['x-memoravel-async'] === '1') {
      if (originRefused(req)) return send(res, 403, { error: 'Origem não autorizada.' });
      const owner = (await accounts.lookup(req))?.id || null;
      const body = await readRaw(req, 37 * 1024 * 1024);
      const id = tasks.start(owner, pathname, async () => {
        const captured = capturedResponse();
        await handle(bufferedRequest(req, body), captured.res);
        return captured.done;
      }, req.headers['x-memoravel-task']);
      return send(res, 202, { task: id });
    }
  } catch (e) {
    return send(res, e.status || 400, { error: e.message });
  }
  return handle(req, res);
});
async function handle(req, res) {
  try {
    const callbackUrl = new URL(req.url, 'http://service.local');
    if(req.method==='GET' && callbackUrl.pathname==='/api/integrations/higgsfield/callback') {
      await integrations.callback(callbackUrl.searchParams);
      res.writeHead(302,{Location:`${APP_ORIGIN}/#app/configuracoes/conexoes`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});return res.end();
    }
    if (!callbackUrl.pathname.startsWith('/api/') && serveStatic(req, res, callbackUrl.pathname)) return;
    const origin = req.headers.origin;
    if (origin && !ALLOWED_ORIGINS.includes(origin))
      return send(res, 403, {
        error: "Origem não autorizada para o serviço.",
      });
    const url = new URL(req.url, "http://service.local");
    if (req.headers['sec-fetch-site'] === 'cross-site') return send(res,403,{error:'Origem não autorizada.'});
    if (url.pathname.startsWith('/api/ingest/')) {
      if (req.method !== 'POST') return send(res,405,{error:'Método indisponível.'});
      const input = await read(req);
      if (url.pathname === '/api/ingest/url') {
        const user = await accounts.lookup(req);
        const isInstagram = (() => { try { return sourceKind(input.url) === 'social'; } catch { return false; } })();
        return send(res,200,await enrich(await ingestUrl(input, isInstagram ? { instagram: user ? value => integrations.ingestInstagram(user.id, value) : undefined } : {}), user, url.pathname, input.roles));
      }
      if (url.pathname === '/api/ingest/channel') {
        const user = await accounts.lookup(req);
        return send(res,200,await discoverChannel(input, { instagram: user ? value => integrations.ingestInstagram(user.id, value) : undefined }));
      }
      if (url.pathname === '/api/ingest/channel/import') return send(res,200,await importChannelItems(input));
      if (url.pathname === '/api/ingest/file') {
        const user = await accounts.lookup(req);
        const isMedia = /^(audio|video)\//i.test(String(input.mimeType || '')) || /\.(mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm|flac)$/i.test(String(input.name || ''));
        return send(res,200,await enrich(await ingestFile(input, isMedia ? { transcribe: user ? media => integrations.transcribe(user.id, media) : undefined } : {}), user, url.pathname, input.roles));
      }
      return send(res,404,{error:'Rota de ingestão não encontrada.'});
    }
    if(url.pathname.startsWith('/api/integrations')||url.pathname.startsWith('/api/media/')) {
      const user=await accounts.lookup(req);
      if(!user)return send(res,401,{error:'Entre na sua conta para configurar conexões e gerar mídia.'});
      if(req.method==='GET'&&url.pathname==='/api/integrations')return send(res,200,await integrations.status(user.id));
      const match=url.pathname.match(/^\/api\/integrations\/(higgsfield-api|higgsfield|blotato|anthropic|openai|gemini|meta)(?:\/(test|tools|call|authorize))?$/);
      if(match){const [,provider,action]=match;
        if(req.method==='GET'&&action==='tools')return send(res,200,await integrations.tools(user.id,provider));
        if(req.method==='DELETE'&&!action)return send(res,200,await integrations.remove(user.id,provider));
        if(req.method==='PUT'&&!action)return send(res,200,await integrations.configure(user.id,provider,(await read(req)).key));
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
        const result = await suggestions.login(await read(req), clientAddress(req));
        await suggestions.revoke(req); res.setHeader('Set-Cookie', contributorCookie(result.token));
        return send(res, 200, { contributor: { name: result.contributor.name } });
      }
      if (req.method === 'POST' && url.pathname === '/api/contributor/logout') { await suggestions.revoke(req); res.setHeader('Set-Cookie', contributorCookie('')); return send(res, 200, { ok: true }); }
      const person = await suggestions.lookup(req);
      if (!person) return send(res, 401, { error: 'Entre com o acesso de colaborador.' });
      const doc = await accounts.peek(person.ownerId), brands = activeBrands(doc).filter(w => person.workspaces.includes(w.id));
      if (req.method === 'GET' && url.pathname === '/api/contributor/me') {
        const names = new Map(activeBrands(doc).map(w => [w.id, w.name]));
        return send(res, 200, {
          contributor: { name: person.name, area: person.area }, organization: doc?.organizationName || '',
          brands: brands.map(w => ({ id: w.id, name: w.name })),
          suggestions: (await suggestions.mine(person)).map(s => ({ id: s.id, title: s.title, brand: names.get(s.workspace) || 'Marca arquivada', createdAt: s.createdAt, reason: s.status === 'declined' ? s.reason : '', ...suggestionStatus(s, doc?.pieces) })),
        });
      }
      if (req.method === 'POST' && url.pathname === '/api/contributor/suggestions') return send(res, 200, { suggestion: await suggestions.submit(person, await read(req), brands.map(w => w.id)) });
      return send(res, 404, { error: 'Rota não encontrada.' });
    }
    if (url.pathname.startsWith('/api/team/')) {
      const user = await accounts.lookup(req);
      if (!user) return send(res, 401, { error: 'Sugestões de colaboradores exigem uma conta.' });
      const brandIds = async () => activeBrands(await accounts.peek(user.id)).map(w => w.id);
      if (req.method === 'GET' && url.pathname === '/api/team/contributors') return send(res, 200, { contributors: await suggestions.list(user.id) });
      if (req.method === 'POST' && url.pathname === '/api/team/contributors') return send(res, 200, await suggestions.invite(user.id, await read(req), await brandIds()));
      if (req.method === 'POST' && url.pathname === '/api/team/contributors/remove') return send(res, 200, await suggestions.remove(user.id, (await read(req)).id));
      if (req.method === 'GET' && url.pathname === '/api/team/suggestions') return send(res, 200, { suggestions: await suggestions.forOwner(user.id) });
      if (req.method === 'POST' && url.pathname === '/api/team/suggestions/decide') return send(res, 200, { suggestion: await suggestions.decide(user.id, await read(req), user.name) });
      return send(res, 404, { error: 'Rota não encontrada.' });
    }
    if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/api/account/')) {
      const user=await accounts.lookup(req);
      if(req.method==='GET' && url.pathname==='/api/auth/session') return send(res,200,{user});
      if(url.pathname==='/api/account/backup') {
        if(!user)return send(res,401,{error:'Entre na sua conta para acessar a cópia.'});
        return send(res,200,{backup:await accounts.backup(user)});
      }
      if(url.pathname==='/api/account/state') {
        if(!user) return send(res,401,{error:'Entre na sua conta para acessar os dados.'});
        if(req.method==='GET') return send(res,200,await accounts.read(user));
        if(req.method==='PUT') {const input=await read(req);if(input.userId!==user.id)return send(res,403,{error:'A conta ativa mudou. Recarregue a página antes de salvar.'});return send(res,200,await accounts.save(user,input));}
      }
      if(req.method==='POST' && ['/api/auth/login','/api/auth/register'].includes(url.pathname)) {
        const result=await accounts.authenticate(await read(req),url.pathname.endsWith("/register"),clientAddress(req));
        await accounts.revoke(req);res.setHeader('Set-Cookie',sessionCookie(result.token));return send(res,200,{user:result.user});
      }
      if(req.method==='POST' && url.pathname==='/api/auth/logout') {await accounts.revoke(req);res.setHeader('Set-Cookie',sessionCookie(''));return send(res,200,{ok:true});}
      return send(res,405,{error:'Método indisponível.'});
    }
    if (req.method === "GET" && url.pathname === "/api/health")
      return send(res, 200, {
        ok: true,
        provider: providerReady(),
        mode: "local-service",
        database: usingPostgres() ? "postgres" : "sqlite",
      });
    if (req.method === 'GET' && url.pathname === '/api/text/status') {
      const user = await accounts.lookup(req);
      const configured = user ? (await integrations.status(user.id)).connections.filter(c => ['anthropic','openai','gemini'].includes(c.provider) && c.configured).map(c => c.provider) : [];
      return send(res,200,{authenticated:!!user, serverModel:providerReady()?serverModelName():null, modelChoice:modelChoice(), providers:[...(providerReady() ? ['server'] : []),...configured]});
    }
    if (req.method === 'GET' && url.pathname === '/api/budget') {
      const user = await accounts.lookup(req);
      if (!user) return send(res, 401, { error: 'Entre na sua conta para ver o orçamento.' });
      return send(res, 200, await budgetStatus(user));
    }
    // Model lab: platform-wide benchmark results, read by signed-in accounts.
    if (req.method === 'GET' && (url.pathname === '/api/lab' || url.pathname === '/api/lab/run')) {
      // The public benchmark needs no account; a round's texts open only for the accounts that produced them.
      const viewer = await accounts.lookup(req);
      if (url.pathname === '/api/lab/run') {
        const run = await lab.run(url.searchParams.get('id') || '');
        if (!run) return send(res, 404, { error: 'Rodada não encontrada.' });
        if (!canOpenRun(run, viewer?.id)) return send(res, 403, { error: 'Os textos desta rodada ficam com a conta que os produziu. O benchmark público mostra só notas, custos e tempos.' });
        return send(res, 200, { run, items: await lab.items(run.id) });
      }
      const runs = await lab.runs(), view = labView(await lab.allItems(), runs, viewer?.id);
      // Whole generations on the platform (last 30 days), grouped by the models used: public, no account data.
      const generations = generationSetups(await observability.generations({ since: new Date(Date.now() - 30 * 86400000).toISOString() }));
      // The check against OpenRouter's bill is for the accounts that own the benchmark.
      const bill = view.access === 'owner' ? billCheck(await providerUsage(), runs, await observability.recorded()) : null;
      return send(res, 200, { ...view, generations, bill, prices: await catalogWithPrices() });
    }
    if (req.method === 'GET' && url.pathname === '/api/models') return send(res,200,{ modelChoice:modelChoice(), defaultModel:providerReady()?serverModelName():null, roleDefaults:roleDefaults(), models:await catalogWithPrices() });
    if (req.method === 'GET' && url.pathname === '/api/observability') {
      const user = await accounts.lookup(req);
      return send(res,200,await observability.summary({ owner:user?.id || null, days:Math.min(365, Math.max(1, Number(url.searchParams.get('days')) || 30)) }));
    }
    if (req.method === "GET" && url.pathname === "/api/collected") {
      const workspace = url.searchParams.get("workspace");
      const ownerId=await workspaceOwner(req,workspace);
      return send(res, 200, {
        sources: db.sources.filter((s) => s.workspace === workspace && (s.ownerId||null)===ownerId),
        runs: db.runs.filter((s) => s.workspace === workspace && (s.ownerId||null)===ownerId),
        schedule: db.schedules[scopeKey(workspace,ownerId)],
      });
    }
    if (req.method !== "POST")
      return send(res, 404, { error: "Rota não encontrada." });
    const input = await read(req);
    requestContext.enterWith({ workspace: input.packet?.workspace || input.workspace || null });
    // Over the account AI budget, a new generation needs an explicit yes from the person.
    if (BUDGET_ROUTES.has(url.pathname) && !input.confirmOverBudget) {
      const user = await accounts.lookup(req);
      if (user) {
        const status = await budgetStatus(user);
        if (status.budget && status.total >= status.budget.amount) {
          const error = new Error(`O orçamento de IA da conta (US$ ${status.budget.amount.toFixed(2)} por ${status.budget.period}) já foi usado: US$ ${status.total.toFixed(2)}. Confirme para gerar mesmo assim ou ajuste o orçamento em Configurações.`);
          throw Object.assign(error, { status: 402, code: "budget" });
        }
      }
    }
    let writer;
    if (['/api/squad','/api/production','/api/council','/api/video-scripts/generate','/api/radar/analyse'].includes(url.pathname)) {
      const user = await accounts.lookup(req);
      if (input.provider && input.provider !== 'server') {
        if (!user) return send(res,401,{error:'Entre na sua conta e conecte Claude, OpenAI ou Gemini em Configurações.'});
        writer = await integrations.writer(user.id,input.provider,input.model);
      } else if (providerReady()) writer = serverModel(roleModelName('writer', input.model || writerFor(input.roles, input.packet?.brief?.format)));
      if (writer) writer = observability.instrument(writer, { owner:user?.id || null, route:url.pathname, provider:input.provider || 'server' });
    }
    if (url.pathname === '/api/radar/analyse') return send(res,200,await analyseRadar(input.packet,writer));
    if (url.pathname === "/api/collected/remove") {
      const ownerId=await workspaceOwner(req,input.workspace);
      if (typeof input.id !== "string" || !/^web-[a-f0-9]{20}$/.test(input.id))
        throw new Error("Referência coletada inválida.");
      const before = db.sources.length;
      db.sources = db.sources.filter((source) => !(source.workspace === input.workspace && source.id === input.id && (source.ownerId||null)===ownerId));
      if (db.sources.length === before) throw new Error("Referência coletada não encontrada.");
      persist();
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/brand-dna") {
      const voiceModel = providerReady() ? roleModel('reviewer', input.roles?.reviewer, (await accounts.lookup(req))?.id || null, url.pathname) : null;
      return send(res, 200, await extractBrand(input, { voiceModel }));
    }
    if (url.pathname === "/api/video-scripts/generate")
      return send(res, 200, await generateVideoScripts(input.packet, input.selectedTopics, writer));
    if (url.pathname === "/api/production") {
      if (!writer) throw new Error("Conecte um provedor de escrita para preparar a produção.");
      return send(res, 200, await generateProduction(input.packet, input.version, writer, input.plan || null));
    }
    if (url.pathname === "/api/squad") {
      const critic = (!input.provider || input.provider === 'server') && providerReady() ? roleModel('reviewer', input.roles?.reviewer, (await accounts.lookup(req))?.id || null, url.pathname).model : writer;
      return send(res, 200, await generateSquad(input.packet, writer, critic));
    }
    if (url.pathname === "/api/group-coherence") {
      if (!providerReady()) throw new Error("Configure um provedor de IA no serviço para checar a coerência do grupo.");
      return send(res, 200, await checkGroupCoherence(input, roleModel('reviewer', input.roles?.reviewer, (await accounts.lookup(req))?.id || null, url.pathname).model));
    }
    if (url.pathname === "/api/refine") {
      if (!providerReady()) throw new Error("Configure um provedor de IA no serviço para refinar.");
      const owner = (await accounts.lookup(req))?.id || null, roles = input.roles || {};
      return send(res, 200, await refinePiece(input.packet, input.piece, {
        reviewer: roleModel('reviewer', roles.reviewer, owner, url.pathname),
        writer: roleModel('writer', writerFor(roles, input.piece?.format), owner, url.pathname),
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
    const ownerId=await workspaceOwner(req,input.workspace);
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
    send(res, e.status || 400, { error: e.message, ...(e.code ? { code: e.code } : {}) });
  }
}
server.listen(PORT, HOST, () =>
  console.log(`Memoravel service: http://${HOST}:${PORT} · app ${APP_ORIGIN} · banco ${usingPostgres() ? "Postgres (Supabase)" : "SQLite local"}`),
);
setInterval(async () => {
  for (const [key, schedule] of Object.entries(db.schedules)) {
    const workspace=schedule.workspace || key,ownerId=schedule.ownerId || null;
    if(ownerId&&!await accounts.workspaceActive(ownerId,workspace)){if(schedule.config.enabled){schedule.config.enabled=false;schedule.nextRun=null;persist();}continue;}
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
