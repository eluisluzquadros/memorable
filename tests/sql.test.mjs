import test from "node:test";
import assert from "node:assert/strict";
import { toPostgres } from "../server/sql.mjs";

test("SQLite statements become Postgres statements in the private schema", () => {
  assert.equal(toPostgres("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?"),
    "SELECT u.* FROM memoravel.sessions s JOIN memoravel.users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>$2");
  assert.equal(toPostgres("INSERT OR IGNORE INTO account_state_backups VALUES(?,?,?,?)"),
    "INSERT INTO memoravel.account_state_backups VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING");
  assert.equal(toPostgres("SELECT * FROM llm_calls WHERE at >= ? AND owner IS ?"),
    "SELECT * FROM memoravel.llm_calls WHERE at >= $1 AND owner IS NOT DISTINCT FROM $2");
  assert.equal(toPostgres("UPDATE jobs SET data=? WHERE owner=? AND id=?"), "UPDATE memoravel.jobs SET data=$1 WHERE owner=$2 AND id=$3");
  // Column names that match a table name are left alone.
  assert.equal(toPostgres("SELECT id FROM suggestions WHERE source_id=? ORDER BY created_at"), "SELECT id FROM memoravel.suggestions WHERE source_id=$1 ORDER BY created_at");
});
