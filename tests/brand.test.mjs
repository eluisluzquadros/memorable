import test from "node:test";
import assert from "node:assert/strict";
import { inspectBrandMaterial, extractBrand } from "../server/brand.mjs";
test("DNA keeps provenance and does not invent missing identity", () => {
  const result = inspectBrandMaterial([
    {
      origin: "https://example.com/brand.css",
      text: "body { color: #123456; font-family: Sora, sans-serif; } h1 {color: #123456}",
    },
  ]);
  assert.equal(result.colors.length, 1);
  assert.equal(result.colors[0].origin, "https://example.com/brand.css");
  assert.equal(result.fonts[0].value, "Sora, sans-serif");
  assert.equal(result.tone, "");
  assert.equal(result.aesthetic, "");
});
test("documented brand fields remain explicit, scripts ignored, empty material rejected", async () => {
  const result = await extractBrand({
    documentation:
      'Tom de voz: claro\nEstética: editorial\n<script>const color = "#abcdef";</script>\nPaleta: #214cff',
  });
  assert.equal(result.tone, "claro");
  assert.equal(result.aesthetic, "editorial");
  assert.deepEqual(
    result.colors.map((c) => c.value),
    ["#214cff"],
  );
  await assert.rejects(extractBrand({ documentation: "" }), /Informe/);
  await assert.rejects(
    extractBrand({ documentation: "x".repeat(80001) }),
    /80 mil/,
  );
});

test("DNA normalizes duplicate hex values and ignores unused CMS palettes", () => {
  const result = inspectBrandMaterial([
    {
      origin: "site.css",
      text: ":root{--wp--preset--color--pink:#f78da7;--e-global-color-primary:#6ec1e4;}body{background:#fff}h1{color:#ffffff}a{color:#197cb5}",
    },
  ]);
  assert.deepEqual(
    result.colors.map((c) => c.value),
    ["#ffffff", "#197cb5"],
  );
});

test("applied styles fill a reviewable proposal and preserve explicit documentation", async () => {
  const { applyRenderedEvidence } = await import("../server/brand.mjs");
  const dna = inspectBrandMaterial([
    {
      origin: "Documentação fornecida",
      text: "Tom de voz: acolhedor\nCor principal: #123456",
    },
  ]);
  applyRenderedEvidence(
    dna,
    {
      buttons: [{ background: "rgb(25, 124, 181)" }],
      headings: [
        {
          font: "Raleway, sans-serif",
          color: "rgb(20, 30, 40)",
          size: "48px",
          text: "Direito trabalhista",
        },
      ],
      body: [
        {
          font: "Inter, sans-serif",
          color: "rgb(60, 60, 60)",
          text: "Orientação para trabalhadores",
        },
      ],
      background: "rgb(255, 255, 255)",
      description: "Advocacia para bancários.",
    },
    "https://example.com",
  );
  assert.equal(dna.primary, "#123456");
  assert.equal(dna.tone, "acolhedor");
  assert.equal(dna.bodyFont, "Inter, sans-serif");
  assert.equal(dna.background, "#ffffff");
  assert.equal(dna.fieldEvidence.aesthetic.status, "suggested");
  assert.equal(dna.fieldEvidence.primary.origin, "Documentação fornecida");
  assert.match(dna.audience, /bancários/);
});

const emptySample = {
  headings: [],
  body: [],
  buttons: [],
  background: "rgba(0, 0, 0, 0)",
  description: "",
  visibleText: "",
};
const hydratedSample = {
  headings: [
    {
      font: "Inter Tight, sans-serif",
      color: "rgb(20, 22, 26)",
      size: "59px",
      text: "Inteligência geoespacial",
    },
  ],
  body: [
    {
      font: "Inter Tight, sans-serif",
      color: "rgb(90, 95, 106)",
      size: "16px",
      text: "Dados e pesquisa para decisões sobre crédito rural.",
    },
  ],
  buttons: [{ background: "rgb(255, 92, 46)" }],
  background: "rgb(233, 227, 213)",
  description:
    "Inteligência geoespacial para transformar risco em resiliência.",
  visibleText:
    "Dados e pesquisa para decisões sobre crédito rural. ".repeat(5) +
    "PARA QUEM Agnóstico ao nicho. Modular por intenção. A mesma plataforma serve produtor, banco, seguradora e trading. Contexto para cada decisão.",
};
test("JavaScript sites are rendered and explicit documentation keeps priority", async () => {
  let hydrated = 0;
  const result = await extractBrand(
    {
      url: "https://brand.example/",
      documentation: "Tom de voz: direto\nCor principal: #123456",
    },
    {
      getPublic: async (url) => ({
        url,
        html: '<title>Marca</title><div id="root"></div>',
        type: "text/html",
      }),
      renderStatic: async () => emptySample,
      renderDynamic: async () => {
        hydrated++;
        return { sample: hydratedSample, materials: [], warnings: [] };
      },
    },
  );
  assert.equal(hydrated, 1);
  assert.equal(result.quality.method, "rendered");
  assert.equal(result.quality.status, "ready");
  assert.ok(result.quality.textCharacters > 180);
  assert.equal(result.headingFont, "Inter Tight, sans-serif");
  assert.equal(result.background, "#e9e3d5");
  assert.equal(result.primary, "#123456");
  assert.equal(result.tone, "direto");
  assert.equal(result.fieldEvidence.primary.origin, "Documentação fornecida");
  assert.equal(
    result.colors.find((c) => c.value === "#123456").origin,
    "Documentação fornecida",
  );
  assert.ok(result.colors.some((c) => c.value === "#ff5c2e"));
  assert.match(result.audience, /produtor, banco, seguradora/);
  assert.match(result.excerpt, /PARA QUEM/);
  assert.equal(result.fieldEvidence.audience.status, "suggested");
});
test("unreadable app shells fail clearly instead of returning an empty identity", async () => {
  await assert.rejects(
    extractBrand(
      { url: "https://brand.example/" },
      {
        getPublic: async (url) => ({
          url,
          html: '<title>Marca</title><div id="root"></div>',
        }),
        renderStatic: async () => emptySample,
        renderDynamic: async () => {
          throw new Error("Unavailable");
        },
      },
    ),
    /Nenhuma proposta vazia/,
  );
});
test("readable static pages do not run website scripts", async () => {
  let dynamicCalls = 0;
  const result = await extractBrand(
    { url: "https://brand.example/" },
    {
      getPublic: async (url) => ({
        url,
        html: "<h1>Marca</h1><p>Material da empresa.</p>",
      }),
      renderStatic: async () => hydratedSample,
      renderDynamic: async () => {
        dynamicCalls++;
        throw new Error("Must not execute");
      },
    },
  );
  assert.equal(dynamicCalls, 0);
  assert.equal(result.quality.method, "static");
  assert.equal(result.primary, "#ff5c2e");
});
