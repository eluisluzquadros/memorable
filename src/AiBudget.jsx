import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "./context";

// Real AI spend (what the providers charged, from the cost log) against the account's own budget.
export const usd = (v) => `US$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// The period starts at 00:00 UTC on the 1st (or on Monday): read in local time it would show the day before.
export const sinceLabel = (since, options = { day: "numeric", month: "short" }) => new Date(since).toLocaleDateString("pt-BR", { ...options, timeZone: "UTC" });

export function useAiSpend(refresh) {
  const [status, setStatus] = useState(undefined);
  useEffect(() => {
    let alive = true;
    fetch("/api/budget").then((r) => (r.ok ? r.json() : null)).then((d) => alive && setStatus(d)).catch(() => alive && setStatus(null));
    return () => { alive = false; };
  }, [refresh]);
  return status; // undefined while loading, null without an account
}

// Dashboard tile: this brand's real spend in the current period.
export function SpendTile({ fallback }) {
  const { state } = useContext(AppContext);
  const status = useAiSpend(state.aiBudget?.amount);
  if (!status) return fallback;
  const brand = status.byWorkspace?.[state.workspace] || 0;
  return (
    <div>
      <span>Gasto com IA</span>
      <b className="money-metric">{usd(brand)}</b>
      <small>nesta marca desde {sinceLabel(status.since)} · real</small>
    </div>
  );
}

export function AiBudgetSettings() {
  const { state, setState, notify } = useContext(AppContext);
  const [amount, setAmount] = useState(state.aiBudget?.amount ?? "");
  const [period, setPeriod] = useState(state.aiBudget?.period || "mês");
  const status = useAiSpend(state.aiBudget?.amount + (state.aiBudget?.period || ""));
  if (status === null) return null;
  const admin = state.role === "Administrador";
  const brands = Object.fromEntries((state.workspaces || []).map((w) => [w.id, w.name]));
  const share = status?.share;
  return (
    <section className="settings-section">
      <h2>Orçamento de IA da conta</h2>
      <p>Gasto real, como os provedores cobraram, somado a cada geração. Ao chegar a 80% do teto você é avisado. Ao chegar a 100%, uma nova geração pergunta antes de rodar.</p>
      {status && (
        <>
          <div className="budget-summary">
            <b>{usd(status.total)}</b>
            <span>{status.budget ? `de ${usd(status.budget.amount)} por ${status.budget.period}` : `desde ${sinceLabel(status.since, {})} · sem teto definido`}</span>
          </div>
          {status.budget && <div className="budget-track"><i style={{ width: `${Math.min(100, (share || 0) * 100)}%` }} /></div>}
          {share >= 1 ? <p className="form-error" role="alert">O teto foi atingido. Novas gerações pedem confirmação.</p> : share >= 0.8 ? <p className="mr-warning" role="status">{Math.round(share * 100)}% do teto já foi usado neste {status.budget.period}.</p> : null}
          {Object.keys(status.byWorkspace || {}).length > 0 && (
            <ul className="budget-brands">
              {Object.entries(status.byWorkspace).sort((a, b) => b[1] - a[1]).map(([id, value]) => (
                <li key={id || "sem-marca"}><span>{brands[id] || (id ? "Marca arquivada" : "Sem marca (leituras e testes)")}</span><b>{usd(value)}</b></li>
              ))}
            </ul>
          )}
        </>
      )}
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!admin) return notify("Somente o papel Administrador altera o orçamento.", true);
        const value = amount === "" ? 0 : Number(amount);
        if (!Number.isFinite(value) || value < 0) return notify("Informe um valor válido em dólares.", true);
        setState((s) => ({ ...s, aiBudget: value ? { amount: value, period } : null }));
        notify(value ? `Teto de ${usd(value)} por ${period} salvo.` : "Teto removido.");
      }}>
        <fieldset disabled={!admin}>
          <legend className="sr-only">Teto de gasto com IA</legend>
          <div className="field-pair">
            <label>Teto em dólares<input type="number" min="0" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Sem teto" /></label>
            <label>Período<select value={period} onChange={(e) => setPeriod(e.target.value)}><option value="semana">semana</option><option value="mês">mês</option></select></label>
          </div>
          <button className="button secondary" type="submit">Salvar teto</button>
        </fieldset>
      </form>
      <p className="field-help">O teto vale para a conta inteira. O gasto por marca mostra onde o dinheiro foi; leituras de referência e testes sem marca aparecem à parte.</p>
    </section>
  );
}
