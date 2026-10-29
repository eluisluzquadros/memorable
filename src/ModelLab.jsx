import React, { useEffect, useMemo, useState } from "react";
import "./lab.css";

// Model lab: which model does each job best for what it costs, measured by blind judges, and the
// three profiles that come out of it. Method in docs/BENCHMARK_STRATEGY.md.
const TASKS = { redator: "Redator" };
const PROFILES = [["essencial", "Essencial", "O modelo qualificado mais barato"], ["equilibrado", "Equilibrado", "O mais barato a até 0,25 ponto da melhor nota"], ["excelencia", "Excelência", "A maior nota medida"]];
const STATUS = { done: "Concluída", running: "Em andamento", paused: "Pausada", awaiting_credit: "Aguardando crédito", failed: "Falhou" };
// Numbers in Brazilian Portuguese: comma decimals.
const num = (v, digits = 2) => (Number.isFinite(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "—");
const usd = (v, digits = 4) => (Number.isFinite(v) ? `US$ ${num(v, digits)}` : "—");
const short = (model) => model.split("/").pop();

function QualityCostChart({ rows, picks, floor }) {
  const [hover, setHover] = useState(null);
  const W = 900, H = 340, pad = { l: 44, r: 16, t: 14, b: 40 };
  const costs = rows.map((r) => r.cost).filter((c) => c > 0);
  const lo = Math.log10(Math.min(...costs) / 1.6), hi = Math.log10(Math.max(...costs) * 1.6);
  const x = (c) => pad.l + ((Math.log10(c) - lo) / (hi - lo)) * (W - pad.l - pad.r);
  const y = (m) => pad.t + ((5 - m) / 4) * (H - pad.t - pad.b);
  const ticks = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1].filter((t) => Math.log10(t) >= lo && Math.log10(t) <= hi);
  const picked = (model) => Object.entries(picks || {}).filter(([, m]) => m === model).map(([k]) => PROFILES.find((p) => p[0] === k)[1]);
  return (
    <figure className="lab-chart">
      <div className="lab-chart-scroll" tabIndex={0} role="region" aria-label="Gráfico de nota por custo; role para o lado no celular">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Nota média por custo por texto, um ponto por modelo">
        {[1, 2, 3, 4, 5].map((m) => (
          <g key={m}>
            <line className="lab-grid" x1={pad.l} x2={W - pad.r} y1={y(m)} y2={y(m)} />
            <text className="lab-axis" x={pad.l - 8} y={y(m) + 4} textAnchor="end">{m}</text>
          </g>
        ))}
        <line className="lab-floor" x1={pad.l} x2={W - pad.r} y1={y(floor)} y2={y(floor)} />
        <text className="lab-axis lab-floor-label" x={W - pad.r} y={y(floor) - 6} textAnchor="end">piso {num(floor, 1)}</text>
        {ticks.map((t) => (
          <text key={t} className="lab-axis" x={x(t)} y={H - pad.b + 18} textAnchor="middle">{`US$ ${num(t, t < 0.01 ? 3 : t < 0.1 ? 2 : 1)}`}</text>
        ))}
        <text className="lab-axis" x={(W + pad.l) / 2} y={H - 6} textAnchor="middle">custo por texto (escala logarítmica)</text>
        {rows.filter((r) => r.cost > 0 && Number.isFinite(r.mean)).map((r) => {
          const names = picked(r.model);
          return (
            <g key={r.model} className="lab-dot" role="img" tabIndex={0} onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(r)} onBlur={() => setHover(null)} aria-label={`${short(r.model)}: nota ${num(r.mean)}, ${usd(r.cost)} por texto${r.qualified ? ", qualificado" : ""}${names.length ? `, perfil ${names.join(" e ")}` : ""}`}>
              <circle cx={x(r.cost)} cy={y(r.mean)} r="14" fill="transparent" />
              {names.length > 0 && <circle className="lab-pick" cx={x(r.cost)} cy={y(r.mean)} r="9" />}
              <circle className={r.qualified ? "lab-mark ok" : "lab-mark no"} cx={x(r.cost)} cy={y(r.mean)} r="5" />
              {names.length > 0 && (x(r.cost) > W * 0.62
                ? <text className="lab-label" x={x(r.cost) - 14} y={y(r.mean) + 4} textAnchor="end">{short(r.model)} · {names.join(", ")}</text>
                : <text className="lab-label" x={x(r.cost) + 14} y={y(r.mean) + 4}>{short(r.model)} · {names.join(", ")}</text>)}
            </g>
          );
        })}
      </svg>
      </div>
      {hover && (
        <div className="lab-tip" role="status">
          <b>{short(hover.model)}</b>
          <span>Nota {num(hover.mean)} · {usd(hover.cost)} por texto · {hover.p50 ?? "—"} s</span>
          <span>{hover.judged} peças avaliadas · {hover.qualified ? "qualificado" : hover.why}</span>
        </div>
      )}
      <figcaption className="lab-legend">
        <span><i className="lab-key ok" /> Qualificado</span>
        <span><i className="lab-key no" /> Não qualificado</span>
        <span><i className="lab-key pick" /> Escolhido por um perfil</span>
      </figcaption>
    </figure>
  );
}

