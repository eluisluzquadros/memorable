import test from "node:test";
import assert from "node:assert/strict";
import { checkGroupCoherence } from "../server/group.mjs";
import { groupContext } from "../src/operations.mjs";

const brands = [
  { name: "BBMD Advogados", voice: { positioning: "Advocacia trabalhista para trabalhadores" } },
  { name: "2B Juris", voice: { positioning: "Conecta pessoas a escritórios" } },
  { name: "Sem ficha", voice: {} },
];

test("coherence names the brands involved and closes with one recommendation for the group", async () => {
  let seen;
  const model = async (_s, data) => {
    seen = data;
    return {
      problemas: [{ tipo: "compliance", marcas: ["2B Juris", "BBMD Advogados", "Inventada"], problema: "Indicação entre marcas do grupo pode parecer captação.", gravidade: "alta" }],
      recomendacao: "Separe a comunicação da 2B Juris da do BBMD e declare a relação societária.",
      regrasSugeridas: ["Nenhuma marca indica outra como prestadora do serviço."],
    };
  };
  const result = await checkGroupCoherence({ group: { name: "Grupo BBMD", rules: "" }, brands }, model);
  assert.deepEqual(seen.marcas.map((b) => b.nome), ["BBMD Advogados", "2B Juris"]);
  assert.deepEqual(result.problems[0].brands, ["2B Juris", "BBMD Advogados"]);
  assert.equal(result.problems[0].kind, "compliance");
  assert.match(result.recommendation, /relação societária/);
  assert.equal(result.suggestedRules.length, 1);
  await assert.rejects(checkGroupCoherence({ group: { name: "G" }, brands: brands.slice(0, 1) }, model), /duas marcas/);
});

test("the group's rules travel with every brand only once they are written, with the sibling brands", () => {
  const state = { workspace: "bbmd", organizationName: "Grupo BBMD", workspaces: [{ id: "bbmd", name: "BBMD Advogados" }, { id: "juris", name: "2B Juris" }, { id: "old", name: "Antiga", archived: true }], voices: { juris: { positioning: "Conecta pessoas a escritórios" } } };
  assert.equal(groupContext(state), null);
  const group = groupContext({ ...state, groupDNA: { rules: "Nenhuma marca promete resultado." } });
  assert.equal(group.rules, "Nenhuma marca promete resultado.");
  assert.deepEqual(group.siblings, [{ name: "2B Juris", positioning: "Conecta pessoas a escritórios" }]);
});
