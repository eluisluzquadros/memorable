import fs from "node:fs";
fs.mkdirSync("public/fonts", { recursive: true });
const url =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400..700&family=Sora:wght@400..700&display=swap";
let css = await fetch(url, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  },
}).then((r) => {
  if (!r.ok) throw Error(r.status);
  return r.text();
});
const matches = [
  ...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((x) => x[1])),
];
for (const [i, u] of matches.entries()) {
  const name = `font-${i}.woff2`;
  const r = await fetch(u);
  if (!r.ok) throw Error(r.status);
  fs.writeFileSync(`public/fonts/${name}`, Buffer.from(await r.arrayBuffer()));
  css = css.replaceAll(u, `/fonts/${name}`);
}
fs.writeFileSync("src/fonts.css", css);
for (const family of ["dmsans", "sora"]) {
  const r = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${family}/OFL.txt`,
  );
  if (r.ok)
    fs.writeFileSync(`public/fonts/${family}-LICENSE.txt`, await r.text());
}
const p = "src/styles.css";
let styles = fs.readFileSync(p, "utf8");
styles = styles.replace(/^@import url\([^\n]+\);/, "@import './fonts.css';");
fs.writeFileSync(p, styles);
console.log(`${matches.length} font files self-hosted`);
