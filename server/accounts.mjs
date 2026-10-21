import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { prepareAccountState, createAccountState, organizationSetup } from '../src/account-state.mjs';

export function createAccounts(filename) {
 const db = new DatabaseSync(filename);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS account_state (user_id TEXT PRIMARY KEY REFERENCES users(id), document TEXT NOT NULL, revision INTEGER NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS account_state_backups (user_id TEXT NOT NULL REFERENCES users(id), revision INTEGER NOT NULL, document TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(user_id,revision));`);
 const digest = token => createHash('sha256').update(token).digest('hex');
 const publicUser = row => ({id:row.id,name:row.name,email:row.email});
 // The legacy cookie name is still read so sessions created before the rename stay valid.
const cookieToken = req => { const cookies = req.headers.cookie?.split(';').map(s=>s.trim()) || []; const found = cookies.find(s=>s.startsWith('memorable_session=')) || cookies.find(s=>s.startsWith('skyvidya_session=')); return found ? found.slice(found.indexOf('=')+1) : ''; };
 const lookup = req => { const row=db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?').get(digest(cookieToken(req)),Date.now()); return row ? publicUser(row) : null; };
 const attempts = new Map();
 function authenticate(input, register, address) {
  const now=Date.now(); const recent=(attempts.get(address)||[]).filter(t=>now-t<15*60000);
  if(recent.length>=15) throw new Error('Muitas tentativas. Aguarde 15 minutos.');
  attempts.set(address,[...recent,now]);
  if(attempts.size>1000) for(const [key,times] of attempts) if(times.every(t=>now-t>=15*60000)) attempts.delete(key);
  const email=String(input.email||'').trim().toLowerCase(), password=input.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||typeof password!=='string'||password.length<12||password.length>128) throw new Error('Use um e-mail válido e uma senha de 12 a 128 caracteres.');
  let row=db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if(register) {
   const name=String(input.name||'').trim(); if(name.length<2||name.length>80) throw new Error('Informe um nome entre 2 e 80 caracteres.');
   if(row) throw new Error('Não foi possível criar a conta. Tente entrar com seus dados.');
   const setup=organizationSetup(input.organization,name);
   const salt=randomBytes(16).toString('hex'), hash=scryptSync(password,salt,64).toString('hex');
   row={id:randomUUID(),name,email};
   db.exec('BEGIN IMMEDIATE');
   try{
    const nowText=new Date().toISOString();
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(row.id,name,email,hash,salt,nowText);
    db.prepare('INSERT INTO account_state VALUES(?,?,?,?)').run(row.id,JSON.stringify(createAccountState(row,setup)),1,nowText);
    db.exec('COMMIT');
   }catch(error){db.exec('ROLLBACK');throw error;}
  } else {
   const hash=scryptSync(password,row?.salt||'unknown-account-salt',64);
   if(!row||!timingSafeEqual(hash,Buffer.from(row.password_hash,'hex'))) throw new Error('E-mail ou senha incorretos.');
  }
  attempts.delete(address);
  const token=randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now);
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),row.id,now+7*86400000);
  return {user:publicUser(row),token};
 }
 return {
  lookup, authenticate,
  revoke(req) { db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(cookieToken(req))); },
  read(user) {
   db.exec('BEGIN IMMEDIATE');
   try {
    const row=db.prepare('SELECT document,revision FROM account_state WHERE user_id=?').get(user.id);
    const saved=row?JSON.parse(row.document):null;
    if(saved?.accountSchemaVersion) {db.exec('COMMIT');return {state:saved,revision:row.revision};}
    const state=prepareAccountState(user,saved),revision=(row?.revision||0)+1,now=new Date().toISOString();
    if(row) db.prepare('INSERT OR IGNORE INTO account_state_backups VALUES(?,?,?,?)').run(user.id,row.revision,row.document,now);
    db.prepare('INSERT INTO account_state VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET document=excluded.document,revision=excluded.revision,updated_at=excluded.updated_at').run(user.id,JSON.stringify(state),revision,now);
    db.exec('COMMIT');return {state,revision};
   }catch(error){db.exec('ROLLBACK');throw error;}
  },
  backup(user) { const row=db.prepare('SELECT document,revision,created_at FROM account_state_backups WHERE user_id=? ORDER BY revision DESC LIMIT 1').get(user.id);return row?{state:JSON.parse(row.document),revision:row.revision,createdAt:row.created_at}:null; },
  workspaceActive(userId,workspace){const row=db.prepare('SELECT document FROM account_state WHERE user_id=?').get(userId);return Boolean(row&&JSON.parse(row.document).workspaces?.some(w=>w.id===workspace&&!w.archived));},
  save(user, input) {
   if(!input.state || !Array.isArray(input.state.pieces) || !Array.isArray(input.state.sources) || !Number.isInteger(input.revision)) throw new Error('Estado inválido.');
   const doc=JSON.stringify(input.state); if(Buffer.byteLength(doc)>8*1024*1024) throw new Error('O espaço excede 8 MB. Exporte os dados para reorganizar o acervo.');
   db.exec('BEGIN IMMEDIATE');
   try { const current=db.prepare('SELECT revision FROM account_state WHERE user_id=?').get(user.id)?.revision||0;
    if(current!==input.revision) { const error=new Error('Este espaço mudou em outra aba. Exporte suas alterações e recarregue antes de continuar.');error.status=409;throw error; }
    const revision=current+1;db.prepare('INSERT INTO account_state VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET document=excluded.document,revision=excluded.revision,updated_at=excluded.updated_at').run(user.id,doc,revision,new Date().toISOString());db.exec('COMMIT');return {revision};
   } catch(e){db.exec('ROLLBACK');throw e;}
  },
  close(){db.close();}
 };
}
export const sessionCookie = token => `memorable_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${token ? 604800 : 0}`;
