import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectDynamicStyles,
  publicResourceUrl,
} from "../server/brand-render.mjs";

test("rendered resources reject local networks, credentials, other protocols and nonstandard ports", () => {
  for (const url of [
    "http://127.0.0.1/a",
    "http://10.0.0.1/",
    "http://169.254.169.254/",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://localhost/",
    "http://foo.local/",
    "https://user:pass@example.com/",
    "ftp://example.com/a",
    "https://example.com:5173/a",
  ])
    assert.throws(() => publicResourceUrl(url));
  assert.equal(
    publicResourceUrl("https://brand.example/assets/app.js"),
    "https://brand.example/assets/app.js",
  );
});

test("isolated renderer mounts JavaScript, samples applied styles and blocks private or write requests", async () => {
  const seen = [];
  const initial = {
    url: "https://brand.example/",
    type: "text/html",
    html: '<html><head><link rel="stylesheet" href="/styles.css"><script type="module" src="/app.js"></script></head><body><div id="root"></div></body></html>',
  };
  const assets = {
    "/styles.css": {
      type: "text/css",
      html: "body{background:#efefef;color:#123456;font-family:Georgia,serif}button{background:#ff5c2e}h1{font-size:48px}",
    },
    "/app.js": {
      type: "application/javascript",
      html: `
      const results=await Promise.allSettled([fetch('/public.json').then(r=>r.json()),fetch('http://127.0.0.1/private'),fetch('/write',{method:'POST',body:'no'})]);
      let socketBlocked=false;try{new WebSocket('wss://brand.example/ws')}catch{socketBlocked=true;}
      document.querySelector('#root').innerHTML='<main><h1>Marca renderizada</h1><p>'+${JSON.stringify("Pesquisa e dados para orientar decisões de negócio com contexto da marca e fontes verificáveis. ".repeat(3))}+'</p><button>Conhecer</button><p>'+results.map(r=>r.status).join(',')+'; socket:'+socketBlocked+'</p></main>';
    `,
    },
    "/public.json": { type: "application/json", html: '{"ok":true}' },
  };
  const result = await inspectDynamicStyles(initial, {
    getPublic: async (url) => {
      seen.push(url);
      const asset = assets[new URL(url).pathname];
      assert.ok(asset, "Unexpected network request: " + url);
      return { url, ...asset };
    },
  });
  assert.equal(result.sample.headings[0].text, "Marca renderizada");
  assert.equal(result.sample.background, "rgb(239, 239, 239)");
  assert.match(result.sample.body[0].font, /Georgia/);
  assert.match(
    result.sample.visibleText,
    /fulfilled,rejected,rejected; socket:true/,
  );
  assert.equal(result.materials.length, 1);
  assert.equal(result.requests, 3);
  assert.deepEqual(
    seen.sort(),
    Object.keys(assets)
      .map((path) => "https://brand.example" + path)
      .sort(),
  );
});
