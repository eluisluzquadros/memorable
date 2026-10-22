import test from "node:test";
import assert from "node:assert/strict";
import { keyPageLinks, proposeVoice } from "../server/brand-voice.mjs";

test("key pages are same-origin brand pages, never legal, media or external links", () => {
  const html = `<a href="/sobre-nos/">Sobre nós</a><a href="https://www.bbmd.adv.br/areas-de-atuacao">Áreas de atuação</a>
    <a href="/politica-de-privacidade">Privacidade</a><a href="https://instagram.com/bbmd">Instagram</a>
    <a href="/wp-content/uploads/x.pdf">Cartilha</a><a href="/blog/post-1">Post</a><a href="/equipe">Nossa equipe</a>`;
  const links = keyPageLinks(html, "https://www.bbmd.adv.br/");
  assert.deepEqual(links.sort(), ["https://www.bbmd.adv.br/areas-de-atuacao", "https://www.bbmd.adv.br/equipe", "https://www.bbmd.adv.br/sobre-nos"]);
});

test("every voice field is proposed with evidence, and invented examples are dropped", async () => {
  const pages = [{ url: "https://www.bbmd.adv.br/", text: "Não importa a batalha, mas quem estará nela com você. Conte com o nosso escritório para assegurar seus direitos trabalhistas em todo o país." }];
  const model = async () => ({
    tone: "Firme e acolhedor",
    audience: "Trabalhadores que precisam defender direitos",
    positioning: "Especialistas em Direito do Trabalho",
    pillars: ["Direitos trabalhistas", "Atendimento próximo", "Atuação nacional"],
    say: ["Seus direitos", "Estaremos com você"],
    avoid: ["Garantia de vitória", "Captação de clientela"],
    examples: ["Não importa a batalha, mas quem estará nela com você.", "Vencemos 100% das causas no último ano."],
    checklist: ["Sem promessa de resultado", "Linguagem clara"],
    evidence: { tone: { quote: "Não importa a batalha", url: "https://www.bbmd.adv.br/", status: "observado" } },
  });
  const { voice, evidence, notes } = await proposeVoice({ brandName: "BBMD Advogados", pages }, model);
  assert.equal(voice.pillars.split("\n").length, 3);
  assert.equal(voice.examples, "Não importa a batalha, mas quem estará nela com você.");
  assert.match(notes[0], /descartados/);
  assert.equal(evidence.tone.status, "observed");
  assert.equal(evidence.avoid.status, "suggested");
  assert.ok(["tone", "audience", "positioning", "pillars", "say", "avoid", "examples", "checklist"].every((k) => voice[k]));
});

test("a brand without a website gets its DNA from the interview and its own materials", async () => {
  const { extractBrand } = await import("../server/brand.mjs");
  const interview = "Pergunta: O que vocês fazem e vendem?\nResposta: Assessoria jurídica para escritórios parceiros em todo o Brasil.\nPergunta: Como vocês falam com o cliente?\nResposta: Direto, técnico e cordial.";
  let seen;
  const voiceModel = { name: "fake", model: async (_s, data) => { seen = data; return { tone: "Direto, técnico e cordial", positioning: "Assessoria para escritórios parceiros", evidence: { tone: { quote: "Direto, técnico e cordial.", url: "Entrevista da marca", status: "observado" } } }; } };
  const dna = await extractBrand({ brandName: "Esfera Legal", materials: [{ title: "Entrevista da marca", origin: "Entrevista da marca", text: interview }] }, { voiceModel, getPublic: () => { throw new Error("no network"); } });
  assert.equal(seen.marca, "Esfera Legal");
  assert.equal(seen.corpus[0].url, "Entrevista da marca");
  assert.equal(dna.tone, "Direto, técnico e cordial");
  assert.equal(dna.fieldEvidence.tone.status, "observed");
  assert.equal(dna.quality.method, "materials");
  assert.equal(dna.quality.materials, 1);
  assert.ok(dna.sources.includes("Entrevista da marca"));
  await assert.rejects(extractBrand({ brandName: "X" }, { voiceModel }), /site, uma documentação ou um material/);
});
