import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { mcpTools, mcpCall } from './mcp-client.mjs';
import { nativeGenerate, nativePoll } from './native-media.mjs';
import Anthropic from '@anthropic-ai/sdk';
import { textModel } from './text-model.mjs';

const providers = ['higgsfield','higgsfield-api','blotato','anthropic','openai','gemini','meta'];
const oauthOrigin = 'https://mcp.higgsfield.ai';
export function createIntegrations(dir) {
  fs.mkdirSync(dir,{recursive:true});
  const keyFile=path.join(dir,'credentials.key');
  if(!fs.existsSync(keyFile)) fs.writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});
  const master=fs.readFileSync(keyFile);
  const db=new DatabaseSync(path.join(dir,'integrations.sqlite'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS connections (owner TEXT, provider TEXT, secret TEXT, PRIMARY KEY(owner,provider)); CREATE TABLE IF NOT EXISTS jobs (owner TEXT, id TEXT, request_key TEXT, data TEXT, PRIMARY KEY(owner,id), UNIQUE(owner,request_key));');
  const encrypt=value=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',master,iv);const body=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');};
  const decrypt=value=>{const raw=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',master,raw.subarray(0,12));cipher.setAuthTag(raw.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(raw.subarray(28)),cipher.final()]).toString());};
  const validate=provider=>{if(!providers.includes(provider))throw new Error('Provedor inválido.');};
  function save(owner,provider,value){validate(provider);db.prepare('INSERT OR REPLACE INTO connections VALUES (?,?,?)').run(owner,provider,encrypt(value));}
  function credentials(owner,provider){validate(provider);const row=db.prepare('SELECT secret FROM connections WHERE owner=? AND provider=?').get(owner,provider);if(!row)throw new Error('Conecte este provedor em Configurações.');return decrypt(row.secret);}
  async function secret(owner,provider){const value=credentials(owner,provider);if(value.refresh_token && value.expires_at<Date.now()+60000){const next=await oauth('/oauth2/token',{grant_type:'refresh_token',refresh_token:value.refresh_token,client_id:value.client_id,...(value.client_secret?{client_secret:value.client_secret}:{})});Object.assign(value,next,{expires_at:Date.now()+(next.expires_in||3600)*1000});save(owner,provider,value);}return value.access_token||value.key;}
  function status(owner){return {connections:providers.map(provider=>({provider,configured:!!db.prepare('SELECT provider FROM connections WHERE owner=? AND provider=?').get(owner,provider)})),jobs:db.prepare('SELECT data FROM jobs WHERE owner=? ORDER BY rowid DESC LIMIT 20').all(owner).map(row=>JSON.parse(row.data))};}
  function store(owner,job){db.prepare('UPDATE jobs SET data=? WHERE owner=? AND id=?').run(JSON.stringify(job),owner,job.id);return job;}
  async function once(owner,input,action){if(typeof input.idempotencyKey!=='string'||input.idempotencyKey.length<8||input.idempotencyKey.length>100)throw new Error('Identificador de solicitação inválido.');const existing=db.prepare('SELECT data FROM jobs WHERE owner=? AND request_key=?').get(owner,input.idempotencyKey);if(existing)return JSON.parse(existing.data);const job={id:randomUUID(),provider:input.provider,kind:input.kind||'mcp',status:'submitting',createdAt:new Date().toISOString()};db.prepare('INSERT INTO jobs VALUES (?,?,?,?)').run(owner,job.id,input.idempotencyKey,JSON.stringify(job));try{return store(owner,{...job,...await action()});}catch(error){store(owner,{...job,status:'failed',error:error.message});throw error;}}
  async function oauth(endpoint,values,json=false){const response=await fetch(oauthOrigin+endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Content-Type':json?'application/json':'application/x-www-form-urlencoded'},body:json?JSON.stringify(values):new URLSearchParams(values)});if(!response.ok)throw new Error(`Higgsfield: autenticação recusada (HTTP ${response.status}).`);return response.json();}
  const pending=new Map();
  return {
    status,
    async writer(owner, provider, modelName) { return textModel(provider, await secret(owner, provider), modelName); },
    configure(owner,provider,key){if(typeof key!=='string'||key.length<8||key.length>16000||/[\r\n]/.test(key))throw new Error('Informe uma credencial válida.');save(owner,provider,{key});return {configured:true};},
    remove(owner,provider){validate(provider);db.prepare('DELETE FROM connections WHERE owner=? AND provider=?').run(owner,provider);return {configured:false};},
    async tools(owner,provider){return {tools:await mcpTools(provider,await secret(owner,provider))};},
    async test(owner,provider){const key=await secret(owner,provider);if(['higgsfield','blotato'].includes(provider))return {verified:true,tools:await mcpTools(provider,key)};if(provider==='higgsfield-api'){const probe=await fetch('https://api.higgsfield.ai/requests/00000000-0000-4000-8000-000000000000/status',{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Key ${key}`}});if([401,403].includes(probe.status))throw new Error(`Credencial não validada (HTTP ${probe.status}). Use o formato ID:SECRET da Higgsfield Cloud.`);return {verified:true,tools:[]};}if(provider==='anthropic'){try{await new Anthropic({apiKey:key,timeout:20000,maxRetries:0}).models.list({limit:1});}catch(error){throw new Error(error instanceof Anthropic.APIError?`Credencial não validada (HTTP ${error.status ?? 'sem resposta'}).`:'Não foi possível contatar a Anthropic.');}return {verified:true,tools:[]};}const url=provider==='openai'?'https://api.openai.com/v1/models':provider==='meta'?'https://graph.instagram.com/me?fields=user_id,username':'https://generativelanguage.googleapis.com/v1beta/models';const headers=provider==='openai'||provider==='meta'?{Authorization:`Bearer ${key}`}:{'x-goog-api-key':key};const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers});if(!response.ok)throw new Error(`Credencial não validada (HTTP ${response.status}).`);return {verified:true,tools:[]};},
    async ingestInstagram(owner, rawUrl) {
      const key = await secret(owner, 'meta');
      const url = new URL(rawUrl);
      const requested = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
      if (!requested || !/^[a-z0-9._]{1,30}$/i.test(requested)) throw new Error('Informe o link de um perfil do Instagram.');
      const request = async endpoint => {
        const response = await fetch(endpoint, { redirect:'error', signal:AbortSignal.timeout(30000), headers:{ Authorization:`Bearer ${key}` } });
        if (!response.ok) throw new Error(`Instagram recusou a leitura (HTTP ${response.status}). Verifique se a conta é profissional e se o token tem permissão de leitura.`);
        return response.json();
      };
      const me = await request('https://graph.instagram.com/me?fields=user_id,username');
      if (String(me.username || '').toLowerCase() !== requested) throw new Error(`O token conectado pertence a @${me.username || 'outra conta'}. Conecte a conta @${requested} para importar o perfil inteiro.`);
      const media = await request('https://graph.instagram.com/me/media?fields=id,caption,media_type,media_product_type,permalink,timestamp,username&limit=100');
      const posts = Array.isArray(media.data) ? media.data.filter(item => typeof item.caption === 'string' && item.caption.trim()) : [];
      const text = posts.map(item => `[${item.timestamp || 'sem data'}] ${item.caption.trim()}`).join('\n\n');
      if (text.length < 80) throw new Error('A conta não retornou legendas suficientes para criar uma referência. Reels sem legenda precisam do arquivo de mídia para transcrição.');
      const items = posts.filter(item => item.caption.trim().length >= 80 && item.permalink).map(item => ({ kind:'instagram', url:item.permalink, title:item.caption.trim().split(/\r?\n/)[0].slice(0,90), text:item.caption.trim(), publishedAt:item.timestamp || null }));
      return { title:`Instagram @${me.username}`, origin:`Instagram oficial @${me.username}`, url:posts[0]?.permalink || rawUrl, text, posts:posts.length, items };
    },
    async generate(owner,input){const key=await secret(owner,input.provider);return once(owner,input,()=>nativeGenerate(input,key));},
    async transcribe(owner, input) {
      const key = await secret(owner, 'openai');
      const name = String(input?.name || 'source.mp3');
      const mimeType = String(input?.mimeType || 'audio/mpeg');
      const data = Buffer.from(String(input?.data || ''), 'base64');
      if (!/^[\w.-]{1,200}$/.test(name) || !/^(audio|video)\/[a-z0-9.+-]+$/i.test(mimeType) || !data.length || data.length > 25 * 1024 * 1024) throw new Error('Arquivo de mídia inválido para transcrição.');
      const body = new FormData();
      body.set('file', new Blob([data], { type: mimeType }), name);
      body.set('model', 'gpt-4o-transcribe');
      body.set('language', 'pt');
      body.set('response_format', 'json');
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method:'POST', redirect:'error', signal:AbortSignal.timeout(300000), headers:{ Authorization:`Bearer ${key}` }, body });
      if (!response.ok) throw new Error(`A transcrição foi recusada pela OpenAI (HTTP ${response.status}). Verifique a chave, o formato e o saldo.`);
      const result = await response.json();
      if (typeof result.text !== 'string' || result.text.trim().length < 20) throw new Error('A transcrição não retornou texto suficiente para criar uma referência.');
      return result.text;
    },
    async poll(owner,id){const row=db.prepare('SELECT data FROM jobs WHERE owner=? AND id=?').get(owner,id);if(!row)throw new Error('Solicitação não encontrada.');const job=JSON.parse(row.data);if(job.status!=='pending')return job;return store(owner,{...job,...await nativePoll(job,await secret(owner,job.provider))});},
    async call(owner,provider,input){const key=await secret(owner,provider);const list=await mcpTools(provider,key);if(!list.some(tool=>tool.name===input.name))throw new Error('Ferramenta não disponível nesta conexão.');if(/(?:create_post|publish|delete|remove|schedule.*post)/i.test(input.name))throw new Error('Publicação e exclusão não são executadas pelo estúdio de mídia. Use o fluxo editorial de aprovação.');return once(owner,{...input,provider},async()=>({status:'completed',result:await mcpCall(provider,key,input.name,input.arguments||{})}));},
    async authorize(owner){for(const [id,item] of pending)if(item.expires<Date.now())pending.delete(id);const redirect_uri='http://localhost:5174/api/integrations/higgsfield/callback';const client=await oauth('/oauth2/register',{client_name:'Memorable local',redirect_uris:[redirect_uri],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none'},true);if(!client.client_id)throw new Error('Higgsfield não retornou o registro do cliente OAuth.');const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');pending.set(state,{owner,verifier,client,redirect_uri,expires:Date.now()+600000});const url=new URL(oauthOrigin+'/oauth2/authorize');url.search=new URLSearchParams({response_type:'code',client_id:client.client_id,redirect_uri,scope:'openid email offline_access',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',resource:oauthOrigin+'/mcp'}).toString();return {url:url.href};},
    async callback(query){const item=pending.get(query.get('state'));pending.delete(query.get('state'));if(!item||item.expires<Date.now()||!query.get('code'))throw new Error('Autorização expirada ou recusada. Volte às configurações e tente novamente.');const token=await oauth('/oauth2/token',{grant_type:'authorization_code',code:query.get('code'),redirect_uri:item.redirect_uri,client_id:item.client.client_id,code_verifier:item.verifier});if(!token.access_token)throw new Error('Autorização sem token de acesso.');save(item.owner,'higgsfield',{...token,client_id:item.client.client_id,expires_at:Date.now()+(token.expires_in||3600)*1000});return {connected:true};},
  };
}
