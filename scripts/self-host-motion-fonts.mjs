// Fonts for the cinematic landing (#motion), kept apart from the product's font file.
import fs from "node:fs";
fs.mkdirSync("public/fonts", { recursive: true });
const url =
  "https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wdth,wght@62..100,400..800&display=swap";
let css = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
}).then((r) => {
  if (!r.ok) throw Error(r.status);
  return r.text();
});
// Only Latin subsets: the page is Portuguese.
css = css
  .split("/*")
  .filter((block) => !block.trim() || /^\s*latin(-ext)?\s*\*\//.test(block))
  .map((block) => (block.trim() ? "/*" + block : block))
  .join("");
const matches = [
  ...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((x) => x[1])),
];
for (const [i, u] of matches.entries()) {
  const name = `motion-${i}.woff2`;
  const r = await fetch(u);
  if (!r.ok) throw Error(r.status);
  fs.writeFileSync(`public/fonts/${name}`, Buffer.from(await r.arrayBuffer()));
  css = css.replaceAll(u, `/fonts/${name}`);
}
fs.writeFileSync("src/motion-fonts.css", css);
for (const family of ["anton", "archivo"]) {
  const r = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`,
  );
  if (r.ok)
    fs.writeFileSync(`public/fonts/${family}-LICENSE.txt`, await r.text());
}
console.log(`${matches.length} motion font files self-hosted`);
