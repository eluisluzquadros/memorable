import React, { useContext, useState } from "react";
import { Upload, FileText, MessageSquareText, Check, ArrowRight } from "lucide-react";
import { AppContext } from "./context";
import { strategicSource } from "./operations.mjs";
import { longFetch } from "./long-fetch.mjs";

// The interview gives a brand without a website (or with a thin one) the same footing: what it
// sells, to whom, how it talks, what it never says and which proof it can cite.
export const INTERVIEW = [
  ["offer", "O que vocês fazem e vendem?", "Serviços, produtos ou áreas de atuação."],
  ["audience", "Para quem? Quem é o cliente ideal e que problema ele traz?", ""],
  ["why", "Por que escolhem vocês e não um concorrente?", ""],
  ["proof", "Que provas vocês podem citar?", "Números, tempo de mercado, resultados documentados. Só o que pode ser comprovado."],
  ["voice", "Como vocês falam com o cliente?", "Três adjetivos e um exemplo de frase."],
  ["never", "O que vocês nunca dizem ou prometem?", "Inclua as regras do seu setor (ex.: OAB, CFM, CVM)."],
  ["words", "Palavras que vocês usam e palavras que evitam.", ""],
  ["peers", "Quem são os concorrentes ou referências?", ""],
  ["samples", "Cole de 1 a 3 textos que são a cara da marca.", "Posts, e-mails, trechos de proposta."],
];
const interviewText = (answers) =>
  INTERVIEW.filter(([k]) => answers[k]?.trim())
    .map(([k, q]) => `Pergunta: ${q}\nResposta: ${answers[k].trim()}`)
    .join("\n\n");

function Interview({ onSaved }) {
  const { state, setState, notify, workspace } = useContext(AppContext);
  const saved = state.brandInterview?.[state.workspace] || {};
  const [answers, setAnswers] = useState(saved);
  const filled = INTERVIEW.filter(([k]) => answers[k]?.trim()).length;
  function save() {
    const text = interviewText(answers);
    if (filled < 3) return notify("Responda pelo menos três perguntas para a entrevista virar fonte da marca.", true);
    const id = `interview-${state.workspace}`;
    const source = {
      id,
      workspace: state.workspace,
      title: "Entrevista da marca",
      url: "",
      type: "Texto",
      text,
      summary: (answers.offer || answers.why || "").slice(0, 280),
      origin: `Entrevista respondida pela equipe · ${workspace.name}`,
      citable: true,
      shared: false,
      editorialRole: "owned",
      date: new Date().toISOString(),
      feedback: "",
      demo: false,
      tags: ["dna", "entrevista"],
    };
    setState((s) => ({
      ...s,
      brandInterview: { ...(s.brandInterview || {}), [s.workspace]: answers },
      sources: [source, ...s.sources.filter((x) => x.id !== id)],
    }));
    onSaved(id);
    notify("Entrevista salva no acervo como conteúdo oficial da marca.");
  }
  return (
    <div className="bs-interview">
      {INTERVIEW.map(([key, question, help]) => (
        <label key={key}>
          {question}
          <textarea rows={key === "samples" ? 5 : 2} maxLength={3000} value={answers[key] || ""} onChange={(e) => setAnswers({ ...answers, [key]: e.target.value })} />
          {help && <small className="field-help">{help}</small>}
        </label>
      ))}
      <div className="bs-interview-foot">
        <span>{filled} de {INTERVIEW.length} respondidas</span>
        <button type="button" className="button secondary" onClick={save}>
          <Check size={16} /> Salvar entrevista
        </button>
      </div>
    </div>
  );
}

// Official brand material: the team picks what feeds the DNA; files go to the acervo first.
export function BrandSources({ selected = [], onToggle = () => {}, onAdded = () => {}, selectable = true, manage = true, onManage = null, title = "Materiais da marca", intro = "Além do site, use o que a marca já produziu: apresentações, propostas, manuais, gravações. Sem site, comece pela entrevista." }) {
  const { state, setState, notify } = useContext(AppContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [interviewOpen, setInterviewOpen] = useState(false);
  const owned = state.sources.filter((s) => s.workspace === state.workspace && strategicSource(s) && s.text?.trim());
  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const response = await longFetch("/api/ingest/file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: file.name, mimeType: file.type || "application/octet-stream", data: btoa(binary) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível ler este arquivo.");
      const source = {
        ...result,
        id: crypto.randomUUID(),
        workspace: state.workspace,
        title: result.title || file.name,
        origin: `Material da marca · ${file.name}`,
        citable: true,
        shared: false,
        editorialRole: "owned",
        date: new Date().toISOString(),
        feedback: "",
        demo: false,
        tags: ["dna"],
      };
      setState((s) => ({ ...s, sources: [source, ...s.sources] }));
      onAdded(source.id);
      notify("Material lido e guardado no acervo como conteúdo oficial da marca.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bs-panel">
      <div className="bs-head">
        <h3>{title}</h3>
        <p>{intro}</p>
      </div>
      {owned.length > 0 ? (
        <ul className="bs-list">
          {owned.map((s) => (
            <li key={s.id}>
              {selectable ? (
                <label className="checkbox-label">
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => onToggle(s.id)} />
                  <FileText size={16} aria-hidden="true" />
                  <span>
                    <b>{s.title}</b>
                    <small>{s.origin || s.url}</small>
                  </span>
                </label>
              ) : (
                <div className="bs-item">
                  <FileText size={16} aria-hidden="true" />
                  <span>
                    <b>{s.title}</b>
                    <small>{s.origin || s.url}</small>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-help">Nenhum material oficial ainda. Envie um arquivo, responda a entrevista ou marque referências do acervo como “Conteúdo oficial da marca”.</p>
      )}
      {!manage && onManage && (
        <button type="button" className="text-button" onClick={onManage}>
          Adicionar material ou responder a entrevista <ArrowRight size={15} aria-hidden="true" />
        </button>
      )}
      {manage && <div className="bs-actions">
        <label className={`button secondary bs-upload ${busy ? "is-busy" : ""}`}>
          <Upload size={16} aria-hidden="true" /> {busy ? "Lendo arquivo…" : "Enviar material (PDF, Word, texto, áudio)"}
          <input type="file" accept=".pdf,.docx,.txt,.md,.csv,.html,.json,.mp3,.m4a,.wav,.mp4,.webm" onChange={upload} disabled={busy} />
        </label>
        <button type="button" className="button secondary" aria-expanded={interviewOpen} onClick={() => setInterviewOpen((v) => !v)}>
          <MessageSquareText size={16} aria-hidden="true" /> {state.brandInterview?.[state.workspace] ? "Editar entrevista da marca" : "Responder entrevista da marca"}
        </button>
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {interviewOpen && <Interview onSaved={(id) => { onAdded(id); setInterviewOpen(false); }} />}
    </div>
  );
}