function Simulator({ rows, picks }) {
  const [budget, setBudget] = useState(20);
  const [period, setPeriod] = useState("mês");
  const [volume, setVolume] = useState(40);
  const options = PROFILES.map(([id, name]) => ({ id, name, row: rows.find((r) => r.model === picks?.[id]) })).filter((o) => o.row);
  const fits = options.filter((o) => o.row.cost * volume <= budget);
  const best = fits.sort((a, b) => b.row.mean - a.row.mean)[0];
  return (
    <section className="r-panel lab-sim">
      <h3>Quanto o seu orçamento compra</h3>
      <div className="field-pair">
        <label>Orçamento (US$)<input type="number" min="0" step="1" value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value)))} /></label>
        <label>Período<select value={period} onChange={(e) => setPeriod(e.target.value)}><option>semana</option><option>mês</option></select></label>
        <label>Textos no período<input type="number" min="1" step="1" value={volume} onChange={(e) => setVolume(Math.max(1, Number(e.target.value)))} /></label>
      </div>
      {!options.length ? <p className="field-help">Ainda não há modelos qualificados para calcular.</p> : best ? (
        <p><b>{best.name}</b> cabe: {volume} textos por {period} custam cerca de {usd(best.row.cost * volume, 2)} com {short(best.row.model)} como redator (nota {num(best.row.mean)}).</p>
      ) : (
        <p>Nem o perfil Essencial cabe: {volume} textos por {period} custam {usd(options[0].row.cost * volume, 2)}. Reduza o volume ou aumente o orçamento; a plataforma não troca por um modelo abaixo do piso.</p>
      )}
      <p className="field-help">Considera só o custo do Redator, a única função medida até agora. O custo do conteúdo completo (plano, revisão, imagem e vídeo) entra quando essas funções forem medidas.</p>
    </section>
  );
}

function RunDetail({ id }) {
  const [data, setData] = useState(null);
  const [reveal, setReveal] = useState(false);
  useEffect(() => { fetch(`/api/lab/run?id=${encodeURIComponent(id)}`).then((r) => r.json()).then(setData).catch(() => setData({ error: "Não foi possível abrir a rodada." })); }, [id]);
  if (!data) return <p className="field-help">Abrindo…</p>;
  if (data.error) return <p className="form-error">{data.error}</p>;
  const briefs = data.run.config?.briefs || [];
  const texts = data.items.filter((i) => i.role === "redator");
  return (
    <div className="lab-run-detail">
      <label className="checkbox-label"><input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Mostrar qual modelo escreveu cada texto</label>
      {briefs.map((b) => (
        <details key={b.id}>
          <summary>{b.title} <small>· {b.format}</small></summary>
          {texts.filter((t) => t.brief_id === b.id).sort((a, c) => (c.mean ?? -1) - (a.mean ?? -1)).map((t, n) => (
            <article key={t.key} className="lab-text">
              <header>
                <b>{reveal ? short(t.model) : `Texto ${String.fromCharCode(65 + n)}`}</b>
                <span>{t.status === "failed" ? `falhou: ${t.error}` : `nota ${num(t.mean)}${reveal ? ` · ${usd(t.cost_usd)} · ${t.seconds ?? "—"} s` : ""}`}</span>
                {t.checks && !t.checks.ok && <span className="r-pill">Checagem: {(t.checks.issues || []).join("; ") || "fontes ou citações"}</span>}
              </header>
              {t.output?.body && <p className="lab-body">{t.output.body}</p>}
            </article>
          ))}
        </details>
      ))}
    </div>
  );
}

