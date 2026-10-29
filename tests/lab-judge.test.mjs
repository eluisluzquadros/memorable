import test from "node:test";
import assert from "node:assert/strict";
import { evidencePack, briefAnomaly } from "../scripts/lab-judge.mjs";
import { contextPacket } from "../src/operations.mjs";
import { createAccountState } from "../src/account-state.mjs";

test("the judge sees every source and every piece of brand material the writer received, in full", () => {
  const state = createAccountState({ id: "u", name: "Marca Teste", email: "t@example.test" });
  const long = "Fonte longa. ".repeat(1200); // past any old cut (6.000 characters)
  const source = { id: "s1", workspace: state.workspace, title: "Notícia", text: long, origin: "Jornal", citable: true, date: "2026-10-01" };
  const dna = { approvedAt: "2026-10-01", positioning: "Marca que transforma risco em resiliência com dados validados em campo.", excerpt: "Site oficial: atuamos em seguros e crédito rural. ".repeat(40), sources: ["https://exemplo.org"] };
  const packet = contextPacket({ ...state, sources: [source], brandDNA: { [state.workspace]: dna } }, { title: "Pauta", format: "Artigo", sourceIds: ["s1"], deadline: "2026-11-10" });
  assert.ok(packet.brandKnowledge.length > 0, "the writer has brand material in this scenario");
  const pack = evidencePack(packet);
  for (const s of packet.sources) assert.equal(pack.sources.find((x) => x.id === s.id)?.text, s.text, `source ${s.id} complete`);
  for (const k of packet.brandKnowledge) assert.equal(pack.brandKnowledge.find((x) => x.id === k.id)?.text, k.text, `brand material ${k.id} complete`);
});

test("a piece where every writer scores low on evidence, or where judges split, stops the round", () => {
  const low = { a: { j1: { evidencia: 1, mean: 3 }, j2: { evidencia: 2, mean: 3 } }, b: { j1: { evidencia: 2, mean: 3.5 }, j2: { evidencia: 2, mean: 3.5 } } };
  assert.equal(briefAnomaly(low).kind, "evidence");
  const split = { a: { j1: { evidencia: 4, mean: 5 }, j2: { evidencia: 4, mean: 2.5 } }, b: { j1: { evidencia: 4, mean: 4.75 }, j2: { evidencia: 4, mean: 2.5 } } };
  assert.equal(briefAnomaly(split).kind, "judges");
  const fine = { a: { j1: { evidencia: 4, mean: 4.5 }, j2: { evidencia: 5, mean: 4.25 } }, b: { j1: { evidencia: 2, mean: 3.5 }, j2: { evidencia: 4, mean: 4 } } };
  assert.equal(briefAnomaly(fine), null);
});
