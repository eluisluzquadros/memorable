import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { prepareAccountState, createAccountState, organizationSetup } from '../src/account-state.mjs';
import { cookie } from './config.mjs';
import { openDb } from './sql.mjs';

const SCHEMA = `PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS account_state (user_id TEXT PRIMARY KEY REFERENCES users(id), document TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS account_state_backups (user_id TEXT NOT NULL REFERENCES users(id), revision INTEGER NOT NULL, document TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,revision));`;
const UPSERT_STATE = 'INSERT INTO account_state VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET document=excluded.document,revision=excluded.revision,updated_at=excluded.updated_at';

export function createAccounts(filename) {
 const db = openDb(filename, SCHEMA);
 const digest = token => createHash('sha256').update(token).digest('hex');
 const publicUser = row => ({id:row.id,name:row.name,email:row.email});
 // The legacy cookie name is still read so sessions created before the rename stay valid.
 const cookieToken = req => { const cookies = req.headers.cookie?.split(';').map(s=>s.trim()) || []; const found = cookies.find(s=>s.startsWith('memorable_session=')) || cookies.find(s=>s.startsWith('skyvidya_session=')); return found ? found.slice(found.indexOf('=')+1) : ''; };
 const lookup = async req => { const row=await db.get('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?',digest(cookieToken(req)),Date.now()); return row ? publicUser(row) : null; };
 // Postgres locks the row it is about to rewrite; SQLite already holds the whole file inside the transaction.
 const lockState = q => q.dialect === 'postgres' ? ' FOR UPDATE' : '';
 const attempts = new Map();
 async function authenticate(input, register, address) {
  const now=Date.now(); const recent=(attempts.get(address)||[]).filter(t=>now-t<15*60000);
  if(recent.length>=15) throw new Error('Muitas tentativas. Aguarde 15 minutos.');
  attempts.set(address,[...recent,now]);
  if(attempts.size>1000) for(const [key,times] of attempts) if(times.every(t=>now-t>=15*60000)) attempts.delete(key);
  const email=String(input.email||'').trim().toLowerCase(), password=input.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<12||password.length>128) throw new Error('Use um e-mail válido e uma senha de 12 a 128 caracteres.');
  let row=await db.get('SELECT * FROM users WHERE email=?',email);
  if(register) {
   const name=String(input.name||'').trim(); if(name.length<2||name.length>80) throw new Error('Informe um nome entre 2 e 80 caracteres.');
   if(row) throw new Error('Não foi possível criar a conta. Tente entrar com seus dados.');
   const setup=organizationSetup(input.organization,name);
   const salt=randomBytes(16).toString('hex'), hash=scryptSync(password,salt,64).toString('hex');
   row={id:randomUUID(),name,email};
   const nowText=new Date().toISOString();
   await db.tx(async q=>{
    await q.run('INSERT INTO users VALUES(?,?,?,?,?,?)',row.id,name,email,hash,salt,nowText);
    await q.run('INSERT INTO account_state VALUES(?,?,?,?)',row.id,JSON.stringify(createAccountState(row,setup)),1,nowText);
   });
  } else {
   const hash=scryptSync(password,row?.salt||'unknown-account-salt',64);
   if(!row||!timingSafeEqual(hash,Buffer.from(row.password_hash,'hex'))) throw new Error('E-mail ou senha incorretos.');
  }
  attempts.delete(address);
  const token=randomBytes(32).toString('hex');
  await db.run('DELETE FROM sessions WHERE expires_at<=?',now);
  await db.run('INSERT INTO sessions VALUES(?,?,?)',digest(token),row.id,now+7*86400000);
  return {user:publicUser(row),token};
 }
 const documentOf = async userId => { const row=await db.get('SELECT document FROM account_state WHERE user_id=?',userId); return row?JSON.parse(row.document):null; };
 return {
  lookup, authenticate,
  // Who the ids are (name and e-mail), for the platform team's cost views.
  async names(ids) {
   const list=[...new Set(ids)].filter(Boolean); if(!list.length) return {};
   const rows=await db.all(`SELECT id,name,email FROM users WHERE id IN (${list.map(()=>'?').join(',')})`,...list);
   return Object.fromEntries(rows.map(u=>[u.id,{name:u.name,email:u.email}]));
  },
  async revoke(req) { await db.run('DELETE FROM sessions WHERE token_hash=?',digest(cookieToken(req))); },
  read(user) {
   return db.tx(async q=>{
    const row=await q.get('SELECT document,revision FROM account_state WHERE user_id=?'+lockState(q),user.id);
    const saved=row?JSON.parse(row.document):null;
    if(saved?.accountSchemaVersion) return {state:saved,revision:row.revision};
    const state=prepareAccountState(user,saved),revision=(row?.revision||0)+1,now=new Date().toISOString();
    if(row) await q.run('INSERT OR IGNORE INTO account_state_backups VALUES(?,?,?,?)',user.id,row.revision,row.document,now);
    await q.run(UPSERT_STATE,user.id,JSON.stringify(state),revision,now);
    return {state,revision};
   });
  },
  async backup(user) { const row=await db.get('SELECT document,revision,created_at FROM account_state_backups WHERE user_id=? ORDER BY revision DESC LIMIT 1',user.id);return row?{state:JSON.parse(row.document),revision:row.revision,createdAt:row.created_at}:null; },
  // Read-only view of an organization document, for routes that act for someone other than its owner.
  peek: documentOf,
  async workspaceActive(userId,workspace){const doc=await documentOf(userId);return Boolean(doc?.workspaces?.some(w=>w.id===workspace&&!w.archived));},
  save(user, input) {
   if(!input.state || !Array.isArray(input.state.pieces) || !Array.isArray(input.state.sources) || !Number.isInteger(input.revision)) throw new Error('Estado inválido.');
   const doc=JSON.stringify(input.state); if(Buffer.byteLength(doc)>8*1024*1024) throw new Error('O espaço excede 8 MB. Exporte os dados para reorganizar o acervo.');
   return db.tx(async q=>{
    const current=(await q.get('SELECT revision FROM account_state WHERE user_id=?'+lockState(q),user.id))?.revision||0;
    if(current!==input.revision) { const error=new Error('Este espaço mudou em outra aba. Exporte suas alterações e recarregue antes de continuar.');error.status=409;throw error; }
    const revision=current+1;await q.run(UPSERT_STATE,user.id,doc,revision,new Date().toISOString());return {revision};
   });
  },
  close(){return db.close();}
 };
}
export const sessionCookie = token => cookie('memorable_session', token);