export function ModelLab() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const task = "redator";
  // "Geral" ranks every content type together; each format has its own ranking and profiles.
  const [view, setView] = useState("Geral");
  const [open, setOpen] = useState(null);
  useEffect(() => {
    fetch("/api/lab").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); }).catch((e) => setError(e.message || "Laboratório indisponível."));
  }, []);
  const scope = view === "Geral" ? data?.summary : data?.summary.byFormat?.[view];
  const rows = useMemo(() => (scope?.models || []).filter((m) => m.task === task).sort((a, b) => (b.mean ?? -1) - (a.mean ?? -1)), [scope]);
  if (error) return <p className="form-error">{error}</p>;
  if (!data) return <p className="field-help">Carregando o laboratório…</p>;
  const { floor } = data.summary;
  const picks = scope?.profiles?.[task];
  const formats = data.summary.formats || [];
  const maxCost = Math.max(...rows.map((r) => r.cost || 0));
  return (
    <div className="lab">
      <section className="r-panel">
        <h2>Laboratório de modelos</h2>
        <p>Cada modelo escreve o mesmo texto, com as mesmas fontes e instruções. Juízes cegos de outras famílias dão notas de 1 a 5 em clareza, evidência, voz e utilidade, sem saber quem escreveu. Um modelo é qualificado com nota média ≥ {num(floor.mean, 1)}, nenhuma evidência abaixo de {floor.evidence} e pelo menos {floor.minItems} textos avaliados.</p>
        <p className="field-help">Redator: {view === "Geral" ? "todos os tipos de conteúdo juntos" : `só ${view}`}. O melhor modelo pode mudar com o formato, por isso cada tipo tem ranking e perfis próprios.</p>
        <div className="r-tabs lab-formats" role="tablist" aria-label="Tipo de conteúdo">
          {["Geral", ...formats].map((name) => <button key={name} type="button" role="tab" aria-selected={view === name} onClick={() => setView(name)}>{name}</button>)}
        </div>
      </section>
      {rows.length ? (
        <>
          <div className="lab-profiles">
            {PROFILES.map(([id, name, rule]) => {
              const row = rows.find((r) => r.model === picks?.[id]);
              return (
                <section className="r-panel" key={id}>
                  <small className="label">{name}</small>
                  <h3>{row ? short(row.model) : "Nenhum qualificado ainda"}</h3>
                  {row && <p>Nota {num(row.mean)} · {usd(row.cost)} por texto · {row.p50 ?? "—"} s</p>}
                  <p className="field-help">{rule}</p>
                </section>
              );
            })}
          </div>
          <section className="r-panel">
            <h3>Nota × custo</h3>
            <details className="lab-howto">
              <summary>Como ler as notas</summary>
              <dl>
                <div><dt>Clareza</dt><dd>Dá para entender na primeira leitura, sem frase confusa nem jargão.</dd></div>
                <div><dt>Evidência</dt><dd>Tudo o que o texto afirma está na fonte. Nota baixa quer dizer que ele inventou ou exagerou um fato. É a nota que mais pesa para clientes jurídicos: uma única nota abaixo de {floor.evidence} desqualifica o modelo.</dd></div>
                <div><dt>Voz</dt><dd>Soa como a marca descrita no DNA, e não como um texto genérico.</dd></div>
                <div><dt>Utilidade</dt><dd>Vale o tempo de quem lê: traz algo concreto para fazer ou entender.</dd></div>
              </dl>
              <p className="field-help">Cada texto recebe notas de 1 a 5 de dois juízes, que não sabem qual modelo escreveu. A nota do modelo é a média de todos os textos. A checagem automática confere se as fontes citadas existem, se as citações estão literalmente na fonte e se o texto liga o tema à marca.</p>
            </details>
            <QualityCostChart rows={rows} picks={picks} floor={floor.mean} />
            <div className="lab-table-wrap" tabIndex={0} role="region" aria-label="Tabela dos modelos avaliados">
              <table className="lab-table">
                <caption className="sr-only">Redatores avaliados · {view}</caption>
                <thead><tr><th scope="col">Modelo</th><th scope="col">Nota</th><th scope="col">Custo por texto</th><th scope="col">vs. mais caro</th><th scope="col">Tempo (p50)</th><th scope="col">Avaliados</th><th scope="col">Situação</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.model}>
                      <th scope="row">{short(r.model)}</th>
                      <td>{num(r.mean)}</td>
                      <td>{usd(r.cost)}</td>
                      <td>{maxCost && r.cost ? `${Math.round((r.cost / maxCost) * 100)}%` : "—"}</td>
                      <td>{r.p50 ?? "—"} s</td>
                      <td>{r.judged}{r.failures ? ` · ${r.failures} falha${r.failures > 1 ? "s" : ""}` : ""}</td>
                      <td className="lab-why">{r.qualified ? "✓ Qualificado" : r.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <Simulator rows={rows} picks={picks} />
        </>
      ) : (
        <section className="r-panel"><p>Nenhuma rodada desta função entrou nos totais ainda. As rodadas abaixo ficam no histórico.</p></section>
      )}
      <section className="r-panel">
        <h3>Rodadas</h3>
        <ul className="lab-runs">
          {data.runs.map((r) => (
            <li key={r.id}>
              <button type="button" className="text-button" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <b>{r.id}</b> · {r.title}
              </button>
              <span>{STATUS[r.status] || r.status} · {usd(r.spent_usd, 2)}{r.budget_usd != null ? ` de ${usd(r.budget_usd, 2)}` : ""} · {r.outputs} saídas{r.config?.summary === false ? " · fora dos totais" : ""}</span>
              {r.notes && <small>{r.notes}</small>}
              {(r.config?.excludedBriefs || []).map((e) => <small key={e.id}>Fora dos totais: {(r.config.briefs || []).find((b) => b.id === e.id)?.title || e.id}. {e.reason}</small>)}
              {open === r.id && <RunDetail id={r.id} />}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
