import React, { useEffect, useState } from "react";
import { ArrowRight, ExternalLink, LogOut, ShieldAlert } from "lucide-react";
import { Brand } from "./Landing";
import "./contribute.css";

async function api(url, body) {
  const response = await fetch(url, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Serviço indisponível. Tente novamente em instantes.");
    error.status = response.status;
    throw error;
  }
  return data;
}
const day = (d) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const blank = { workspace: "", title: "", why: "", knowledge: "experience", referenceUrl: "", referenceText: "" };

function Login({ onDone }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="cb-page cb-login">
      <Brand />
      <h1>Sugira uma ideia de conteúdo.</h1>
      <p>Acesso para colaboradores convidados pelo time de marketing.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/api/contributor/login", form);
            onDone();
          } catch (err) {
            setError(err.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>E-mail<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Senha<input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary" disabled={busy}>{busy ? "Entrando…" : "Entrar"} <ArrowRight size={17} /></button>
      </form>
      <p className="cb-help">Não tem acesso? Peça ao time de marketing da sua empresa.</p>
    </main>
  );
}

export default function ContributePage() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    api("/api/contributor/me")
      .then((data) => {
        setMe(data);
        setForm((f) => ({ ...f, workspace: f.workspace || data.brands[0]?.id || "" }));
      })
      .catch((e) => {
        setMe(null);
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setChecking(false));
  useEffect(() => {
    document.title = "Sugerir ideia · Memorable";
    load();
  }, []);
  if (checking) return <main className="cb-page"><Brand /><p role="status">Carregando…</p></main>;
  if (!me) return <Login onDone={load} />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSent("");
    try {
      await api("/api/contributor/suggestions", form);
      setForm({ ...blank, workspace: form.workspace });
      setSent("Sugestão enviada. O time de marketing vai avaliar, e o andamento aparece abaixo.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="cb-page">
      <header className="cb-top">
        <Brand />
        <div>
          <span>{me.contributor.name} · {me.contributor.area}</span>
          <button
            className="text-button"
            onClick={async () => {
              await api("/api/contributor/logout", {}).catch(() => {});
              setMe(null);
            }}
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>
      <section className="cb-intro">
        <h1>Que assunto {me.organization || "sua empresa"} deveria contar?</h1>
        <p>
          Você vê coisas que o marketing não vê: uma decisão nova, uma dúvida que todo cliente faz, um caso que ensina algo.
          Conte o assunto. O time decide se e como ele vira conteúdo, e você acompanha aqui.
        </p>
      </section>
      {!me.brands.length ? (
        <p className="form-error">Nenhuma marca está liberada para suas sugestões no momento. Fale com o time de marketing.</p>
      ) : (
        <form className="cb-form" onSubmit={submit}>
          {me.brands.length > 1 && (
            <label>
              Para qual marca?
              <select value={form.workspace} onChange={(e) => setForm({ ...form, workspace: e.target.value })}>
                {me.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          )}
          <label>
            O assunto, em uma frase
            <input required minLength={5} maxLength={140} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: O que muda com a nova regra do ITCMD para imóveis no exterior" />
          </label>
          <label>
            Por que isso importa agora?
            <textarea required minLength={20} maxLength={2000} rows={4} value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} placeholder="Quem é afetado, o que mudou, que dúvida isso responde." />
          </label>
          <fieldset className="cb-knowledge">
            <legend>De onde vem essa informação?</legend>
            {[["experience", "Sei disso pela minha experiência"], ["link", "Tenho um link (notícia, decisão, artigo)"]].map(([value, label]) => (
              <label key={value} className={form.knowledge === value ? "selected" : ""}>
                <input type="radio" name="knowledge" value={value} checked={form.knowledge === value} onChange={() => setForm({ ...form, knowledge: value })} />
                {label}
              </label>
            ))}
          </fieldset>
          {form.knowledge === "link" && (
            <label>
              Link da referência
              <input type="url" required value={form.referenceUrl} onChange={(e) => setForm({ ...form, referenceUrl: e.target.value })} placeholder="https://" />
            </label>
          )}
          <label>
            <span>Detalhes, dados ou trecho importante <span className="cb-optional">opcional</span></span>
            <textarea rows={4} maxLength={6000} value={form.referenceText} onChange={(e) => setForm({ ...form, referenceText: e.target.value })} />
          </label>
          <p className="cb-warning">
            <ShieldAlert size={17} aria-hidden="true" />
            Não inclua nomes ou dados de clientes, nem informações sigilosas. Descreva o caso de forma que ninguém possa ser identificado.
          </p>
          {error && <p className="form-error" role="alert">{error}</p>}
          {sent && <p className="cb-sent" role="status">{sent}</p>}
          <button className="button primary" disabled={busy}>{busy ? "Enviando…" : "Enviar sugestão"} <ArrowRight size={17} /></button>
        </form>
      )}
      <section className="cb-mine">
        <h2>Minhas sugestões</h2>
        {!me.suggestions.length ? (
          <p>Você ainda não enviou sugestões.</p>
        ) : (
          <ul>
            {me.suggestions.map((s) => (
              <li key={s.id}>
                <div>
                  <b>{s.title}</b>
                  <span>{s.brand} · {day(s.createdAt)}</span>
                  {s.reason && <p>Resposta do time: {s.reason}</p>}
                  {s.link && <a href={s.link} target="_blank" rel="noreferrer">Ver publicação <ExternalLink size={14} aria-hidden="true" /></a>}
                </div>
                <em className={`cb-status cb-${s.label === "Não seguiu" ? "declined" : s.label === "Publicada" ? "published" : s.label === "Recebida" ? "received" : "progress"}`}>{s.label}</em>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
