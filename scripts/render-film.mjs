// Renders a code film into stills or an MP4. The page exposes window.__comp = {width, height, fps, duration} and
// window.__seek(t) (async allowed), a pure function of t that draws the frame at t seconds; window.__ready may be a
// promise to await first (fonts, images).
//   node scripts/render-film.mjs <page.html> --stills 1.2,4,9.5 <out-dir>          storyboard / check frames (PNG)
//   node scripts/render-film.mjs <page.html> <out.mp4> [--draft] [--blur 4] [--audio mix.wav] [--from 0 --to 30]
// --draft: JPEG frames, no motion blur (minutes). Default master: --blur 4 sub-frames over a 180° shutter, averaged
// by FFmpeg (never faked in CSS). FFMPEG may point to the ffmpeg executable when it is not on PATH.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const positional = args.filter((a, i) => !a.startsWith("--") && !["stills", "blur", "audio", "from", "to", "fps"].includes(args[i - 1]?.slice(2)));
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
const from = Number(opt("from", 0)), to = Number(opt("to", comp.duration));
const draft = flag("draft");
const sub = draft ? 1 : Math.max(1, Number(opt("blur", 4)));
const framesDir = path.join(path.dirname(path.resolve(target)), `frames-${path.basename(target, ".mp4")}`);
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
const frames = Math.round((to - from) * fps);
let n = 0;
for (let f = 0; f < frames; f++) {
  for (let j = 0; j < sub; j++) {
    // Sub-frames spread over half a frame (180° shutter), centred on the frame instant.
    const t = from + f / fps + (sub > 1 ? ((j / (sub - 1)) - 0.5) * (0.5 / fps) : 0);
    await seek(Math.max(0, t));
    await tab.screenshot({ path: path.join(framesDir, `f${String(n++).padStart(6, "0")}.${draft ? "jpg" : "png"}`), ...(draft ? { type: "jpeg", quality: 90 } : {}) });
  }
  if (f % (fps * 5) === 0) process.stdout.write(`${(f / fps).toFixed(0)}s `);
}
await browser.close();

const input = ["-framerate", String(fps * sub), "-i", path.join(framesDir, `f%06d.${draft ? "jpg" : "png"}`)];
// Averaging each group of sub-frames gives real motion blur; then one frame per group is kept.
const blur = sub > 1 ? ["-vf", `tmix=frames=${sub},select='eq(mod(n\\,${sub})\\,${sub - 1})',setpts=N/(${fps}*TB)`] : [];
const audio = opt("audio") ? ["-i", path.resolve(opt("audio"))] : [];
ff([...input, ...audio, ...blur, "-r", String(fps), "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", draft ? "20" : "14",
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
  ...(audio.length ? ["-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "256k", "-shortest"] : []), "-movflags", "+faststart", target]);
fs.rmSync(framesDir, { recursive: true, force: true });
console.log(`\nsalvo: ${target} · ${frames} quadros a ${fps} fps${sub > 1 ? ` · blur ${sub} sub-quadros` : ""} · ${Math.round((performance.now() - started) / 1000)} s`);
