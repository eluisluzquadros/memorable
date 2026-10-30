// US$ → R$ rate for showing costs in reais. The provider charges in dollars, so every amount is stored in
// dollars and converted only when shown. Live rate from AwesomeAPI (commercial dollar), with open.er-api.com
// as a second source; if both fail the last good rate is kept, and without any, a reference value that the
// screen labels as such.
export const FALLBACK_RATE = 5.4;
const SOURCES = [
  { name: "AwesomeAPI", url: "https://economia.awesomeapi.com.br/json/last/USD-BRL", read: (d) => ({ rate: Number(d?.USDBRL?.bid), asOf: d?.USDBRL?.timestamp ? new Date(Number(d.USDBRL.timestamp) * 1000).toISOString() : null }) },
  { name: "ExchangeRate-API", url: "https://open.er-api.com/v6/latest/USD", read: (d) => ({ rate: Number(d?.rates?.BRL), asOf: d?.time_last_update_unix ? new Date(d.time_last_update_unix * 1000).toISOString() : null }) },
];
const sane = (rate) => Number.isFinite(rate) && rate > 1 && rate < 50;

export function createFx({ fetcher = fetch, ttlMs = 6 * 3600000, now = () => Date.now() } = {}) {
  let cache = null;
  return async function rate() {
    if (cache && now() - cache.fetchedAt < ttlMs) return cache.value;
    for (const source of SOURCES) {
      try {
        const response = await fetcher(source.url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) continue;
        const { rate: value, asOf } = source.read(await response.json());
        if (!sane(value)) continue;
        cache = { fetchedAt: now(), value: { rate: value, source: source.name, asOf: asOf || new Date(now()).toISOString(), live: true } };
        return cache.value;
      } catch { /* next source */ }
    }
    // No source answered: keep the last good rate (and retry in 10 minutes), else the reference value.
    const value = cache ? { ...cache.value, live: false } : { rate: FALLBACK_RATE, source: "valor de referência", asOf: null, live: false };
    cache = { fetchedAt: now() - ttlMs + 600000, value };
    return value;
  };
}
