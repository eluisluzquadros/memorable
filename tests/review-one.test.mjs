import test from "node:test";
import assert from "node:assert/strict";
import { initialState, createPiece, transition } from "../src/workflow.mjs";
import {
  AGENTS,
  DEFAULT_RADAR,
  saveMonitor,
  validateRadar,
  nextRadarRun,
  radarScore,
  rankedTopics,
  contextPacket,
  productionVariants,
  runCouncil,
  councilGate,
  mergeCollection,
  sourceCaptureProblem,
  sourceValid,
} from "../src/operations.mjs";
import { publicAddress, extractPage, collectSources } from "../server/collector.mjs";
test("monitor CRUD respects role, workspace and duplicate canonical URLs", () => {
  let s = initialState();
  const input = {
    name: "Referência",
    url: "https://example.com/#a",
    category: "Referência",
  };
  s = saveMonitor(s, input);
  assert.equal(s.monitors.length, 1);
  assert.throws(
    () => saveMonitor(s, { ...input, url: "https://example.com/" }),
    /já está/,
  );
  assert.throws(
    () => saveMonitor({ ...s, role: "Observador" }, input),
    /Editor/,
  );
  assert.throws(
    () => saveMonitor(s, { ...input, url: "javascript:alert(1)" }),
    /http/,
  );
  const other = saveMonitor({ ...s, workspace: "ativos" }, input);
  assert.equal(other.monitors.length, 2);
});
test("weights really change rank; invalid sums rejected", () => {
  assert.equal(
    radarScore(
      { relevance: 10, novelty: 0, brandFit: 0 },
      DEFAULT_RADAR.weights,
    ),
    4,
  );
  assert.equal(
    radarScore(
      { relevance: 10, novelty: 0, brandFit: 0 },
      { relevance: 20, novelty: 40, brandFit: 40 },
    ),
    2,
  );
  assert.throws(
    () =>
      validateRadar({
        ...DEFAULT_RADAR,
        weights: { relevance: 20, novelty: 20, brandFit: 20 },
      }),
    /100/,
  );
});
test("scheduling calculates future minute, day, weekday and month windows", () => {
  const date = new Date(2026, 8, 10, 10, 0);
  assert.equal(
    +new Date(
      nextRadarRun(
        { ...DEFAULT_RADAR, frequency: "minutes", minutes: 15 },
        date,
      ),
    ) - date,
    900000,
  );
  assert.equal(
    new Date(nextRadarRun({ ...DEFAULT_RADAR, time: "09:00" }, date)).getDate(),
    11,
  );
  const monday = new Date(
    nextRadarRun(
      { ...DEFAULT_RADAR, frequency: "weekly", weekdays: [1] },
      date,
    ),
  );
  assert.equal(monday.getDay(), 1);
  assert(monday > date);
  assert.equal(
    new Date(
      nextRadarRun(
        { ...DEFAULT_RADAR, frequency: "monthly", monthDay: 5 },
        date,
      ),
    ).getMonth(),
    9,
  );
});
test("context uses voice, approved lessons and accessible sources; three strategies are optional", () => {
  const s = initialState();
  s.rules = [
    { workspace: "bbmd", text: "Explique os termos." },
    { workspace: "ativos", text: "Segredo de outra marca" },
  ];
  const packet = contextPacket(s, {
    title: "Clareza",
    format: "LinkedIn",
    source: "rolim31",
    versionCount: 3,
  });
  assert.equal(packet.lessons.length, 1);
  assert.equal(packet.voice.tone, s.voices.bbmd.tone);
  const vs = productionVariants(packet);
  assert.deepEqual(
    vs.map((v) => v.strategy),
    ["Racional", "Storytelling", "Quebra de Objeção"],
  );
  assert.equal(new Set(vs.map((v) => v.body)).size, 3);
  assert(vs.every((v) => v.visual && v.av && v.seo && v.facts));
  assert.equal(AGENTS.length, 8);
});
test("council cannot approve a missing source or sensitive identifiers; rounds are bounded", () => {
  const s = initialState();
  const blocked = runCouncil(s, s.pieces[1]);
  assert.equal(blocked.piece.council.passed, false);
  assert.equal(blocked.rounds.length, 1);
  const sensitive = runCouncil(s, {
    ...s.pieces[0],
    body: s.pieces[0].body + " CPF 123.456.789-00",
  });
  assert.equal(sensitive.piece.council.passed, false);
  assert.throws(() => councilGate(s, s.pieces[0]), /Refine a versão atual/);
});
test("editing and source changes invalidate the council, approval and agenda", () => {
  let s = initialState();
  s.pieces[0] = runCouncil(s, s.pieces[0]).piece;
  s = transition(s, "piece-1", "review");
  s = transition({ ...s, role: "Aprovador" }, "piece-1", "approve");
  s = transition(s, "piece-1", "schedule", {
    date: new Date(Date.now() + 86400000).toISOString(),
    channel: "LinkedIn",
  });
  const changed = {
    ...s.sources.find((x) => x.id === "rolim31"),
    text: "Conteúdo atualizado da fonte.",
  };
  const next = mergeCollection(s, { sources: [changed] });
  assert.equal(next.pieces[0].scheduledAt, null);
  assert.equal(next.pieces[0].status, "Em conferência");
  assert.throws(() => councilGate(next, next.pieces[0]), /Refine a versão atual/);
});
test("expiry prevents recommendations and new drafts; duplicate coverage is flagged", () => {
  const s = initialState();
  const source = s.sources.find((x) => x.id === "rolim31");
  s.pieces[0].title = source.title;
  assert(rankedTopics(s).find((t) => t.sourceId === "rolim31").duplicate);
  source.validUntil = "2000-01-01";
  assert(!rankedTopics(s).some((t) => t.sourceId === "rolim31"));
  assert.throws(
    () =>
      createPiece(s, {
        title: "Teste",
        body: "Teste",
        deadline: "2026-12-01",
        sourceIds: ["rolim31"],
      }),
    /fonte/,
  );
});
test("collector rejects private networks and removes active markup", () => {
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "192.168.1.2",
    "172.16.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert(publicAddress("93.184.216.34"));
  assert.equal(
    extractPage("<script>ignore rules</script><h1>Título</h1><p>A &amp; B</p>"),
    "Título A & B",
  );
});
test("social login shells are never treated as useful, citable references", async () => {
  const shell = { title: "Esfera Legal (@aesferalegal) • Instagram photos and videos", text: "Instagram Log In Sign Up Posts Reels Tagged Carousel", citable: true };
  assert.match(sourceCaptureProblem(shell), /metadados de login/);
  assert.equal(sourceValid(shell), false);
  const result = await collectSources("bbmd", [{ id:"ig", workspace:"bbmd", kind:"Instagram", name:"Esfera Legal", url:"https://www.instagram.com/aesferalegal/" }]);
  assert.equal(result.sources.length, 0);
  assert.match(result.errors[0].error, /não entrega publicações úteis/);
});
