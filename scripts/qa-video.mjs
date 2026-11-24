// Checks a delivered MP4 (not its source): duration, fps, codecs, loudness and true peak, a contact sheet every
// 0.5 s, and frame-to-frame differences that reveal hidden cuts (spikes), freezes and dead air (no change).
//   node scripts/qa-video.mjs <video.mp4> [--sheet sheet.jpg] [--expect-cuts 25.4,30.1] [--holds 29.5-32.3]
// FFMPEG may point to ffmpeg.exe (ffprobe is taken from the same folder).
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const video = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!video) throw new Error("Uso: qa-video.mjs <video.mp4> [--sheet folha.jpg] [--expect-cuts t1,t2] [--holds a-b,c-d]");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const ffprobe = ffmpeg.replace(/ffmpeg(\.exe)?$/i, (m, ext) => `ffprobe${ext || ""}`);
const expectCuts = (opt("expect-cuts", "") || "").split(",").filter(Boolean).map(Number);
const holds = (opt("holds", "") || "").split(",").filter(Boolean).map((r) => r.split("-").map(Number));
const issues = [];

// 1. container
const probe = JSON.parse(execFileSync(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", video]).toString());
const v = probe.streams.find((s) => s.codec_type === "video"), a = probe.streams.find((s) => s.codec_type === "audio");
const [num, den] = v.r_frame_rate.split("/").map(Number);
const fps = num / den, duration = Number(probe.format.duration);
console.log(`vídeo: ${v.codec_name} ${v.profile} ${v.width}x${v.height} ${fps.toFixed(2)} fps · ${duration.toFixed(2)} s · ${v.nb_frames} quadros`);
console.log(`áudio: ${a ? `${a.codec_name} ${a.sample_rate} Hz ${a.channels} canais ${Math.round(a.bit_rate / 1000)} kbps` : "AUSENTE"}`);
if (!a) issues.push("sem áudio");

// 2. loudness (target −14 LUFS integrated, true peak ≤ −1 dBTP)
if (a) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-i", video, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const I = Number((r.match(/I:\s+(-?[\d.]+) LUFS/g) || []).at(-1)?.match(/-?[\d.]+/)[0]);
  const TP = Number((r.match(/Peak:\s+(-?[\d.]+) dBFS/g) || []).at(-1)?.match(/-?[\d.]+/)[0]);
  console.log(`loudness: ${I} LUFS integrado · pico real ${TP} dBTP`);
  if (Math.abs(I + 14) > 1) issues.push(`loudness ${I} LUFS (alvo −14 ±1)`);
  if (TP > -1) issues.push(`pico real ${TP} dBTP acima de −1`);
}

// 3. frame-to-frame change. Two measures, each for what it does well:
// - jumps: FFmpeg's scene-change score (0–100); the plain luma difference gave isolated false spikes (7.7 on frames
//   that were visually identical), so it is not used for jumps;
// - stillness: the plain luma difference (tblend + signalstats) is exactly 0 on unchanged frames, while the scene
//   score also stays near 0 on slow, small motion (a word easing in) and would report false dead air.
const lumaRun = spawnSync(ffmpeg, ["-hide_banner", "-i", video, "-vf", "scale=270:-2,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG", "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const luma = [...lumaRun.stderr.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
const diffRun = spawnSync(ffmpeg, ["-hide_banner", "-i", video, "-vf", "scale=270:-2,scdet=threshold=100,metadata=print:key=lavfi.scd.score", "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const diffs = [...diffRun.stderr.matchAll(/lavfi\.scd\.score=([\d.]+)/g)].map((m) => Number(m[1]));
const sorted = [...diffs].sort((x, y) => x - y), median = sorted[Math.floor(sorted.length / 2)] || 0;
const t = (i) => i / fps;
const inHold = (time) => holds.some(([s, e]) => time >= s && time <= e);
// spikes: a jump bigger than smooth motion produces (hidden cut, camera snap, popping element); frame 0 is the fade-in
const spikes = [];
diffs.forEach((d, i) => { if (i > 0 && d >= 2.5) spikes.push(t(i)); });
const unexpected = spikes.filter((s) => !expectCuts.some((c) => Math.abs(c - s) < 0.1));
console.log(`mudança entre quadros (scdet 0–100): mediana ${median.toFixed(2)} · máxima ${Math.max(...diffs.slice(1)).toFixed(2)} · saltos ≥2,5 em ${spikes.map((s) => s.toFixed(2)).join(", ") || "nenhum"}`);
if (unexpected.length) issues.push(`picos fora dos cortes previstos (corte escondido ou salto): ${unexpected.map((s) => s.toFixed(2) + " s").join(", ")}`);
// freezes / dead air: runs with no visible change
let run = 0;
const still = [];
const tl = (i) => (i + 1) / fps; // tblend's first output compares frames 0 and 1
luma.forEach((d, i) => {
  if (d < 0.02) run++;
  else { if (run >= 6) still.push([tl(i - run), tl(i - 1)]); run = 0; }
});
if (run >= 6) still.push([tl(luma.length - run), tl(luma.length - 1)]);
const dead = still.filter(([s, e]) => e - s >= 0.6 && !inHold((s + e) / 2));
console.log(`trechos parados (≥6 quadros): ${still.map(([s, e]) => `${s.toFixed(2)}–${e.toFixed(2)}`).join(", ") || "nenhum"}`);
if (dead.length) issues.push(`tempo morto (≥0,6 s sem mudança fora das pausas de leitura): ${dead.map(([s, e]) => `${s.toFixed(2)}–${e.toFixed(2)} s`).join(", ")}`);

// 4. contact sheet every 0.5 s, from the encoded file
const sheet = opt("sheet", path.join(path.dirname(video), path.basename(video, ".mp4") + "-folha.jpg"));
const n = Math.floor(duration / 0.5), cols = 8, rows = Math.ceil(n / cols);
// drawtext needs an explicit font file on Windows (no fontconfig there)
const font = process.platform === "win32" ? "fontfile='C\\:/Windows/Fonts/arial.ttf':" : "";
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", video, "-vf", `fps=2,scale=180:-2,drawtext=${font}text='%{pts\\:hms}':x=6:y=6:fontsize=16:fontcolor=white:box=1:boxcolor=black@0.5,tile=${cols}x${rows}:padding=4:color=0x777777`, "-frames:v", "1", sheet]);
console.log(`folha de contato (0,5 s): ${sheet}`);

console.log(issues.length ? `\nPROBLEMAS:\n- ${issues.join("\n- ")}` : "\nSem problemas automáticos. Falta assistir com som no celular.");
process.exitCode = issues.length ? 1 : 0;
