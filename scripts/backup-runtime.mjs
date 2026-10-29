// Consistent copy of the local data (.runtime) before risky changes: SQLite via VACUUM INTO, files copied.
// node scripts/backup-runtime.mjs [pasta-destino]
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dest = path.resolve(process.argv[2] || `.runtime-backup-${stamp}`);
fs.mkdirSync(dest, { recursive: true });
for (const name of fs.readdirSync(".runtime")) {
  const from = path.join(".runtime", name);
  if (name.endsWith(".sqlite")) {
    const db = new DatabaseSync(from, { readOnly: true });
    db.exec(`VACUUM INTO '${path.join(dest, name).replaceAll("'", "''")}'`);
    db.close();
  } else if (!/-(wal|shm)$/.test(name) && fs.statSync(from).isFile()) fs.copyFileSync(from, path.join(dest, name));
}
for (const name of fs.readdirSync(dest)) console.log(`${name} ${fs.statSync(path.join(dest, name)).size} B`);
console.log(`Backup em ${dest}`);
