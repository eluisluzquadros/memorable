// Narration through an audio-output model on OpenRouter (GPT Audio): one WAV per line, read exactly as written.
//   node --env-file=.env scripts/tts-openrouter.mjs <out-dir> <voice> "<line 1>" ["<line 2>" ...] [--model openai/gpt-audio-mini] [--style "..."]
// Prints the cost of each line as charged by OpenRouter.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const positional = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
const [outDir, voice, ...lines] = positional;
const model = opt("model", "openai/gpt-audio-mini");
const style = opt("style", "Locução de anúncio para Reels, em português do Brasil: firme, próxima e confiante, ritmo natural, sem pressa.");
if (!outDir || !voice || !lines.length) throw new Error("Uso: tts-openrouter.mjs <pasta> <voz> \"<fala 1>\" [\"<fala 2>\"]");
fs.mkdirSync(outDir, { recursive: true });

// PCM16 mono 24 kHz → WAV
const wav = (pcm, rate = 24000) => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

let total = 0;
// The model sometimes keeps talking after a short line; what it said is checked against the text and redone.
const plain = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
for (const [i, line] of lines.entries()) {
 for (let attempt = 1; attempt <= 3; attempt++) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.MEMORABLE_AI_KEY}` },
    body: JSON.stringify({
      model, stream: true, modalities: ["text", "audio"], audio: { voice, format: "pcm16" }, usage: { include: true },
      messages: [
        { role: "system", content: `Você é locutor profissional brasileiro. ${style} Leia exatamente o texto do usuário, palavra por palavra, sem acrescentar, comentar ou responder nada.` },
        { role: "user", content: `Leia em voz alta somente o texto entre « » e pare ao terminar: «${line}»` },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter respondeu HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  // Server-sent events: audio arrives as base64 PCM chunks, the transcript as text, the cost at the end.
  const chunks = [];
  let transcript = "", cost = null, buffer = "";
  for await (const piece of response.body) {
    buffer += Buffer.from(piece).toString("utf8");
    let cut;
    while ((cut = buffer.indexOf("\n")) >= 0) {
      const row = buffer.slice(0, cut).trim();
      buffer = buffer.slice(cut + 1);
      if (!row.startsWith("data:") || row === "data: [DONE]") continue;
      const event = JSON.parse(row.slice(5));
      const delta = event.choices?.[0]?.delta?.audio;
      if (delta?.data) chunks.push(Buffer.from(delta.data, "base64"));
      if (delta?.transcript) transcript += delta.transcript;
      if (event.usage?.cost != null) cost = event.usage.cost;
    }
  }
  total += cost || 0;
  const exact = plain(transcript) === plain(line);
  const file = path.join(outDir, `fala-${i + 1}.wav`);
  console.log(`${file} · tentativa ${attempt} · ${(Buffer.concat(chunks).length / 48000).toFixed(2)} s · US$ ${(cost ?? 0).toFixed(5)} · ${exact ? "texto exato" : "DIVERGE"} · "${transcript.trim().slice(0, 160)}"`);
  if (exact || attempt === 3) { fs.writeFileSync(file, wav(Buffer.concat(chunks))); break; }
 }
}
console.log(`total: US$ ${total.toFixed(5)}`);
