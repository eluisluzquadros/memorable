// Narration with Gemini text-to-speech (Google AI API): one WAV per line, each checked (length + transcription)
// against the text and redone up to 3 times. The key (GEMINI_API_KEY in .env) is never printed. Free tier: 10 requests/day per model.
//   node --env-file=.env scripts/tts-gemini.mjs <out-dir> <voice> "<line 1>" ["<line 2>" ...] [--model gemini-3.8-flash-tts] [--style "..."]
// Voices are Gemini's prebuilt ones (Kore, Charon, Orus, Puck, Aoede, Leda, ...).
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const [outDir, voice, ...lines] = positional;
const model = opt("model", "gemini-3.8-flash-tts");
const style = opt("style", "");
if (!outDir || !voice || !lines.length) throw new Error("Uso: tts-gemini.mjs <pasta> <voz> \"<fala 1>\" [\"<fala 2>\"]");
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY ausente no .env.");
fs.mkdirSync(outDir, { recursive: true });

const wav = (pcm, rate) => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

const api = (name) => `https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`;
const headers = { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY };
// Busy models answer 503/429; those are retried after a pause.
async function call(name, body) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(api(name), { method: "POST", headers, signal: AbortSignal.timeout(120000), body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    if (![429, 500, 503].includes(response.status) || attempt === 4) throw new Error(`${name} respondeu HTTP ${response.status}: ${JSON.stringify(data.error || data).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
}
// What was actually said, to catch the model reading the direction aloud or drifting from the text.
const plain = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b500\b/g, "quinhentos").replace(/[^a-z0-9]+/g, " ").trim();
async function heard(file) {
  const data = await call(opt("check-model", "gemini-2.5-flash"), {
    contents: [{ parts: [{ inlineData: { mimeType: "audio/wav", data: fs.readFileSync(file).toString("base64") } }, { text: "Transcreva literalmente, palavra por palavra, o que é falado neste áudio. Números por extenso. Responda só com a transcrição." }] }],
  });
  return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
}

const usage = { input: 0, output: 0 };
for (const [i, line] of lines.entries()) {
  const file = path.join(outDir, `fala-${i + 1}.wav`);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = performance.now();
    // TTS models take no system instruction, and a direction in the prompt is often read aloud with the line
    // (even as "director's notes"), so by default only the line is sent; the voice alone sets the tone.
    const prompt = style ? `${style}: ${line}` : line;
    const data = await call(model, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    });
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part) throw new Error(`Sem áudio na resposta: ${JSON.stringify(data).slice(0, 300)}`);
    const rate = Number((part.inlineData.mimeType.match(/rate=(\d+)/) || [])[1]) || 24000;
    const pcm = Buffer.from(part.inlineData.data, "base64");
    fs.writeFileSync(file, wav(pcm, rate));
    usage.input += data.usageMetadata?.promptTokenCount || 0;
    usage.output += data.usageMetadata?.candidatesTokenCount || 0;
    // The transcriber sometimes returns the expected line even when more was spoken, so length is checked too:
    // natural Portuguese narration stays well under 0.55 s per word.
    const seconds = pcm.length / (rate * 2);
    const tooLong = seconds > line.split(/\s+/).length * 0.55 + 1.5;
    const said = tooLong ? "" : await heard(file);
    const exact = !tooLong && plain(said) === plain(line);
    console.log(`${file} · tentativa ${attempt} · ${seconds.toFixed(2)} s · ${Math.round(performance.now() - started)} ms · tokens ${data.usageMetadata?.promptTokenCount}/${data.usageMetadata?.candidatesTokenCount} · ${exact ? "texto exato" : tooLong ? "LONGO DEMAIS (falou além do texto)" : `DIVERGE: "${said.slice(0, 160)}"`}`);
    if (exact) break;
  }
}
console.log(`tokens totais: entrada ${usage.input}, saída ${usage.output} (${model}, voz ${voice})`);
