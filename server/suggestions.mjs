import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { suggestionStatus } from '../src/suggestion-status.mjs';
import { cookie } from './config.mjs';
import { openDb } from './sql.mjs';
export { suggestionStatus };

// Contributors suggest ideas to one organization without an account of their own: they never read
// the organization's document. Their identity, sessions and suggestions live in this separate store.
const clean = (value, max) => String(value || '').trim().slice(0, max);
const email = value => clean(value, 254).toLowerCase();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
const generatedPassword = () => randomBytes(12).toString('base64url');

export function createSuggestions(filename) {
  const db = openDb(filename, `PRAGMA journal_mode=WAL;
  CREATE TABLE IF NOT EXISTS contributors (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, area TEXT NOT NULL, workspaces TEXT NOT NULL, password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL, removed_at TEXT);
  CREATE TABLE IF NOT EXISTS contributor_sessions (token_hash TEXT PRIMARY KEY, contributor_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS suggestions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, contributor_id TEXT NOT NULL, workspace TEXT NOT NULL, title TEXT NOT NULL, why TEXT NOT NULL, knowledge TEXT NOT NULL, reference_url TEXT NOT NULL, reference_text TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL, source_id TEXT, decided_by TEXT, created_at TEXT NOT NULL, decided_at TEXT);`);
  const digest = token => createHash('sha256').update(token).digest('hex');
  const hash = (password, salt) => scryptSync(password, salt, 64).toString('hex');
  const contributorRow = row => row ? { id: row.id, ownerId: row.owner_id, name: row.name, email: row.email, area: row.area, workspaces: JSON.parse(row.workspaces), createdAt: row.created_at, removed: !!row.removed_at } : null;
  const suggestionRow = row => ({ id: row.id, contributorId: row.contributor_id, workspace: row.workspace, title: row.title, why: row.why, knowledge: row.knowledge, referenceUrl: row.reference_url, referenceText: row.reference_text, status: row.status, reason: row.reason, sourceId: row.source_id, decidedBy: row.decided_by, createdAt: row.created_at, decidedAt: row.decided_at });
  const cookieToken = req => { const found = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith('memorable_contributor=')); return found ? found.slice(found.indexOf('=') + 1) : ''; };
  const attempts = new Map();
  const contributor = async id => contributorRow(await db.get('SELECT * FROM contributors WHERE id=?', id));
  return {
    async lookup(req) {
      const row = await db.get('SELECT c.* FROM contributor_sessions s JOIN contributors c ON c.id=s.contributor_id WHERE token_hash=? AND expires_at>? AND c.removed_at IS NULL', digest(cookieToken(req)), Date.now());
      return contributorRow(row);
    },
    async login(input, address) {
      const now = Date.now(), recent = (attempts.get(address) || []).filter(t => now - t < 15 * 60000);
      if (recent.length >= 15) fail('Muitas tentativas. Aguarde 15 minutos.', 429);
      attempts.set(address, [...recent, now]);
      const row = await db.get('SELECT * FROM contributors WHERE email=? AND removed_at IS NULL', email(input.email));
      const given = Buffer.from(hash(String(input.password || ''), row?.salt || 'unknown-contributor-salt'), 'hex');
      if (!row || !timingSafeEqual(given, Buffer.from(row.password_hash, 'hex'))) fail('E-mail ou senha incorretos.', 401);
      attempts.delete(address);
      const token = randomBytes(32).toString('hex');
      await db.run('DELETE FROM contributor_sessions WHERE expires_at<=?', now);
      await db.run('INSERT INTO contributor_sessions VALUES(?,?,?)', digest(token), row.id, now + 7 * 86400000);
      return { contributor: contributorRow(row), token };
    },
    async revoke(req) { await db.run('DELETE FROM contributor_sessions WHERE token_hash=?', digest(cookieToken(req))); },
    // Team side: the organization owner manages who may suggest and for which brands.
    async list(ownerId) { return (await db.all('SELECT * FROM contributors WHERE owner_id=? AND removed_at IS NULL ORDER BY created_at DESC', ownerId)).map(contributorRow); },
    async invite(ownerId, input, activeWorkspaces) {
      const name = clean(input.name, 80), address = email(input.email), area = clean(input.area, 80);
      const workspaces = [...new Set((input.workspaces || []).filter(w => activeWorkspaces.includes(w)))];
      if (name.length < 2) fail('Informe o nome do colaborador.');
      if (!validEmail(address)) fail('Informe um e-mail válido.');
      if (area.length < 2) fail('Informe a área do colaborador (ex.: RH, Tributário).');
      if (!workspaces.length) fail('Escolha ao menos uma marca para as sugestões.');
      const existing = await db.get('SELECT * FROM contributors WHERE email=?', address);
      if (existing && !existing.removed_at) fail('Este e-mail já é de um colaborador.');
      const password = generatedPassword(), salt = randomBytes(16).toString('hex'), id = existing?.id || randomUUID();
      const values = [ownerId, name, area, JSON.stringify(workspaces), hash(password, salt), salt, new Date().toISOString()];
      // A removed contributor invited again keeps the same id, so their past suggestions stay attributed.
      if (existing) await db.run('UPDATE contributors SET owner_id=?,name=?,area=?,workspaces=?,password_hash=?,salt=?,created_at=?,removed_at=NULL WHERE id=?', ...values, id);
      else await db.run('INSERT INTO contributors VALUES(?,?,?,?,?,?,?,?,?,NULL)', id, values[0], values[1], address, ...values.slice(2));
      return { contributor: await contributor(id), password };
    },
    async remove(ownerId, id) {
      const found = await contributor(id);
      if (!found || found.ownerId !== ownerId) fail('Colaborador não encontrado.', 404);
      await db.run('UPDATE contributors SET removed_at=? WHERE id=?', new Date().toISOString(), id);
      await db.run('DELETE FROM contributor_sessions WHERE contributor_id=?', id);
      return { ok: true };
    },
    async forOwner(ownerId) {
      const people = new Map((await db.all('SELECT * FROM contributors WHERE owner_id=?', ownerId)).map(r => [r.id, contributorRow(r)]));
      return (await db.all('SELECT * FROM suggestions WHERE owner_id=? ORDER BY created_at DESC', ownerId)).map(row => {
        const s = suggestionRow(row), person = people.get(s.contributorId);
        return { ...s, author: person ? { name: person.name, area: person.area, removed: person.removed } : { name: 'Colaborador removido', area: '', removed: true } };
      });
    },
    // The team accepts only after creating the reference in its own document, so the source id is known.
    async decide(ownerId, input, decidedBy) {
      const row = await db.get('SELECT * FROM suggestions WHERE id=? AND owner_id=?', String(input.id || ''), ownerId);
      if (!row) fail('Sugestão não encontrada.', 404);
      if (row.status !== 'received') fail('Esta sugestão já foi decidida.', 409);
      const reason = clean(input.reason, 500);
      if (input.decision === 'declined' && reason.length < 5) fail('Explique ao colaborador por que a ideia não seguiu.');
      if (input.decision === 'accepted' && !clean(input.sourceId, 80)) fail('Vincule a referência antes de aceitar.');
      if (!['accepted', 'declined'].includes(input.decision)) fail('Decisão inválida.');
      await db.run('UPDATE suggestions SET status=?,reason=?,source_id=?,decided_by=?,decided_at=? WHERE id=?', input.decision, reason, input.decision === 'accepted' ? clean(input.sourceId, 80) : null, clean(decidedBy, 80), new Date().toISOString(), row.id);
      return suggestionRow(await db.get('SELECT * FROM suggestions WHERE id=?', row.id));
    },
    // Contributor side: only their own suggestions, for brands the owner allowed and still keeps active.
    async mine(person) { return (await db.all('SELECT * FROM suggestions WHERE contributor_id=? AND owner_id=? ORDER BY created_at DESC', person.id, person.ownerId)).map(suggestionRow); },
    async submit(person, input, activeWorkspaces) {
      const workspace = String(input.workspace || '');
      if (!person.workspaces.includes(workspace) || !activeWorkspaces.includes(workspace)) fail('Escolha uma das marcas liberadas para você.', 403);
      const title = clean(input.title, 140), why = clean(input.why, 2000), referenceText = clean(input.referenceText, 6000);
      const referenceUrl = clean(input.referenceUrl, 600), knowledge = input.knowledge === 'link' ? 'link' : 'experience';
      if (title.length < 5) fail('Escreva o assunto da ideia em uma frase.');
      if (why.length < 20) fail('Conte em poucas linhas por que este assunto importa agora.');
      if (referenceUrl && !/^https?:\/\/[^\s]+$/i.test(referenceUrl)) fail('Use um link começando com https://.');
      if (knowledge === 'link' && !referenceUrl) fail('Cole o link da referência ou escolha “Sei disso pela minha experiência”.');
      const recent = (await db.get('SELECT COUNT(*) AS n FROM suggestions WHERE contributor_id=? AND created_at>?', person.id, new Date(Date.now() - 86400000).toISOString())).n;
      if (recent >= 20) fail('Limite de 20 sugestões por dia atingido.', 429);
      const id = randomUUID();
      await db.run("INSERT INTO suggestions VALUES(?,?,?,?,?,?,?,?,?,'received','',NULL,NULL,?,NULL)", id, person.ownerId, person.id, workspace, title, why, knowledge, referenceUrl, referenceText, new Date().toISOString());
      return suggestionRow(await db.get('SELECT * FROM suggestions WHERE id=?', id));
    },
    close() { return db.close(); },
  };
}
export const contributorCookie = token => cookie('memorable_contributor', token);
