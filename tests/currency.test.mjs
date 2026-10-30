import test from "node:test";
import assert from "node:assert/strict";
import { createFx, FALLBACK_RATE } from "../server/fx.mjs";
import { formatMoney, toDisplay, toUsd, rateNote } from "../src/currency.mjs";

const answer = (body, ok = true) => async () => ({ ok, json: async () => body });
const awesome = (bid) => ({ USDBRL: { bid: String(bid), timestamp: "1793361853" } });

test("the live rate comes from the first source and is kept for hours", async () => {
  let calls = 0, clock = 0;
  const fx = createFx({ fetcher: async (url) => { calls++; return answer(awesome(5.39))(url); }, now: () => clock });
  const first = await fx();
  assert.deepEqual([first.rate, first.live, first.source], [5.39, true, "AwesomeAPI"]);
  clock += 3600000;
  await fx();
  assert.equal(calls, 1, "within the cache window the source is not asked again");
  clock += 6 * 3600000;
  await fx();
  assert.equal(calls, 2);
});

test("the second source answers when the first fails; absurd rates are refused", async () => {
  const urls = [];
  const fx = createFx({ fetcher: async (url) => { urls.push(url); return url.includes("awesomeapi") ? answer(awesome(0.02))(url) : answer({ rates: { BRL: 5.41 }, time_last_update_unix: 1793318551 })(url); } });
  const r = await fx();
  assert.deepEqual([r.rate, r.source], [5.41, "ExchangeRate-API"]);
  assert.equal(urls.length, 2);
});

test("with no source at all it keeps the last good rate, then a labelled reference value", async () => {
  let clock = 0, up = true;
  const fx = createFx({ fetcher: async (url) => { if (!up) throw new Error("offline"); return answer(awesome(5.5))(url); }, now: () => clock });
  await fx();
  up = false; clock += 7 * 3600000;
  const stale = await fx();
  assert.deepEqual([stale.rate, stale.live], [5.5, false], "the last good rate, marked as not live");
  const none = await createFx({ fetcher: async () => { throw new Error("offline"); } })();
  assert.deepEqual([none.rate, none.live, none.source], [FALLBACK_RATE, false, "valor de referência"]);
});

test("amounts are stored in dollars and shown in the chosen currency; the budget round-trips", () => {
  const brl = { currency: "BRL", rate: 5.4 }, usd = { currency: "USD", rate: 5.4 };
  assert.equal(formatMoney(0.2335, 2, brl), "R$\u00a01,26");
  assert.equal(formatMoney(0.2335, 4, usd), "US$\u00a00,2335");
  assert.equal(formatMoney(NaN, 2, brl), "—");
  assert.equal(toDisplay(10, brl), 54);
  assert.equal(toUsd(54, brl), 10, "R$ 54 typed in the budget field is US$ 10 stored");
  assert.equal(toUsd(10, usd), 10);
  assert.match(rateNote({ rate: 5.3946, source: "AwesomeAPI", asOf: "2026-10-30T09:04:13Z", live: true }), /US\$ 1 = R\$ 5,3946 · AwesomeAPI · 30\/10/);
  assert.match(rateNote({ rate: 5.4, source: "valor de referência", asOf: null, live: false }), /cotação de referência/);
});
