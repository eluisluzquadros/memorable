import test from "node:test";
import assert from "node:assert/strict";
import { refinePiece } from "../server/refine.mjs";

const packet = {
  brand: { name: "Skyvidya" },
  voice: { tone: "Claro e técnico" },
  brandDNA: { positioning: "Dados climáticos validados no território" },
  brief: { title: "Base climática validada", format: "LinkedIn", brandName: "Skyvidya" },
  sources: [{ id: "irb", title: "Estudo IRB", origin: "IRB(Re)", text: "A fonte de dados precisa ser validada no território, no tipo de variável e no uso de negócio pretendido." }],
};
const piece = { title: "Base climática validada", format: "LinkedIn", body: "Escolher uma base climática pela fama é arriscado. A fonte de dados precisa ser validada no território, no tipo de variável e no uso de negócio pretendido. Fale com a Skyvidya." };
const role = (name, fn) => ({ name, model: async (system, data) => fn(system, data) });
const reviewer = role("rev", () => ({ problemas: [{ problema: "Chamada genérica", trecho: "Fale com a Skyvidya.", gravidade: "média" }], recomendacao: "Feche dizendo o que a Skyvidya entrega e mantenha a fonte." }));
const writer = role("wri", () => ({ body: piece.body.replace("Fale com a Skyvidya.", "A Skyvidya valida sua base no território antes de você decidir."), mudancas: ["Chamada concreta"] }));

test("problems, one general recommendation and the revised version come back with the models used", async () => {
  const judge = role("jud", (system, data) => {
    const revisedIsA = data.A.includes("valida sua base");
    const strong = { clareza: 5, evidencia: 5, voz: 5, utilidade: 5 }, weak = { clareza: 4, evidencia: 5, voz: 3, utilidade: 3 };
    return { A: revisedIsA ? strong : weak, B: revisedIsA ? weak : strong, preferida: revisedIsA ? "A" : "B", motivo: "Chamada mais útil" };
  });
  const result = await refinePiece(packet, piece, { reviewer, writer, judge });
  assert.equal(result.problems[0].problem, "Chamada genérica");
  assert.match(result.recommendation, /o que a Skyvidya entrega/);
  assert.match(result.revised.body, /valida sua base/);
  assert.equal(result.judge.winner, "revisada");
  assert.equal(result.judge.revised.voz, 5);
  assert.deepEqual(result.models, { reviewer: "rev", writer: "wri", judge: "jud" });
});

test("a critique without the general recommendation is refused and a judge failure keeps the paid work", async () => {
  const bare = role("rev", () => ({ problemas: [{ problema: "Chamada genérica" }] }));
  await assert.rejects(refinePiece(packet, piece, { reviewer: bare, writer, judge: writer }), /recomendação geral/);
  const broken = role("jud", () => ({ A: { clareza: 9 } }));
  const result = await refinePiece(packet, piece, { reviewer, writer, judge: broken });
  assert.match(result.judge.error, /notas incompletas/);
  assert.match(result.revised.body, /valida sua base/);
});
