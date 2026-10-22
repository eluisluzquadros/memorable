import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSuggestions, suggestionStatus } from "../server/suggestions.mjs";

const store = () => createSuggestions(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "memorable-suggestions-")), "s.sqlite"));
const request = (cookie = "") => ({ headers: { cookie } });
const idea = { workspace: "juris", title: "Nova decisão do STJ sobre ITCMD", why: "Muda o planejamento sucessório de clientes com imóveis no exterior.", knowledge: "experience" };

test("a contributor logs in with the generated password and only for allowed, active brands", () => {
  const s = store();
  const { contributor, password } = s.invite("owner", { name: "Ana", email: "ANA@bbmd.com", area: "Tributário", workspaces: ["juris", "fantasma"] }, ["juris", "bbmd"]);
  assert.deepEqual(contributor.workspaces, ["juris"]);
  assert.throws(() => s.login({ email: "ana@bbmd.com", password: "errada" }, "ip"), /incorretos/);
  const { token } = s.login({ email: "ana@bbmd.com", password }, "ip");
  const person = s.lookup(request(`memorable_contributor=${token}`));
  assert.equal(person.name, "Ana");
  assert.equal(s.lookup(request(`memorable_session=${token}`)), null);
  assert.throws(() => s.submit(person, { ...idea, workspace: "bbmd" }, ["juris", "bbmd"]), /liberadas/);
  assert.throws(() => s.submit(person, idea, ["bbmd"]), /liberadas/);
  assert.equal(s.submit(person, idea, ["juris"]).status, "received");
});

test("the reference is optional unless the contributor says they have a link", () => {
  const s = store();
  const { password } = s.invite("owner", { name: "Rui", email: "rui@bbmd.com", area: "RH", workspaces: ["bbmd"] }, ["bbmd"]);
  const person = s.lookup(request(`memorable_contributor=${s.login({ email: "rui@bbmd.com", password }, "ip").token}`));
  const base = { ...idea, workspace: "bbmd" };
  assert.ok(s.submit(person, base, ["bbmd"]).id);
  assert.throws(() => s.submit(person, { ...base, knowledge: "link" }, ["bbmd"]), /Cole o link/);
  assert.throws(() => s.submit(person, { ...base, knowledge: "link", referenceUrl: "javascript:alert(1)" }, ["bbmd"]), /https/);
  assert.throws(() => s.submit(person, { ...base, why: "curto" }, ["bbmd"]), /por que/);
});

test("each owner sees only their contributors' suggestions and decides once", () => {
  const s = store();
  const { password } = s.invite("owner", { name: "Ana", email: "ana@bbmd.com", area: "Tributário", workspaces: ["juris"] }, ["juris"]);
  const person = s.lookup(request(`memorable_contributor=${s.login({ email: "ana@bbmd.com", password }, "ip").token}`));
  const made = s.submit(person, idea, ["juris"]);
  assert.equal(s.forOwner("outro").length, 0);
  assert.equal(s.forOwner("owner")[0].author.area, "Tributário");
  assert.throws(() => s.decide("outro", { id: made.id, decision: "declined", reason: "Fora do foco" }), /não encontrada/);
  assert.throws(() => s.decide("owner", { id: made.id, decision: "accepted" }), /referência/);
  assert.throws(() => s.decide("owner", { id: made.id, decision: "declined" }), /Explique/);
  assert.equal(s.decide("owner", { id: made.id, decision: "accepted", sourceId: "src-1" }, "Gestora").sourceId, "src-1");
  assert.throws(() => s.decide("owner", { id: made.id, decision: "declined", reason: "Mudou de ideia" }), /já foi decidida/);
});

test("removing a contributor ends their session; status follows the content made from the reference", () => {
  const s = store();
  const { contributor, password } = s.invite("owner", { name: "Ana", email: "ana@bbmd.com", area: "Tributário", workspaces: ["juris"] }, ["juris"]);
  const cookie = `memorable_contributor=${s.login({ email: "ana@bbmd.com", password }, "ip").token}`;
  assert.throws(() => s.remove("outro", contributor.id), /não encontrado/);
  s.remove("owner", contributor.id);
  assert.equal(s.lookup(request(cookie)), null);
  const accepted = { status: "accepted", sourceId: "src-1" };
  assert.equal(suggestionStatus(accepted, []).label, "Aceita");
  assert.equal(suggestionStatus(accepted, [{ sourceIds: ["src-1"], status: "Rascunho" }]).label, "Em produção");
  assert.deepEqual(suggestionStatus(accepted, [{ sourceIds: ["src-1"], status: "Publicado", liveUrl: "https://linkedin.com/x" }]), { label: "Publicada", link: "https://linkedin.com/x" });
  assert.equal(suggestionStatus({ status: "declined" }).label, "Não seguiu");
});
