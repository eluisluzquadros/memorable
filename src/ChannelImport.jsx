import React, { useState } from "react";
import { Radio, Check, ArrowRight } from "lucide-react";
import { assertEditor, saveMonitor } from "./operations.mjs";
import { longFetch } from "./long-fetch.mjs";

const KIND_LABEL = { youtube: "Canal do YouTube", feed: "Feed do site", sitemap: "Mapa do site", instagram: "Perfil do Instagram" };
const MONITOR_KIND = { youtube: "YouTube", feed: "RSS", sitemap: "Site", instagram: "Instagram" };

async function post(path, body) {
  const response = await longFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir. Confira se o serviço local está ativo.");
  return data;
}

// Registers a whole channel (YouTube, blog feed, Instagram) instead of one URL at a time.
export function ChannelImport({ state, setState, notify, onClose }) {
  const [url, setUrl] = useState("");
  const [channel, setChannel] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [watch, setWatch] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);
  const known = new Set(state.sources.filter((s) => s.workspace === state.workspace || s.shared).map((s) => s.url).filter(Boolean));

  const discover = async () => {
    setBusy("discover");
    setError("");
    setReport(null);
    try {
      const found = await post("/api/ingest/channel", { url });
      setChannel(found);
      setSelected(new Set(found.items.filter((i) => !known.has(i.url)).slice(0, 8).map((i) => i.url)));
    } catch (e) {
      setError(e.message);
      setChannel(null);
    } finally {
      setBusy("");
    }
  };
  const toggle = (itemUrl) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemUrl)) next.delete(itemUrl);
      else if (next.size < 12) next.add(itemUrl);
      return next;
    });
  const importSelected = async () => {
    try {
      assertEditor(state);
    } catch (e) {
      setError(e.message);
      return;
    }
    setBusy("import");
    setError("");
    try {
      const items = channel.items.filter((i) => selected.has(i.url)).map((i) => ({ ...i, kind: channel.kind }));
      const result = await post("/api/ingest/channel/import", { items, channelTitle: channel.title, channelUrl: channel.url });
      setState((s) => {
        const existing = new Set(s.sources.filter((x) => x.workspace === s.workspace).map((x) => x.url));
        const fresh = result.sources
          .filter((source) => !existing.has(source.url))
          .map((source) => ({ ...source, id: crypto.randomUUID(), workspace: s.workspace, citable: true, shared: false, editorialRole: "reference", date: new Date().toISOString(), feedback: "", demo: false, tags: [] }));
        let next = { ...s, sources: [...fresh, ...s.sources] };
        if (watch && !s.monitors.some((m) => m.workspace === s.workspace && m.url === channel.url))
          next = saveMonitor(next, { name: channel.title, url: channel.url, category: "Referência", kind: MONITOR_KIND[channel.kind] || "Site", mode: "channel", notes: "Canal importado: novas publicações entram no acervo a cada coleta." });
        return next;
      });
      setReport(result);
      notify(`${result.sources.length} publicações adicionadas ao acervo${watch ? " e canal acompanhado no Vigiar" : ""}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="channel-import">
      <label>
        Endereço do canal, blog ou perfil
        <div className="source-url-input">
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/@canal ou https://empresa.com.br/blog" />
          <button type="button" className="button primary" onClick={discover} disabled={!!busy || !url.trim()}>
            {busy === "discover" ? "Procurando publicações…" : "Listar publicações"}
          </button>
        </div>
      </label>
      <small className="field-help">YouTube (título e descrição de cada vídeo) · blogs e sites com feed RSS/Atom ou sitemap · Instagram com a conta conectada em Configurações.</small>
      {channel && (
        <section className="channel-list" aria-label="Publicações encontradas">
          <header>
            <Radio size={18} aria-hidden="true" />
            <div>
              <b>{channel.title}</b>
              <small>
                {KIND_LABEL[channel.kind]} · {channel.items.length} publicações recentes · {selected.size} selecionadas
              </small>
            </div>
          </header>
          <ul>
            {channel.items.map((item) => {
              const already = known.has(item.url);
              return (
                <li key={item.url} className={already ? "is-known" : ""}>
                  <label>
                    <input type="checkbox" checked={selected.has(item.url)} disabled={already} onChange={() => toggle(item.url)} />
                    <span>
                      <b>{item.title}</b>
                      <small>{already ? "Já está no acervo" : [item.publishedAt && new Date(item.publishedAt).toString() !== "Invalid Date" ? new Date(item.publishedAt).toLocaleDateString("pt-BR") : item.publishedAt, item.views].filter(Boolean).join(" · ") || new URL(item.url).hostname}</small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <label className="checkbox-label">
            <input type="checkbox" checked={watch} onChange={(e) => setWatch(e.target.checked)} />
            Acompanhar este canal no Vigiar: novas publicações entram sozinhas no acervo
          </label>
          <div className="dialog-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Fechar
            </button>
            <button type="button" className="button primary" onClick={importSelected} disabled={!!busy || !selected.size}>
              {busy === "import" ? "Importando e resumindo…" : `Importar ${selected.size} ${selected.size === 1 ? "publicação" : "publicações"}`} <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}
      {report && (
        <p className="channel-report" role="status">
          <Check size={16} aria-hidden="true" /> {report.sources.length} importadas
          {report.errors.length > 0 && ` · ${report.errors.length} não puderam ser lidas: ${report.errors.map((e) => e.title || e.url).slice(0, 3).join("; ")}`}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
