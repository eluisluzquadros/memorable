import React, { useContext, useEffect, useState } from "react";
import { AppContext } from "./context";

const ROLES = [
  ["writer", "Redator", "Escreve as versões e aplica as recomendações do refino."],
  ["reviewer", "Revisor", "Aponta o que melhorar, sempre com recomendação, na geração e no refino."],
  ["judge", "Juiz cego", "Compara a versão atual com a refinada sem saber quem escreveu."],
];
const family = (id = "") => id.split("/")[0];
const price = (m) => (m.input != null && m.output != null ? ` · US$ ${Number(m.input).toFixed(2)} / ${Number(m.output).toFixed(2)} por 1M tokens` : "");

// Which model plays each role. The account's choice wins over the service defaults.
export function ModelRoles() {
  const { state, setState, notify } = useContext(AppContext);
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState("");
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
      {catalog?.roleDefaults && !catalog.modelChoice && <p className="field-help">O serviço usa Claude direto na Anthropic; a escolha por função exige o OpenRouter.</p>}
      {sameFamily && <p className="mr-warning">O juiz cego é da mesma família do redator ({family(chosen("writer"))}). Prefira outra família para que ele não favoreça o próprio estilo.</p>}
      {!admin && <p className="field-help">Somente o papel Administrador altera os modelos.</p>}
    </section>
  );
}
