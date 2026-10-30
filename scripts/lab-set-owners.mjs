// Records which accounts' material each EXP-308 round used (config.accounts): those accounts open the
// texts; everyone else sees the public benchmark only. Safe to run again.
//   node --env-file=.env scripts/lab-set-owners.mjs
process.env.MEMORAVEL_DB = "postgres";
const { createLabStore } = await import("../server/lab.mjs");
const { closePool } = await import("../server/sql.mjs");
const BBMD = "593efd79-f6a5-422c-9080-9422455c5241", SKY = "2fea9c15-0530-49fb-960c-c18b5f7f69a3";
const store = createLabStore();
for (const run of await store.runs()) {
  if (run.experiment !== "EXP-308" || run.status === "running") continue;
  const accounts = [...new Set([...(run.config?.accounts || []), BBMD, SKY])];
  await store.saveRun({ ...run, config: { ...run.config, accounts } });
  console.log(`${run.id}: aberta para ${accounts.length} contas`);
}
await closePool();
