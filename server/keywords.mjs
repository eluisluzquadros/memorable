// Keywords for a reference: what the text is about, not which words it repeats. Free and local:
// named phrases (brands, events, places) first, then repeated pairs, then content words.

const plain = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Portuguese function words and frequent verbs, compared without accents.
const STOP = new Set(plain(`
a o os as um uma uns umas ao aos à às de da do das dos dum duma em no na nos nas num numa
por pelo pela pelos pelas para pra pro com sem sob sobre entre ate até desde contra perante após apos ante
que e ou mas nem se como quando onde quem qual quais quanto quanta quantos quantas cujo cuja porque pois porem porém
logo entao então assim tambem também ainda ja já nao não sim tao tão so só apenas mesmo mesma mesmos mesmas
muito muita muitos muitas pouco pouca poucos poucas mais menos bem mal tudo todo toda todos todas nada algo alguem alguém
algum alguma alguns algumas cada outro outra outros outras tal tais qualquer quaisquer varios vários varias várias
eu tu ele ela nos nós vos vós eles elas voce você voces vocês me te lhe lhes se mim ti si conosco consigo
meu minha meus minhas teu tua teus tuas seu sua seus suas nosso nossa nossos nossas dele dela deles delas
este esta estes estas esse essa esses essas aquele aquela aqueles aquelas isto isso aquilo aqui ali la lá aí ai cá ca
hoje ontem amanha amanhã agora antes depois sempre nunca jamais talvez quase sobretudo inclusive enquanto durante
ser sou es é somos sao são era eram fui foi fomos foram sera será serao serão seja sejam sendo sido
estar estou esta está estamos estao estão estava estavam esteve estiveram estando estado
ter tenho tem tem têm temos tinha tinham teve tiveram tera terá tendo tido haver ha há havia houve
fazer faz fazem fiz fez fizeram fazendo feito feita poder pode podem podemos pude pôde podia puder possa possam
querer quer querem quis quero queremos ir vai vao vão vamos foi ia iam indo vir vem vêm veio vindo
dar da dá dão dao deu dar ver vê ve veem viu visto saber sabe sabem dizer diz dizem disse ficar fica ficam ficou
deve devem dever precisa precisam precisar passar passa passou chegar chega levar leva traz trazer
ano anos dia dias vez vezes forma modo parte lado tipo coisa coisas pessoa pessoas grande grandes novo nova novos novas
clique acesse saiba veja confira leia inscreva inscreva-se cadastre baixe compartilhe siga voltar topo menu home inicio início
pagina página site contato whatsapp instagram facebook linkedin youtube twitter email e-mail cookies politica política
privacidade termos direitos reservados copyright todos www com br http https
selecione escolha enviar envie nome sobrenome telefone celular cidade estado cargo mensagem obrigatorio obrigatório
campo campos opcao opção formulario formulário preencha cep endereco endereço sala andar bairro
`).split(/\s+/).filter(Boolean));
// A capitalized run right after one of these is an address, not a subject.
const ADDRESS = new Set(["av", "avenida", "rua", "r", "alameda", "travessa", "rodovia", "estrada", "praca", "praça", "largo", "n", "nº", "no"]);

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;
const capitalized = (w) => /^\p{Lu}/u.test(w);
const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e"]);

// With a model, a reference gets a summary of what it says and its central themes. Every theme must
// share a content word with the text, so nothing the source never mentions is attached to it.
export async function enrichReference(reference, model) {
  const result = await model(
    "Atue como bibliotecário de referências de uma equipe de marketing. Leia a referência e diga o que ela afirma, sem tom de anúncio. " +
      'Retorne json {"resumo": string, "temas": string[]}. "resumo" tem 2 ou 3 frases com os fatos do texto. "temas" são de 6 a 8 temas centrais: substantivos ou expressões curtas em português, com acento, maiúscula só em nomes próprios, sem verbos, sem pessoas citadas de passagem, sem endereços e sem termos de menu, botão ou formulário.',
    { titulo: reference.title || "", texto: String(reference.text || "").slice(0, 12000) },
  );
  const text = plain(reference.text || "");
  const grounded = (theme) => plain(theme).match(/[a-z0-9]+/g)?.some((w) => w.length >= 4 && !STOP.has(w) && text.includes(w));
  const themes = (Array.isArray(result.temas) ? result.temas : [])
    .filter((t) => typeof t === "string" && t.trim().length >= 3 && t.length <= 60 && grounded(t))
    .map((t) => t.trim());
  const summary = typeof result.resumo === "string" ? result.resumo.trim().slice(0, 750) : "";
  if (themes.length < 3 || summary.length < 40) throw new Error("O modelo não devolveu resumo e temas sustentados pelo texto.");
  return { summary, keywords: [...new Set(themes)].slice(0, 8), keywordSource: "model" };
}

