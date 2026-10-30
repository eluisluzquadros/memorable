// Costs are charged and stored in dollars; the screens show them in the currency the person chose
// (reais by default). The choice is kept in the browser; the rate comes from the service (/api/fx).
export const FALLBACK_RATE = 5.4;
export const CURRENCIES = { BRL: { symbol: "R$", label: "Real (R$)" }, USD: { symbol: "US$", label: "Dólar (US$)" } };
const KEY = "memorable-currency";
const NBSP = " ";

const read = () => { try { const v = localStorage.getItem(KEY); return v in CURRENCIES ? v : "BRL"; } catch { return "BRL"; } };
let state = { currency: typeof localStorage === "undefined" ? "BRL" : read(), rate: FALLBACK_RATE, source: "valor de referência", asOf: null, live: false };
const listeners = new Set();
const emit = (next) => { state = { ...state, ...next }; listeners.forEach((l) => l()); };

export const getCurrency = () => state;
export const subscribeCurrency = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
export function setCurrency(currency) {
  if (!(currency in CURRENCIES)) return;
  try { localStorage.setItem(KEY, currency); } catch { /* private mode: kept for this visit */ }
  emit({ currency });
}
export function setRate(info) { if (info && Number.isFinite(info.rate) && info.rate > 1) emit(info); }

let loading = null;
export function loadRate(fetcher = fetch) {
  loading ||= fetcher("/api/fx").then((r) => (r.ok ? r.json() : null)).then(setRate).catch(() => {}).finally(() => { setTimeout(() => { loading = null; }, 600000); });
  return loading;
}

// Dollars in, text out: money(0.2335, 4) → "R$ 1,2609" in reais or "US$ 0,2335" in dollars.
export function formatMoney(usd, digits = 2, { currency, rate } = state) {
  if (!Number.isFinite(usd)) return "—";
  const value = currency === "USD" ? usd : usd * rate;
  return `${CURRENCIES[currency].symbol}${NBSP}${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
export const toDisplay = (usd, { currency, rate } = state) => (currency === "USD" ? usd : usd * rate);
// What was typed in the chosen currency, back to dollars (4 decimals keep the round trip exact to the cent).
export const toUsd = (shown, { currency, rate } = state) => Math.round((currency === "USD" ? shown : shown / rate) * 10000) / 10000;
export const rateNote = ({ rate, source, asOf, live }) =>
  `US$ 1 = R$ ${rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} · ${live ? source : "cotação de referência (sem conexão com a fonte)"}${asOf ? ` · ${new Date(asOf).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : ""}`;
