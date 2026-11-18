// Renders an animated HTML page (CSS animations, 1080x1920) into an mp4, frame by frame, and mixes narration.
// Every CSS animation is paused and moved to the exact instant of each frame, so the video is deterministic.
//   node scripts/render-animation.mjs <page.html> <out.mp4> <seconds> [--fps 30] [--audio file.wav@0.2 ...]
// FFMPEG may point to the ffmpeg executable when it is not on PATH.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const [page, out, secondsArg] = args;
const fps = Number(args[args.indexOf("--fps") + 1]) || 30;
const audios = args.flatMap((a, i) => (args[i - 1] === "--audio" ? [a] : [])).map((spec) => { const [file, at] = spec.split("@"); return { file: path.resolve(file), at: Number(at) || 0 }; });
const seconds = Number(secondsArg);
if (!page || !out || !seconds) throw new Error("Uso: render-animation.mjs <pagina.html> <saida.mp4> <segundos> [--fps 30] [--audio fala.wav@0.2]");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const ff = (list) => execFileSync(ffmpeg, ["-y", "-loglevel", "error", ...list], { stdio: "pipe" });

const framesDir = path.join(path.dirname(path.resolve(out)), "frames-tmp");
fs.rmSync(framesDir, { recursive: true, force: true });
fs.mkdirSync(framesDir, { recursive: true });
const started = performance.now();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const tab = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await tab.goto("file:///" + path.resolve(page).replace(/\\/g, "/"));
await tab.evaluate(() => document.fonts.ready);
const total = Math.round(seconds * fps);
for (let n = 0; n < total; n++) {
  await tab.evaluate((ms) => document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ms; }), (n / fps) * 1000);
  await tab.screenshot({ path: path.join(framesDir, `f${String(n).padStart(5, "0")}.jpg`), type: "jpeg", quality: 92 });
}
await browser.close();

const video = ["-framerate", String(fps), "-i", path.join(framesDir, "f%05d.jpg")];
if (!audios.length) ff([...video, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", out]);
else {
  // Each narration file starts at its own instant; together they form one track as long as the video.
  const inputs = audios.flatMap((a) => ["-i", a.file]);
  const delays = audios.map((a, i) => `[${i + 1}:a]adelay=${Math.round(a.at * 1000)}:all=1[a${i}]`).join(";");
  const mix = `${delays};${audios.map((_, i) => `[a${i}]`).join("")}amix=inputs=${audios.length}:normalize=0,apad[aout]`;
  ff([...video, ...inputs, "-filter_complex", mix, "-map", "0:v", "-map", "[aout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-c:a", "aac", "-b:a", "160k", "-shortest", out]);
}
fs.rmSync(framesDir, { recursive: true, force: true });
console.log(`salvo: ${out} · ${total} quadros a ${fps} fps · ${seconds}s · renderizado em ${Math.round((performance.now() - started) / 1000)}s`);