export function keywordsOf(text, limit = 8) {
  const sentences = typeof Intl?.Segmenter === "function"
    ? [...new Intl.Segmenter("pt-BR", { granularity: "sentence" }).segment(text)].map((s) => s.segment)
    : text.split(/(?<=[.!?])\s+/);
  const phrases = new Map(); // key -> { surface: Map<form, n>, n, kind }
  const add = (words, kind, weight) => {
    const key = plain(words.join(" "));
    const entry = phrases.get(key) || { forms: new Map(), n: 0, kind, weight };
    const form = words.join(" ");
    entry.forms.set(form, (entry.forms.get(form) || 0) + 1);
    entry.n += 1;
    entry.weight = Math.max(entry.weight, weight);
    phrases.set(key, entry);
  };
  for (const sentence of sentences) {
    const words = sentence.match(WORD) || [];
    // Named phrases: two or more capitalized words, allowing "de/da/do/e" inside. The first word of a
    // sentence only counts when the next one is capitalized too.
    for (let i = 0; i < words.length; i++) {
      if (!capitalized(words[i]) || STOP.has(plain(words[i]))) continue;
      const run = [words[i]];
      let j = i + 1;
      while (j < words.length) {
        if (capitalized(words[j]) && !STOP.has(plain(words[j]))) { run.push(words[j]); j++; continue; }
        if (CONNECTORS.has(plain(words[j])) && j + 1 < words.length && capitalized(words[j + 1])) { run.push(words[j], words[j + 1]); j += 2; continue; }
        break;
      }
      const afterAddress = i > 0 && ADDRESS.has(plain(words[i - 1]).replace(/\.$/, ""));
      if (run.length >= 2 && run.length <= 5 && !afterAddress) { add(run, "name", 2); i = j - 1; }
    }
    // Pairs of content words that appear together.
    const content = words.map((w) => ({ w, k: plain(w) }));
    for (let i = 0; i + 1 < content.length; i++) {
      const [a, b] = [content[i], content[i + 1]];
      if (a.k.length < 4 || b.k.length < 4 || STOP.has(a.k) || STOP.has(b.k) || /^\d+$/.test(a.k + b.k)) continue;
      add([a.w, b.w], "pair", 1.5);
    }
    for (const { w, k } of content) if (k.length >= 4 && !STOP.has(k) && !/^\d+$/.test(k)) add([w], "word", 1);
  }
  // A word keeps its capital only when the text never writes it in lower case (a name, an acronym).
  const best = (entry) => {
    const forms = [...entry.forms].sort((x, y) => y[1] - x[1]).map(([form]) => form);
    return forms.find((form) => form === form.toLowerCase()) || forms[0];
  };
  const scored = [...phrases]
    // A name cited once (a speaker, a sponsor) is not what the text is about; a pair must repeat.
    .filter(([, e]) => (e.kind === "word" ? true : e.n >= 2))
    .map(([key, e]) => ({ key, text: best(e), score: e.n * e.weight, kind: e.kind }))
    .sort((a, b) => b.score - a.score || a.text.localeCompare(b.text, "pt-BR"));
  const chosen = [];
  for (const c of scored) {
    if (chosen.length >= limit) break;
    // A word already inside a chosen phrase, or a phrase that only repeats a chosen word, adds nothing.
    if (chosen.some((k) => k.key.split(" ").includes(c.key) || c.key.split(" ").every((part) => k.key.split(" ").includes(part)))) continue;
    chosen.push(c);
  }
  return chosen.map((c) => c.text);
}
