import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "./context";
import { profileWriters } from "./model-roles.mjs";
import { formatMoney } from "./currency.mjs";
import { useCurrency } from "./CurrencyControls";

const ROLES = [
  ["writer", "Redator", "Escreve as versões e aplica as recomendações do refino."],
  ["reviewer", "Revisor", "Aponta o que melhorar, sempre com recomendação, na geração e no refino."],
  ["judge", "Juiz cego", "Compara a versão atual com a refinada sem saber quem escreveu."],
];
const family = (id = "") => id.split("/")[0];
const PROFILES = [["essencial", "Essencial"], ["equilibrado", "Equilibrado"], ["excelencia", "Excelência"]];
const short = (id = "") => id.split("/").pop();
const num = (v) => v.toFixed(2).replace(".", ",");
// Prices arrive in dollars per million tokens; shown in the chosen currency ("R$ 5,40 / 27,00 por 1M tokens").
const price = (m) => (m.input != null && m.output != null ? ` · ${formatMoney(Number(m.input), 2)} / ${formatMoney(Number(m.output), 2).replace(/^[^d]+/, "")} por 1M tokens` : "");

// Which model plays each role. The account's choice wins over the service defaults.
export function ModelRoles() {
  const { state, setState, notify } = useContext(AppContext);
  useCurrency();
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
  const [lab, setLab] = useState(null);
  useEffect(() => {
    // Profiles measured by the model lab (Time de agentes > Laboratório); absent without an account.
    fetch("/api/lab").then((r) => (r.ok ? r.json() : null)).then((d) => setLab(d?.summary || null)).catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => setError("Serviço local indisponível."));
  }, []);
  const roles = state.modelRoles || {};
  const admin = state.role === "Administrador";
  const chosen = (role) => roles[role] || catalog?.roleDefaults?.[role] || catalog?.defaultModel;
  const sameFamily = catalog?.roleDefaults && family(chosen("judge")) === family(chosen("writer"));
  const change = (role, value) => {
    setState((s) => ({ ...s, modelRoles: { ...(s.modelRoles || {}), [role]: value || undefined } }));
    notify("Modelo da função atualizado. Vale para as próximas gerações e refinos.");
  };
  const inCatalog = (model) => catalog?.models?.some((m) => m.id === model && m.available !== false);
  const setWriters = (writerByFormat, message) => {
    setState((s) => ({ ...s, modelRoles: { ...(s.modelRoles || {}), writerByFormat } }));
    notify(message);
  };
  const setFormatWriter = (format, model) => {
    const next = { ...(roles.writerByFormat || {}) };
    if (model) next[format] = model; else delete next[format];
    setWriters(next, `Redator de ${format} atualizado. Vale para as próximas gerações.`);
  };
  const applyProfile = (id, name) => {
    const next = profileWriters(lab.byFormat, id, inCatalog);
    setWriters(next, `Perfil ${name} aplicado em ${Object.keys(next).length} formatos. Os demais usam o Redator geral.`);
  };
  return (
    <section className="r-panel mr-panel">
      <h2>Quem faz o quê</h2>
      <p>Cada função do time pode usar um modelo diferente. Quem escreve não deve ser quem avalia: compare qualidade, tempo e preço antes de trocar.</p>
      {error && <p className="form-error">{error}</p>}
      {catalog && !catalog.roleDefaults && <p className="field-help">Configure um provedor de IA no serviço para escolher modelos.</p>}
      {catalog?.roleDefaults && (
        <div className="mr-grid">
          {ROLES.map(([role, label, help]) => (
            <label key={role}>
              {label}
              <select value={roles[role] || ""} disabled={!admin || !catalog.modelChoice} onChange={(e) => change(role, e.target.value)}>
                <option value="">Padrão do serviço · {catalog.roleDefaults[role]}</option>
                {catalog.models
                  .filter((m) => m.available !== false)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}{price(m)}
                    </option>
                  ))}
              </select>
              <small className="field-help">{help}</small>
            </label>
          ))}
        </div>
      )}
      {lab?.byFormat && catalog?.modelChoice && (
        <div className="mr-profiles">
          <h3>Redator por tipo de conteúdo</h3>
          <p className="field-help">Do Laboratório: o melhor redator muda com o formato, por isso cada tipo é medido e escolhido separado. Formato sem escolha usa o Redator acima. Só entram modelos acima do piso de qualidade.</p>
          <div className="mr-apply">
            {PROFILES.map(([id, name]) => (
              <button key={id} type="button" className="button secondary" disabled={!admin} onClick={() => applyProfile(id, name)}>Aplicar {name} a todos</button>
            ))}
          </div>
          <ul>
            {(lab.formats || []).map((format) => {
              const picks = lab.byFormat[format]?.profiles?.redator;
              const current = roles.writerByFormat?.[format] || "";
              const options = picks ? [...new Set(PROFILES.map(([id]) => picks[id]))].filter(inCatalog) : [];
              const row = (model) => lab.byFormat[format].models.find((m) => m.task === "redator" && m.model === model);
              const label = (model) => {
                const names = PROFILES.filter(([id]) => picks?.[id] === model).map(([, n]) => n).join(" e ");
                const r = row(model);
                return `${names} · ${short(model)}${r ? ` · nota ${num(r.mean)} · ${formatMoney(r.cost, 4)} por texto` : ""}`;
              };
              return (
                <li key={format}>
                  <span><b>{format}</b></span>
                  {options.length ? (
                    <select aria-label={`Redator de ${format}`} value={current} disabled={!admin} onChange={(e) => setFormatWriter(format, e.target.value)}>
                      <option value="">Redator geral · {short(chosen("writer"))}</option>
                      {current && !options.includes(current) && <option value={current}>{short(current)} (escolhido antes)</option>}
                      {options.map((model) => <option key={model} value={model}>{label(model)}</option>)}
                    </select>
                  ) : (
                    <small className="field-help">Nenhum modelo passou no piso ainda; usa o Redator geral.</small>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {catalog?.roleDefaults && !catalog.modelChoice && <p className="field-help">O serviço usa Claude direto na Anthropic; a escolha por função exige o OpenRouter.</p>}
      {sameFamily && <p className="mr-warning">O juiz cego é da mesma família do redator ({family(chosen("writer"))}). Prefira outra família para que ele não favoreça o próprio estilo.</p>}
      {!admin && <p className="field-help">Somente o papel Administrador altera os modelos.</p>}
    </section>
  );
}
