// One async interface over two databases: SQLite (laptop and tests) and Postgres (Supabase in the cloud).
// Stores write SQLite-flavoured SQL with "?" placeholders; for Postgres the few differences are translated
// here, and tables live in the private "memoravel" schema (supabase/migrations).
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import pg from "pg";

const TABLES = "users|sessions|account_state|account_state_backups|contributors|contributor_sessions|suggestions|connections|jobs|llm_calls|service_state";
// Rows come back as the stores already expect them: JSON and timestamps as text, counts as numbers.
pg.types.setTypeParser(114, (v) => v); // json
pg.types.setTypeParser(3802, (v) => v); // jsonb
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz
pg.types.setTypeParser(20, Number); // bigint: epoch milliseconds and COUNT(*)
pg.types.setTypeParser(1700, Number); // numeric: cost

export function toPostgres(sql) {
  let n = 0;
  let out = sql
    .replace(new RegExp(`\\b(FROM|INTO|UPDATE|JOIN)\\s+(${TABLES})\\b`, "gi"), (_m, k, t) => `${k} memoravel.${t}`)
    .replace(/\bINSERT OR IGNORE INTO\b/gi, "INSERT INTO")
    .replace(/\bIS \?/g, "IS NOT DISTINCT FROM ?")
    .replace(/\?/g, () => `$${++n}`);
  if (/^\s*INSERT OR IGNORE/i.test(sql)) out += " ON CONFLICT DO NOTHING";
  return out;
}

function sqliteDb(filename, schema) {
  const db = new DatabaseSync(filename);
  if (schema) db.exec(schema);
  const q = {
    dialect: "sqlite",
    get: async (sql, ...params) => db.prepare(sql).get(...params) ?? null,
    all: async (sql, ...params) => db.prepare(sql).all(...params),
    run: async (sql, ...params) => { db.prepare(sql).run(...params); },
  };
  // node:sqlite is synchronous, so transactions run one after another on this connection.
  let chain = Promise.resolve();
  const tx = (fn) => {
    const next = chain.then(async () => {
      db.exec("BEGIN IMMEDIATE");
      try { const result = await fn(q); db.exec("COMMIT"); return result; }
      catch (error) { db.exec("ROLLBACK"); throw error; }
    });
    chain = next.catch(() => {});
    return next;
  };
  return { ...q, tx, close: async () => db.close() };
}

// Supabase signs its database certificate with its own authority. Download it in Project Settings >
// Database > SSL Configuration and save it as supabase/ca.crt (a public certificate, safe in Git), or give
// MEMORAVEL_DB_CA (PEM text or a file path). The certificate is always verified.
const BUNDLED_CA = new URL("../supabase/ca.crt", import.meta.url);
function tlsOptions() {
  const ca = process.env.MEMORAVEL_DB_CA?.trim();
  if (ca) return { rejectUnauthorized: true, ca: ca.includes("BEGIN CERTIFICATE") ? ca.replace(/\\n/g, "\n") : fs.readFileSync(ca, "utf8") };
  if (fs.existsSync(BUNDLED_CA)) return { rejectUnauthorized: true, ca: fs.readFileSync(BUNDLED_CA, "utf8") };
  return { rejectUnauthorized: true };
}

let pool = null;
function postgresDb(url) {
  pool ||= new pg.Pool({
    // sslmode in the URL would override the options below, so the TLS settings come only from here.
    connectionString: url.replace(/([?&])sslmode=[^&]*&?/, "$1").replace(/[?&]$/, ""),
    ssl: tlsOptions(),
    max: Number(process.env.MEMORAVEL_DB_POOL) || 5,
    idleTimeoutMillis: 30000,
  });
  const on = (client) => ({
    dialect: "postgres",
    get: async (sql, ...params) => (await client.query(toPostgres(sql), params)).rows[0] ?? null,
    all: async (sql, ...params) => (await client.query(toPostgres(sql), params)).rows,
    run: async (sql, ...params) => { await client.query(toPostgres(sql), params); },
  });
  const tx = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(on(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  };
  return { ...on(pool), tx, close: async () => {} };
}

// Postgres is an explicit choice (MEMORAVEL_DB=postgres), so having the URL in .env never moves the
// laptop off its local data by accident.
export const usingPostgres = () => process.env.MEMORAVEL_DB === "postgres" && Boolean(process.env.SUPABASE_DB_URL?.trim());

// The SQLite schema is created on open; the Postgres schema is applied once as a migration.
export function openDb(sqliteFile, sqliteSchema) {
  return usingPostgres() ? postgresDb(process.env.SUPABASE_DB_URL.trim()) : sqliteDb(sqliteFile, sqliteSchema);
}

export async function closePool() {
  if (pool) { await pool.end(); pool = null; }
}
