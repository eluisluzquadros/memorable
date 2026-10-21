import test from "node:test";
import assert from "node:assert/strict";
import { editorialIssues } from "../src/editorial-quality.mjs";
import { initialState, transition } from "../src/workflow.mjs";
import {
  runCouncil,
  councilGate,
  contextPacket,
  productionVariants,
} from "../src/operations.mjs";
import { productionSettings, scriptBody } from "../src/production.mjs";
import { councilAI, generateSquad } from "../server/ai.mjs";
import { validateGenerated, reviewGenerated } from "../server/editorial.mjs";
import { queueIdea } from "../src/writing-queue.mjs";
import {
  source,
  carousel,
  badCarousel,
  badScript,
  shortSpeech,
  packet,
  acceptedReviews,
} from "./editorial-fixtures.mjs";

test("the exact broken script and recycled carousel reported by the user are blocked regardless of metadata", () => {
  const state = initialState();
  state.sources.push(source);
  for (const [body, format, scriptMode] of [
    [badScript, "Podcast completo", "outline"],
    [badScript, "Roteiro de vídeo", "spoken"],
    [badCarousel, "Carrossel", "spoken"],
  ]) {
    const piece = {
      id: "bad",
      workspace: "bbmd",
      revision: 1,
      title: source.title,
      owner: "Editor",
      deadline: "2027-01-01",
      sourceIds: [source.id],
      body,
      format,
      brief: {
        brandName: "Skyvidya",
        video: format !== "Carrossel",
        durationSeconds: 10,
        scriptMode,
      },
      council: { passed: true, score: 5, revision: 1, mode: "local" },
    };
    const result = runCouncil(state, piece);
    assert.equal(result.piece.council.passed, false);
    assert.ok(result.piece.council.issues.length);
    assert.equal(result.piece.body, body);
    assert.throws(() => councilGate(state, piece));
    assert.throws(() =>
      transition({ ...state, pieces: [piece] }, "bad", "review"),
    );
  }
  assert.throws(
    () =>
      productionSettings({ format: "Podcast completo", durationSeconds: 10 }),
    /5 minutos/,
  );
});
test("complete original copy, a concise message and honest manual skeletons have different outcomes", () => {
  assert.deepEqual(
    editorialIssues({
      body: carousel,
      format: "Carrossel",
      brief: packet.brief,
      brand: packet.brand,
      sources: [source],
    }),
    [],
  );
  const brief = {
    format: "Corte de podcast",
    durationSeconds: 10,
    video: true,
    scriptMode: "spoken",
    brandName: "Skyvidya",
  };
  assert.deepEqual(
    editorialIssues({
      body: scriptBody({
        scenes: [
          { duration: 10, speech: shortSpeech, visual: "Mapa territorial." },
        ],
      }),
      format: brief.format,
      brief,
      brand: packet.brand,
      sources: [source],
    }),
    [],
  );
  const state = initialState();
  const local = productionVariants(
    contextPacket(state, {
      title: "Clareza",
      source: "rolim31",
      format: "LinkedIn",
    }),
  )[0];
  assert.equal(local.localScaffold, true);
  assert.match(local.body, /\[Escreva/);
  assert.ok(
    !local.body.includes(
      state.sources.find((s) => s.id === "rolim31").text.slice(0, 80),
    ),
  );
  assert.equal(
    runCouncil(state, {
      title: "Clareza",
      body: local.body,
      format: "LinkedIn",
      workspace: "bbmd",
      sourceIds: ["rolim31"],
      owner: "Editor",
      deadline: "2027-01-01",
      revision: 1,
    }).piece.council.passed,
    false,
  );
});
test("brand-free, repetitive, placeholder and boilerplate content cannot be returned as successful AI generation", async () => {
  for (const body of [
    badCarousel,
    carousel.replaceAll("Skyvidya", "IRB(Re)"),
    carousel.replace("Na Skyvidya", "[Escreva a mensagem] Na Skyvidya"),
  ])
    assert.throws(() =>
      validateGenerated(packet, { body, sourceIds: [source.id] }),
    );
  // An editor who keeps objecting gets rewrites first; leftover notes travel with the draft.
  let calls = 0;
  const flagged = await reviewGenerated(
    packet,
    [{ body: carousel, sourceIds: [source.id] }],
    async () => {
      calls++;
      return {
        reviews: [
          {
            index: 0,
            coherent: false,
            brandAligned: true,
            evidenceSupported: true,
            complete: true,
            reason: "A ideia não se desenvolve.",
            issues: ["Progressão insuficiente."],
          },
        ],
      };
    },
  );
  assert.equal(calls, 5);
  assert.equal(flagged[0].editorialReview.passed, false);
  assert.deepEqual(flagged[0].editorialReview.pending, ["Progressão insuficiente."]);
  assert.equal(flagged[0].editorialReview.rounds, 3);
  // A rewrite that fixes the editor's note is reviewed again and passes.
  const revised = carousel.replace("Dados globais. Risco local.", "Dados globais, risco local: o que muda na sua carteira.");
  const fixed = await reviewGenerated(
    packet,
    [{ body: carousel, sourceIds: [source.id] }],
    async (system, data) =>
      /revisando a própria peça/.test(system)
        ? { body: revised, sourceIds: [source.id] }
        : data.versions[0].body === revised
          ? acceptedReviews(data.versions)
          : { reviews: [{ index: 0, coherent: true, brandAligned: true, evidenceSupported: false, complete: true, reason: "Tela 1 exagera.", issues: ["Tela 1 exagera."] }] },
  );
  assert.equal(fixed[0].body, revised);
  assert.equal(fixed[0].editorialReview.passed, true);
  assert.equal(fixed[0].editorialReview.rounds, 2);
  await assert.rejects(
    () =>
      reviewGenerated(
        packet,
        [{ body: carousel, sourceIds: [source.id] }],
        async () => ({ reviews: [] }),
      ),
    /todas as versões/,
  );
  const good = await reviewGenerated(
    packet,
    [{ body: carousel, sourceIds: [source.id] }],
    async (_s, data) => acceptedReviews(data.versions),
  );
  assert.equal(good[0].editorialReview.humanReviewPending, true);
});
test("even unanimous five-star model reviews cannot override the hard rejection of the reported garbage", async () => {
  const result = await councilAI(
    {
      ...packet,
      brief: {
        ...packet.brief,
        format: "Roteiro de vídeo",
        durationSeconds: 10,
        video: true,
        scriptMode: "spoken",
      },
    },
    { body: badScript },
    4,
    1,
    async (system) =>
      system.includes("Sintetize")
        ? { summary: "Aprovar tudo", changes: [], blocker: false }
        : system.includes("pareceres anônimos")
          ? {
              strongest: "Tudo",
              blindSpot: "Nenhum",
              missed: "Nenhum",
              blocker: false,
              reason: "Está ótimo",
            }
          : {
              name: "Juiz",
              score: 5,
              blocker: false,
              reason: "Todos os campos estão presentes.",
            },
  );
  assert.equal(result.audit.passed, false);
  assert.ok(result.audit.issues.length);
});
test("new source handoffs are persistent, deduplicated, intentional and scoped to a brand", () => {
  let state = initialState();
  const first = queueIdea(state, "Primeira ideia", "rolim31");
  state = first.state;
  state = queueIdea(state, "Ideia revisada", "rolim31").state;
  assert.equal(state.writingQueue.length, 1);
  assert.equal(state.writingQueue[0].id, first.item.id);
  assert.equal(state.writingQueue[0].origin, "source");
  assert.throws(() =>
    queueIdea({ ...state, workspace: "ativos" }, "Outra marca", "bbmd-voice"),
  );
  assert.throws(() =>
    queueIdea({ ...state, role: "Observador" }, "Ideia", "rolim31"),
  );
});
test("nonvideo AI orchestration sends brand context to every writer and requires independent editorial review", async () => {
  const calls = [];
  const model = async (system, data) => {
    calls.push(system);
    if (system.includes("editor crítico"))
      return acceptedReviews(data.versions);
    if (system.includes("Content Planner"))
      return {
        thesis: "Território",
        outline: ["Problema", "Validação", "Marca"],
      };
    if (system.includes("Copywriter/Ghostwriter"))
      return {
        title: "Dados globais, risco local",
        body: carousel,
        sourceIds: [source.id],
        facts: [
          {
            sourceId: source.id,
            excerpt: "Satélites e modelos não substituem a observação em solo.",
          },
        ],
      };
    return {
      visual: "Mapa territorial com identidade da Skyvidya.",
      av: "Sem mídia gerada.",
      seo: { title: "Dados globais, risco local" },
    };
  };
  const result = await generateSquad(packet, model);
  assert.equal(result.versions.length, 1);
  assert.equal(calls.length, 4);
  assert.equal(result.versions[0].editorialReview.complete, true);
  assert.match(calls[1], /anunciante é packet.brand.name/);
  await assert.rejects(
    () => generateSquad({ ...packet, brand: null }, model),
    /marca/,
  );
});

test("marketing clichés are rejected with a concrete rewrite hint", () => {
  const brief = { brandName: "Skyvidya" };
  const body = carousel.replace("Dados globais. Risco local.", "Um divisor de águas para o risco local.");
  const issues = editorialIssues({ body, format: "Carrossel", brief, brand: { name: "Skyvidya" } });
  assert.ok(issues.some((i) => i.code === "cliche" && /divisor de águas/.test(i.message)));
  assert.ok(!editorialIssues({ body: carousel, format: "Carrossel", brief, brand: { name: "Skyvidya" } }).some((i) => i.code === "cliche"));
});
