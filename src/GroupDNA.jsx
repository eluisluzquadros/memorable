import React, { useContext, useState } from "react";
import { ShieldCheck, Plus, ArrowRight } from "lucide-react";
import { AppContext } from "./context";
import { workspaceList } from "./account-state.mjs";
import { longFetch } from "./long-fetch.mjs";

const VOICE_FIELDS = ["tone", "audience", "positioning", "pillars", "say", "avoid", "examples", "checklist"];
const RULES = [
  ["rules", "Regras para todas as marcas", "Compliance e limites comuns. Ex.: nenhuma marca promete resultado de causa; publicidade da advocacia segue o Provimento 205/2021 da OAB."],
  ["architecture", "Como as marcas se relacionam", "O papel de cada marca e o que uma pode dizer da outra. Ex.: a 2B Juris conecta pessoas a escritórios e não se apresenta como escritório."],
  ["values", "Valores do grupo", "O que todas as marcas compartilham."],
];
const sev = (s) => (s === "alta" ? "high" : s === "baixa" ? "low" : "mid");

// The group's twin: shared rules every brand inherits, and a coherence review across all brand DNAs.
export function GroupDNA() {
  const { state, setState, notify, changeWorkspace, goto } = useContext(AppContext);
  const brands = workspaceList(state);
  const admin = state.role === "Administrador";
  const saved = state.groupDNA || {};
  const [form, setForm] = useState({ rules: saved.rules || "", architecture: saved.architecture || "", values: saved.values || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const coherence = saved.coherence;
  const save = (next = form, message = "Regras do grupo salvas. Valem para toda nova criação de todas as marcas.") => {
    setState((s) => ({ ...s, groupDNA: { ...(s.groupDNA || {}), ...next, updatedAt: new Date().toISOString() } }));
    notify(message);
  };
  async function check() {
    setBusy(true);
    setError("");
    try {
      const response = await longFetch("/api/group-coherence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group: { name: state.organizationName || "Grupo", ...form },
          brands: brands.map((w) => {
            const dna = state.brandDNA?.[w.id];
            return { name: w.name, voice: state.voices?.[w.id] || {}, dna: dna ? { positioning: dna.positioning || "", revision: dna.revision } : null };
          }),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Serviço de IA indisponível.");
      setState((s) => ({ ...s, groupDNA: { ...(s.groupDNA || {}), ...form, coherence: data } }));
      notify("Coerência do grupo revisada.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const addRule = (rule) => {
    const rules = [form.rules.trim(), rule].filter(Boolean).join("\n");
    const next = { ...form, rules };
    setForm(next);
    save(next, "Regra adicionada às regras do grupo.");
  };
  return (
    <section className="r-panel gd-panel" aria-labelledby="gd-title">
      <h2 id="gd-title">DNA do grupo</h2>
      <p>O gêmeo digital do grupo é feito do DNA de cada marca e de regras que valem para todas. Toda criação de qualquer marca recebe essas regras, acima da voz da própria marca.</p>
      <table className="gd-matrix">
        <thead>
          <tr><th scope="col">Marca</th><th scope="col">DNA</th><th scope="col">Ficha de voz</th><th scope="col">Posicionamento</th><th scope="col"><span className="sr-only">Ação</span></th></tr>
        </thead>
        <tbody>
          {brands.map((w) => {
            const dna = state.brandDNA?.[w.id];
            const voice = state.voices?.[w.id] || {};
            const filled = VOICE_FIELDS.filter((k) => String(voice[k] || "").trim()).length;
            return (
              <tr key={w.id}>
                <th scope="row"><span className="workspace-avatar" style={{ background: w.color }}>{w.initials}</span>{w.name}</th>
                <td>{dna ? `Validado · v${dna.revision}` : "A extrair"}</td>
                <td>{filled} de {VOICE_FIELDS.length}</td>
                <td className="gd-pos">{voice.positioning || "—"}</td>
                <td>
                  <button className="text-button" onClick={() => { changeWorkspace(w.id); goto("cerebro/dna"); }} aria-label={`Abrir o DNA de ${w.name}`}>
                    Abrir DNA <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="gd-rules">
        {RULES.map(([key, label, help]) => (
          <label key={key}>
            {label}
            <textarea rows={key === "values" ? 2 : 4} maxLength={6000} disabled={!admin} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            <small className="field-help">{help}</small>
          </label>
        ))}
      </div>
      <div className="r-actions gd-actions">
        <button className="button secondary" disabled={!admin} onClick={() => save()}>Salvar regras do grupo</button>
        <button className="button secondary" disabled={busy} onClick={check}>
          <ShieldCheck size={16} aria-hidden="true" /> {busy ? "Revisando o grupo…" : "Checar coerência do grupo"}
        </button>
      </div>
      {!admin && <p className="field-help">Somente o papel Administrador altera as regras do grupo.</p>}
      {busy && <p role="status" className="field-help">Lendo a ficha de voz de cada marca e as regras do grupo. Leva cerca de meio minuto.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {coherence && (
        <div className="gd-result">
          <h3>Coerência do grupo</h3>
          <ul className="rf-problems">
            {coherence.problems.map((p, i) => (
              <li key={i}>
                <span className={`rf-sev rf-sev-${sev(p.severity)}`}>{p.severity}</span>
                <div>
                  <b className="gd-kind">{p.kind}{p.brands.length ? ` · ${p.brands.join(", ")}` : ""}</b>
                  <p>{p.problem}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="rf-recommendation">
            <h4>Recomendação</h4>
            <p>{coherence.recommendation}</p>
          </div>
          {coherence.suggestedRules?.length > 0 && (
            <div>
              <h4>Regras sugeridas</h4>
              <ul className="gd-suggested">
                {coherence.suggestedRules.map((rule) => (
                  <li key={rule}>
                    <span>{rule}</span>
                    <button className="text-button" disabled={!admin || form.rules.includes(rule)} onClick={() => addRule(rule)}>
                      <Plus size={14} aria-hidden="true" /> {form.rules.includes(rule) ? "Adicionada" : "Adicionar às regras"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="gd-disclaimer">Leitura de risco feita por IA a partir do que as marcas publicam, para a decisão do jurídico do grupo. Não é parecer jurídico.</p>
          <small className="field-help">Revisado em {new Date(coherence.at).toLocaleString("pt-BR")} com {coherence.brands.length} marcas com ficha de voz.</small>
        </div>
      )}
    </section>
  );
}
