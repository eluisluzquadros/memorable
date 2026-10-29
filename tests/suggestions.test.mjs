import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSuggestions, suggestionStatus } from "../server/suggestions.mjs";

const store = () => createSuggestions(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "memorable-suggestions-")), "s.sqlite"));
const request = (cookie = "") => ({ headers: { cookie } });
const idea = { workspace: "juris", title: "Nova decisão do STJ sobre ITCMD", why: "Muda o planejamento sucessório de clientes com imóveis no exterior.", knowledge: "experience" };

test("a contributor logs in with the generated password and only for allowed, active brands", async () => {
  const s = store();
  const { contributor, password } = await s.invite("owner", { name: "Ana", email: "ANA@bbmd.com", area: "Tributário", workspaces: ["juris", "fantasma"] }, ["juris", "bbmd"]);
  assert.deepEqual(contributor.workspaces, ["juris"]);
  await assert.rejects(s.login({ email: "ana@bbmd.com", password: "errada" }, "ip"), /incorretos/);
  const { token } = await s.login({ email: "ana@bbmd.com", password }, "ip");
  const person = await s.lookup(request(`memorable_contributor=${token}`));
  assert.equal(person.name, "Ana");
  assert.equal(await s.lookup(request(`memorable_session=${token}`)), null);
  await assert.rejects(s.submit(person, { ...idea, workspace: "bbmd" }, ["juris", "bbmd"]), /liberadas/);
  await assert.rejects(s.submit(person, idea, ["bbmd"]), /liberadas/);
  assert.equal((await s.submit(person, idea, ["juris"])).status, "received");
});

test("the reference is optional unless the contributor says they have a link", async () => {
  const s = store();
  const { password } = await s.invite("owner", { name: "Rui", email: "rui@bbmd.com", area: "RH", workspaces: ["bbmd"] }, ["bbmd"]);
  const person = await s.lookup(request(`memorable_contributor=${(await s.login({ email: "rui@bbmd.com", password }, "ip")).token}`));
  const base = { ...idea, workspace: "bbmd" };
  assert.ok((await s.submit(person, base, ["bbmd"])).id);
  await assert.rejects(s.submit(person, { ...base, knowledge: "link" }, ["bbmd"]), /Cole o link/);
  await assert.rejects(s.submit(person, { ...base, knowledge: "link", referenceUrl: "javascript:alert(1)" }, ["bbmd"]), /https/);
  await assert.rejects(s.submit(person, { ...base, why: "curto" }, ["bbmd"]), /por que/);
});

test("each owner sees only their contributors' suggestions and decides once", async () => {
  const s = store();
  const { password } = await s.invite("owner", { name: "Ana", email: "ana@bbmd.com", area: "Tributário", workspaces: ["juris"] }, ["juris"]);
  const person = await s.lookup(request(`memorable_contributor=${(await s.login({ email: "ana@bbmd.com", password }, "ip")).token}`));
  const made = await s.submit(person, idea, ["juris"]);
  assert.equal((await s.forOwner("outro")).length, 0);
  assert.equal((await s.forOwner("owner"))[0].author.area, "Tributário");
  await assert.rejects(s.decide("outro", { id: made.id, decision: "declined", reason: "Fora do foco" }), /não encontrada/);
  await assert.rejects(s.decide("owner", { id: made.id, decision: "accepted" }), /referência/);
  await assert.rejects(s.decide("owner", { id: made.id, decision: "declined" }), /Explique/);
  assert.equal((await s.decide("owner", { id: made.id, decision: "accepted", sourceId: "src-1" }, "Gestora")).sourceId, "src-1");
  await assert.rejects(s.decide("owner", { id: made.id, decision: "declined", reason: "Mudou de ideia" }), /já foi decidida/);
});

test("removing a contributor ends their session; status follows the content made from the reference", async () => {
  const s = store();
  const { contributor, password } = await s.invite("owner", { name: "Ana", email: "ana@bbmd.com", area: "Tributário", workspaces: ["juris"] }, ["juris"]);
  const cookie = `memorable_contributor=${(await s.login({ email: "ana@bbmd.com", password }, "ip")).token}`;
  await assert.rejects(s.remove("outro", contributor.id), /não encontrado/);
  await s.remove("owner", contributor.id);
  assert.equal(await s.lookup(request(cookie)), null);
  const accepted = { status: "accepted", sourceId: "src-1" };
  assert.equal(suggestionStatus(accepted, []).label, "Aceita");
  assert.equal(suggestionStatus(accepted, [{ sourceIds: ["src-1"], status: "Rascunho" }]).label, "Em produção");
  assert.deepEqual(suggestionStatus(accepted, [{ sourceIds: ["src-1"], status: "Publicado", liveUrl: "https://linkedin.com/x" }]), { label: "Publicada", link: "https://linkedin.com/x" });
  assert.equal(suggestionStatus({ status: "declined" }).label, "Não seguiu");
});
