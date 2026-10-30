import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "./context";
import { fetchWithRetry } from "./long-fetch.mjs";

// What the account has used of its plan this month, in credits. The provider's cost is the platform's
// business; the customer has an allowance, like any subscription. Every call belongs to a brand, so the
// brands' credits add up to the total; calls that belong to no single brand have their own named lines.
export const credits = (n) => Math.round(Number(n) || 0).toLocaleString("pt-BR");
export const BUCKETS = { "": "Leituras e testes da conta", grupo: "Grupo (DNA e coerência entre marcas)" };

// The period starts at 00:00 UTC on the 1st: read in local time it would show the day before.
export const sinceLabel = (since, options = { day: "numeric", month: "short" }) => new Date(since).toLocaleDateString("pt-BR", { ...options, timeZone: "UTC" });

export function usePlanUsage(refresh) {
  const [usage, setUsage] = useState(undefined);
  useEffect(() => {
    let alive = true;
    fetchWithRetry("/api/budget").then((r) => (r.ok ? r.json() : null)).then((d) => alive && setUsage(d)).catch(() => alive && setUsage(null));
    return () => { alive = false; };
  }, [refresh]);
  return usage; // undefined while loading, null without an account
}

// The lines outside the active brands (the group, reads without a brand, a brand archived since).
export function outsideBrands(usage, brandIds) {
  return Object.entries(usage?.byWorkspace || {})
    .filter(([id, value]) => !brandIds.has(id) && value > 0)
    .map(([id, value]) => [id, BUCKETS[id] || "Marca arquivada", value]);
}

// Dashboard tile: this brand's usage in the current period.
export function SpendTile({ fallback }) {
  const { state } = useContext(AppContext);
  const usage = usePlanUsage();
  if (!usage) return fallback;
  return (
    <div>
      <span>Créditos usados</span>
      <b className="money-metric">{credits(usage.byWorkspace?.[state.workspace])}</b>
      <small>nesta marca desde {sinceLabel(usage.since)} · plano: {credits(usage.used)} de {credits(usage.allowance)}</small>
    </div>
  );
}

export function PlanUsageSettings() {
  const { state } = useContext(AppContext);
  const usage = usePlanUsage();
  if (usage === null) return null;
  const brands = Object.fromEntries((state.workspaces || []).map((w) => [w.id, w.name]));
  const share = usage?.share;
  return (
    <section className="settings-section">
      <h2>Plano e uso</h2>
      <p>Cada texto, roteiro ou leitura de referência consome créditos conforme o trabalho feito. A franquia do plano renova no início de cada mês. Ao chegar a 80% você é avisado; ao chegar a 100%, uma nova geração pergunta antes de rodar.</p>
      {usage && (
        <>
          <div className="budget-summary">
            <b>{credits(usage.used)}</b>
            <span>de {credits(usage.allowance)} créditos do plano · desde {sinceLabel(usage.since, {})}</span>
          </div>
          <div className="budget-track"><i style={{ width: `${Math.min(100, (share || 0) * 100)}%` }} /></div>
          {share >= 1 ? <p className="form-error" role="alert">A franquia do mês foi usada. Novas gerações pedem confirmação.</p> : share >= 0.8 ? <p className="mr-warning" role="status">{Math.round(share * 100)}% da franquia do mês já foi usada.</p> : null}
          {Object.keys(usage.byWorkspace || {}).length > 0 && (
            <ul className="budget-brands">
              {Object.entries(usage.byWorkspace).sort((a, b) => b[1] - a[1]).map(([id, value]) => (
                <li key={id || "conta"}><span>{brands[id] || BUCKETS[id] || "Marca arquivada"}</span><b>{credits(value)}</b></li>
              ))}
            </ul>
          )}
        </>
      )}
      <p className="field-help">O uso por marca soma exatamente o total do plano. Para mudar de plano ou aumentar a franquia, fale com a equipe da Memorável.</p>
    </section>
  );
}
