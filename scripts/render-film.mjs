// Renders a code film into stills or an MP4. The page exposes window.__comp = {width, height, fps, duration} and
// window.__seek(t) (async allowed), a pure function of t that draws the frame at t seconds; window.__ready may be a
// promise to await first (fonts, images).
//   node scripts/render-film.mjs <page.html> --stills 1.2,4,9.5 <out-dir>          storyboard / check frames (PNG)
//   node scripts/render-film.mjs <page.html> <out.mp4> [--draft] [--blur 6] [--fast 4.0-4.9,25.5-27 --blur-fast 16]
//        [--audio mix.wav] [--from 0 --to 30]
// --draft: no motion blur (minutes). Master: --blur sub-frames over a 180° shutter, averaged by FFmpeg (never faked
// in CSS). Few sub-frames show stepped copies on fast moves, so --fast windows get --blur-fast sub-frames; each
// range is encoded on its own and the ranges are joined on exact frame boundaries. Frames are piped to FFmpeg, never
// written to disk (a 30 s master is thousands of screenshots). FFMPEG may point to the ffmpeg executable.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const valued = ["stills", "blur", "blur-fast", "fast", "audio", "from", "to", "fps"];
const positional = args.filter((a, i) => !a.startsWith("--") && !valued.includes(args[i - 1]?.slice(2)));
const [page, target] = positional;
if (!page || !target) throw new Error("Uso: render-film.mjs <pagina.html> <saida.mp4 | pasta com --stills t1,t2>");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const ff = (list) => execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...list], { stdio: "pipe" });

const started = performance.now();
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--allow-file-access-from-files"] });
const tab = await browser.newPage();
tab.on("pageerror", (e) => console.error("erro na página:", e.message));
await tab.goto("file:///" + path.resolve(page).replace(/\\/g, "/"));
const comp = await tab.evaluate(async () => { await window.__ready; await document.fonts.ready; return window.__comp; });
if (!comp?.width || typeof (await tab.evaluate(() => typeof window.__seek)) !== "string") throw new Error("A página precisa expor window.__comp e window.__seek(t).");
await tab.setViewportSize({ width: comp.width, height: comp.height });
const seek = (t) => tab.evaluate(async (time) => { await window.__seek(time); }, t);

if (flag("stills")) {
  fs.mkdirSync(target, { recursive: true });
  const times = opt("stills").split(",").map(Number);
  for (const t of times) {
    await seek(t);
    await tab.screenshot({ path: path.join(target, `t${t.toFixed(2).padStart(6, "0")}.png`) });
  }
  await browser.close();
  console.log(`${times.length} quadros em ${target}`);
  process.exit(0);
}

const fps = Number(opt("fps", comp.fps || 24));
const first = Math.round(Number(opt("from", 0)) * fps), last = Math.round(Number(opt("to", comp.duration)) * fps);
const draft = flag("draft");
const subBase = draft ? 1 : Math.max(1, Number(opt("blur", 6)));
const subFast = draft ? 1 : Math.max(subBase, Number(opt("blur-fast", 16)));
const fast = (opt("fast", "") || "").split(",").filter(Boolean).map((r) => r.split("-").map((x) => Math.round(Number(x) * fps)));

// Frame ranges with their sub-frame count, in order.
const ranges = [];
for (let f = first; f < last; f++) {
  const sub = fast.some(([a, b]) => f >= a && f < b) ? subFast : subBase;
  if (ranges.length && ranges.at(-1).sub === sub) ranges.at(-1).to = f + 1;
  else ranges.push({ from: f, to: f + 1, sub });
}

async function encodeRange({ from, to, sub }, file) {
  const blur = sub > 1 ? ["-vf", `tmix=frames=${sub},select='eq(mod(n\\,${sub})\\,${sub - 1})',setpts=N/(${fps}*TB)`] : [];
  const encoder = spawn(ffmpeg, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps * sub), "-c:v", "mjpeg", "-i", "-",
    ...blur, "-r", String(fps), "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", draft ? "20" : "14",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", file], { stdio: ["pipe", "inherit", "pipe"] });
  let err = "";
  encoder.stderr.on("data", (d) => (err += d));
  const done = new Promise((resolve, reject) => encoder.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`FFmpeg terminou com código ${code}: ${err.slice(-600)}`)))));
  const write = (buf) => (encoder.stdin.write(buf) ? Promise.resolve() : new Promise((r) => encoder.stdin.once("drain", r)));
  for (let f = from; f < to; f++) {
    for (let j = 0; j < sub; j++) {
      // Sub-frames spread over half a frame (180° shutter), centred on the frame instant.
      const t = f / fps + (sub > 1 ? (j / (sub - 1) - 0.5) * (0.5 / fps) : 0);
      await seek(Math.max(0, t));
      await write(await tab.screenshot({ type: "jpeg", quality: draft ? 88 : 95 }));
    }
    if (f % (fps * 5) === 0) process.stdout.write(`${(f / fps).toFixed(0)}s `);
  }
  encoder.stdin.end();
  await done;
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), "film-"));
const parts = [];
for (const [i, range] of ranges.entries()) {
  const file = path.join(work, `part${i}.mp4`);
  await encodeRange(range, file);
  parts.push(file);
}
await browser.close();

// Join the ranges (same encoder settings, so the stream is copied) and add the sound.
const list = path.join(work, "list.txt");
fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
const audio = opt("audio") ? ["-i", path.resolve(opt("audio"))] : [];
ff(["-f", "concat", "-safe", "0", "-i", list, ...audio, "-c:v", "copy",
  ...(audio.length ? ["-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "256k", "-shortest"] : []), "-movflags", "+faststart", path.resolve(target)]);
fs.rmSync(work, { recursive: true, force: true });
const frames = last - first;
console.log(`\nsalvo: ${target} · ${frames} quadros a ${fps} fps · ${ranges.map((r) => `${(r.from / fps).toFixed(2)}–${(r.to / fps).toFixed(2)} s: ${r.sub} sub-quadros`).join(" · ")} · ${Math.round((performance.now() - started) / 1000)} s`);
