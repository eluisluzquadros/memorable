import React, { useEffect, useState } from "react";
import { formatMoney, rateNote } from "./currency.mjs";
import { useCurrency } from "./CurrencyControls";
import { fetchWithRetry } from "./long-fetch.mjs";
import "./lab.css";

// The company's cost ledger: what the provider charged, where it went (benchmark, customers, reads without an
// account), per account, model and day, and how it compares with the OpenRouter bill. Costs are in dollars at
// the provider and shown in the currency chosen in the top bar. Customers never see this.
const short = (model = "") => model.split("/").pop();
const day = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ORIGINS = [["lab", "Benchmark (rodadas do laboratório)"], ["accounts", "Contas de clientes (gerações e leituras)"], ["unowned", "Leituras e testes sem conta"]];

function Table({ head, rows, empty = "Sem registros neste período." }) {
  if (!rows.length) return <p className="field-help">{empty}</p>;
  return (
    <div className="lab-table-wrap">
      <table className="lab-table">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((cells, i) => <tr key={i}>{cells.map((c, j) => (j === 0 ? <th scope="row" key={j}>{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

// Whole generations on the platform grouped by the models used: what a content costs end to end.
function GenerationCosts({ generations, money }) {
  if (!generations?.setups?.length) return null;
  const { setups, attempts } = generations;
  return (
    <section className="r-panel" aria-label="Custo de uma geração completa">
      <h3>Quanto custa um conteúdo na plataforma</h3>
      <p className="field-help">O laboratório mede só a redação. Uma geração completa também planeja, passa pelo comitê, pelo editor crítico e por até duas reescritas. Gerações reais do período, por combinação de modelos.</p>
      <Table head={["Redação", "Revisão", "Gerações", "Custo por conteúdo", "Tempo", "Última"]} rows={setups.map((g) => [
        g.writers.map(short).join(" + ") || "—",
        g.reviewers.map(short).join(" + ") || "—",
        g.count,
        <>{money(g.medianCost)}{g.count > 1 && g.maxCost - g.minCost >= 0.005 ? <small> ({money(g.minCost)} a {money(g.maxCost)})</small> : null}</>,
        Number.isFinite(g.medianSeconds) ? `${g.medianSeconds} s` : "—",
        day(g.lastDay),
      ])} />
      {attempts.count > 0 && <p className="field-help">Além delas, {attempts.count} {attempts.count === 1 ? "tentativa parou" : "tentativas pararam"} antes do editor (erro ou geração interrompida): {money(attempts.cost)} gastos sem conteúdo.</p>}
    </section>
  );
}

export function AdminCosts() {
  const current = useCurrency();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setData(null);
    fetchWithRetry(`/api/platform/costs?days=${days}`).then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); }).catch((e) => setError(e.message || "Custos indisponíveis."));
  }, [days]);
  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <p className="field-help">Carregando os custos…</p>;
  const money = (v, digits = 2) => formatMoney(v, digits);
  const { ledger, bill, owners } = data;
  return (
    <>
      <section className="r-panel lab-stats" aria-label="Custos da operação">
        <h3>Custo da operação</h3>
        <label>Período
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[7, 30, 90, 365].map((n) => <option key={n} value={n}>Últimos {n} dias</option>)}
          </select>
        </label>
        <div className="lab-stat-grid">
          <div><small className="label">No período</small><b>{money(ledger.total.cost)}</b><span>{ledger.total.calls} chamadas pagas{ledger.total.failed ? ` · ${ledger.total.failed} com falha` : ""}</span></div>
          {bill && <div><small className="label">Cobrado pela OpenRouter</small><b>{money(bill.charged)}</b><span>desde o início, todas as chaves de produção</span></div>}
          {bill && <div><small className="label">Registrado pela plataforma</small><b>{money(bill.recorded)}</b><span>{bill.unrecorded >= 0.005 ? `${money(bill.unrecorded)} sem registro detalhado` : "tudo conciliado"}</span></div>}
        </div>
        <p className="field-help">Valores em {current.currency === "BRL" ? "reais" : "dólares"}; o provedor cobra em dólar. {rateNote(current)}.</p>
      </section>
      <section className="r-panel" aria-label="De onde vem o gasto">
        <h3>De onde vem o gasto</h3>
        <Table head={["Origem", "Chamadas", "Falhas", "Custo"]} rows={ORIGINS.filter(([id]) => ledger.byOrigin[id]).map(([id, label]) => [label, ledger.byOrigin[id].calls, ledger.byOrigin[id].failed, money(ledger.byOrigin[id].cost)])} />
      </section>
      <section className="r-panel" aria-label="Gasto por conta">
        <h3>Por conta de cliente</h3>
        <Table head={["Conta", "Chamadas", "Custo"]} rows={Object.entries(ledger.byOwner).sort((a, b) => b[1].cost - a[1].cost).map(([id, g]) => [owners[id] ? `${owners[id].name} · ${owners[id].email}` : id.slice(0, 8), g.calls, money(g.cost)])} />
      </section>
      <GenerationCosts generations={data.generations} money={money} />
      <section className="r-panel" aria-label="Gasto por modelo">
        <h3>Por modelo</h3>
        <Table head={["Modelo", "Chamadas", "Falhas", "Custo"]} rows={Object.entries(ledger.byModel).sort((a, b) => b[1].cost - a[1].cost).map(([model, g]) => [short(model), g.calls, g.failed, money(g.cost)])} />
      </section>
      <section className="r-panel" aria-label="Gasto por dia">
        <h3>Por dia</h3>
        <Table head={["Dia", "Chamadas", "Custo"]} rows={Object.entries(ledger.byDay).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 31).map(([d, g]) => [day(d), g.calls, money(g.cost)])} />
      </section>
      {bill && (
        <section className="r-panel" aria-label="Conferência com a OpenRouter">
          <h3>Conferência com a OpenRouter</h3>
          <p className="field-help">Tudo o que a chave da plataforma pagou desde o início, comparado com o que a plataforma registrou.</p>
          <Table head={["Item", "Valor"]} rows={[
            ["Benchmark (rodadas do laboratório)", money(bill.benchmark)],
            ["Gerações e leituras das contas", money(bill.accounts)],
            ["Leituras e testes sem conta", money(bill.unowned)],
            ["Sem registro detalhado", money(bill.unrecorded)],
            [<b key="c">Cobrado pela OpenRouter</b>, <b key="v">{money(bill.charged)}</b>],
          ]} />
          {bill.unrecorded >= 0.005 && <p className="field-help">Sem registro detalhado: chamadas feitas por scripts antes de o registro existir e pelo app local, que guarda o próprio registro no computador de desenvolvimento. Uma chave própria da OpenRouter para cada ambiente (produção e interno) elimina essa diferença.</p>}
        </section>
      )}
    </>
  );
}
