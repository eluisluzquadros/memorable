import React, { useEffect, useSyncExternalStore } from "react";
import { getCurrency, subscribeCurrency, setCurrency, loadRate, formatMoney, toDisplay, toUsd, rateNote, CURRENCIES } from "./currency.mjs";

// Subscribing component re-renders when the currency or the rate changes; money() always reads the latest.
export function useCurrency() {
  const current = useSyncExternalStore(subscribeCurrency, getCurrency, getCurrency);
  useEffect(() => { loadRate(); }, []);
  return { ...current, money: formatMoney, toDisplay, toUsd, symbol: CURRENCIES[current.currency].symbol };
}

export function CurrencySwitch() {
  const { currency } = useCurrency();
  const next = currency === "BRL" ? "USD" : "BRL";
  return (
    <button className="theme-switch currency-switch" onClick={() => setCurrency(next)} aria-label={next === "USD" ? "Mostrar valores em dólar" : "Mostrar valores em real"} title="Alternar moeda dos valores">
      <b aria-hidden="true">{CURRENCIES[currency].symbol}</b>
      <span>{currency === "BRL" ? "Real" : "Dólar"}</span>
    </button>
  );
}

export function CurrencySetting() {
  const current = useCurrency();
  return (
    <label>
      Moeda dos valores
      <select value={current.currency} onChange={(e) => setCurrency(e.target.value)}>
        {Object.entries(CURRENCIES).map(([id, { label }]) => <option key={id} value={id}>{label}</option>)}
      </select>
      <small className="field-help">Os provedores cobram em dólar; a plataforma converte na hora de mostrar. {rateNote(current)}</small>
    </label>
  );
}
