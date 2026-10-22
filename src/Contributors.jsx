import React, { useContext, useEffect, useState } from "react";
import { UserPlus, Trash2, Copy } from "lucide-react";
import { AppContext } from "./context";
import { workspaceList } from "./account-state.mjs";

async function api(url, body) {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Serviço local indisponível.");
  return data;
}
const blank = { name: "", email: "", area: "", workspaces: [] };

// People outside marketing get a restricted access that only sends ideas and follows their own.
export function Contributors() {
  const { state, notify } = useContext(AppContext);
  const brands = workspaceList(state);
  const admin = state.role === "Administrador";
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState({ ...blank, workspaces: brands.length === 1 ? [brands[0].id] : [] });
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api("/api/team/contributors").then((d) => setPeople(d.contributors)).catch((e) => notify(e.message, true));
  useEffect(() => { load(); }, []);
  const link = `${location.origin}${location.pathname}#sugerir`;
  async function invite(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api("/api/team/contributors", form);
      setCreated({ ...result.contributor, password: result.password });
      setForm({ ...blank, workspaces: form.workspaces });
      load();
    } catch (error) {
      notify(error.message, true);
    } finally {
      setBusy(false);
    }
  }
  async function remove(person) {
    try {
      await api("/api/team/contributors/remove", { id: person.id });
      notify(`Acesso de ${person.name} encerrado. As sugestões enviadas continuam registradas.`);
      load();
    } catch (error) {
      notify(error.message, true);
    }
  }
  const names = new Map(brands.map((b) => [b.id, b.name]));
  return (
    <section className="r-panel ct-panel">
      <h2>Colaboradores que sugerem ideias</h2>
      <p>
        Advogados, RH ou qualquer área podem sugerir assuntos sem ver a operação de marketing. Cada um entra por{" "}
        <b>{link}</b> e só vê o formulário de sugestão e o andamento das próprias ideias.
      </p>
      {admin ? (
        <form className="ct-form" onSubmit={invite}>
          <fieldset disabled={busy}>
            <div className="field-pair">
              <label>Nome<input required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>E-mail<input type="email" required maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            </div>
            <label>Área<input required minLength={2} maxLength={80} placeholder="Ex.: Tributário, RH, Sucessões" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
            <fieldset className="ct-brands">
              <legend>Pode sugerir para</legend>
              {brands.map((b) => (
                <label key={b.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={form.workspaces.includes(b.id)}
                    onChange={(e) => setForm({ ...form, workspaces: e.target.checked ? [...form.workspaces, b.id] : form.workspaces.filter((w) => w !== b.id) })}
                  />
                  {b.name}
                </label>
              ))}
            </fieldset>
            <button className="button primary" disabled={!form.workspaces.length}>
              <UserPlus size={16} /> {busy ? "Criando acesso…" : "Criar acesso"}
            </button>
          </fieldset>
        </form>
      ) : (
        <p className="field-help">Somente o papel Administrador convida ou remove colaboradores.</p>
      )}
      {created && (
        <div className="ct-created" role="status">
          <b>Acesso criado para {created.name}.</b>
          <p>Envie estes dados por um canal seguro. A senha aparece só agora.</p>
          <dl>
            <div><dt>Endereço</dt><dd>{link}</dd></div>
            <div><dt>E-mail</dt><dd>{created.email}</dd></div>
            <div><dt>Senha</dt><dd><code>{created.password}</code></dd></div>
          </dl>
          <button
            className="button secondary"
            onClick={() =>
              navigator.clipboard
                ?.writeText(`Acesse ${link}\nE-mail: ${created.email}\nSenha: ${created.password}`)
                .then(() => notify("Dados de acesso copiados."), () => notify("Copie os dados manualmente.", true))
            }
          >
            <Copy size={15} /> Copiar dados de acesso
          </button>
        </div>
      )}
      {people.length > 0 && (
        <ul className="ct-list">
          {people.map((p) => (
            <li key={p.id}>
              <div>
                <b>{p.name}</b>
                <span>{p.area} · {p.email}</span>
                <small>{p.workspaces.map((w) => names.get(w) || "Marca arquivada").join(", ")}</small>
              </div>
              {admin && (
                <button className="button secondary" onClick={() => remove(p)} aria-label={`Encerrar acesso de ${p.name}`}>
                  <Trash2 size={15} /> Encerrar acesso
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
