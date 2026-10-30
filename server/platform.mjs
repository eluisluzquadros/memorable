// The team that runs the platform (Memorável itself), as opposed to the customers' accounts.
// One JSON value in service_state (SQLite on a laptop, Postgres in the cloud, no migration needed):
//   admins       e-mails of platform administrators (an e-mail can be named before its account exists)
//   modelPolicy  who writes, reviews and judges for every account (customers do not pick models)
// MEMORAVEL_PLATFORM_ADMINS (comma-separated e-mails) adds administrators without touching the database.
const KEY = "platform";
const ROLES = ["writer", "reviewer", "judge"];
const normalize = (email) => String(email || "").trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only known models, only the roles the platform has; anything else is refused instead of ignored.
export function sanitizePolicy(input = {}, isKnown = () => true) {
  const policy = {};
  for (const role of ROLES) {
    const model = input?.[role];
    if (model == null || model === "") continue;
    if (typeof model !== "string" || !isKnown(model)) throw new Error(`Modelo fora do catálogo da plataforma: ${model}`);
    policy[role] = model;
  }
  const byFormat = {};
  for (const [format, model] of Object.entries(input?.writerByFormat || {})) {
    if (model == null || model === "") continue;
    if (!format || format.length > 60 || typeof model !== "string" || !isKnown(model)) throw new Error(`Redator inválido para ${format.slice(0, 60)}.`);
    byFormat[format] = model;
  }
  if (Object.keys(byFormat).length) policy.writerByFormat = byFormat;
  return policy;
}

export function createPlatform(db, { env = process.env, ttlMs = 15000, now = () => Date.now() } = {}) {
  let cache = null, loadedAt = 0;
  async function load() {
    if (cache && now() - loadedAt < ttlMs) return cache;
    const row = await db.get("SELECT value FROM service_state WHERE key=?", KEY);
    let doc = {};
    try { doc = row ? JSON.parse(row.value) : {}; } catch { doc = {}; }
    cache = doc && typeof doc === "object" ? doc : {};
    loadedAt = now();
    return cache;
  }
  async function save(doc) {
    await db.run("INSERT INTO service_state VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at", KEY, JSON.stringify(doc), new Date(now()).toISOString());
    cache = doc;
    loadedAt = now();
  }
  const fromEnv = () => String(env.MEMORAVEL_PLATFORM_ADMINS || "").split(",").map(normalize).filter(Boolean);
  const admins = async () => [...new Set([...fromEnv(), ...((await load()).admins || []).map(normalize)])];
  return {
    admins,
    isAdmin: async (user) => Boolean(user?.email) && (await admins()).includes(normalize(user.email)),
    async addAdmin(email) {
      const address = normalize(email);
      if (!EMAIL.test(address)) throw new Error("Informe um e-mail válido.");
      const doc = await load();
      await save({ ...doc, admins: [...new Set([...(doc.admins || []).map(normalize), address])] });
      return address;
    },
    async removeAdmin(email) {
      const address = normalize(email), doc = await load();
      await save({ ...doc, admins: (doc.admins || []).map(normalize).filter((a) => a !== address) });
    },
    modelPolicy: async () => ((await load()).modelPolicy) || {},
    async setModelPolicy(input, isKnown) {
      const modelPolicy = sanitizePolicy(input, isKnown);
      await save({ ...(await load()), modelPolicy });
      return modelPolicy;
    },
  };
}
