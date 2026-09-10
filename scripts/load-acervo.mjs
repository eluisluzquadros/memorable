import fs from "node:fs";
import path from "node:path";
const dir = path.resolve("../podcast");
const data = fs
  .readdirSync(dir)
  .filter((x) => /^ROLIM TALKS \d+\.md$/i.test(x))
  .map((file) => {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    const title = content.split(/\r?\n/)[0].trim();
    const url =
      content.match(/https:\/\/(?:youtu\.be|www\.youtube\.com)[^\s]+/)?.[0] ||
      "";
    const summary =
      content
        .split(/##\s*resumo/i)[1]
        ?.split(/##\s*transcri/i)[0]
        ?.trim() || "";
    const ep = Number(file.match(/\d+/)[0]);
    return {
      id: `rolim${ep}`,
      workspace: "podcast",
      title: title.replace(/^ROLIM TALKS\s*\d+\s*[|:—–-]\s*/i, ""),
      type: "Podcast",
      origin: `ROLIM TALKS ${String(ep).padStart(2, "0")} · resumo do acervo fornecido`,
      url,
      text: summary,
      citable: !!url,
      shared: false,
      date: "2026-09-04T12:00:00Z",
      feedback: "",
      demo: false,
    };
  })
  .filter((x) => x.id !== "rolim31" && x.text && x.url);
fs.writeFileSync(
  "src/podcast-data.mjs",
  `// Metadata and summaries from the user-provided podcast archive.\nexport default ${JSON.stringify(data, null, 2)};\n`,
);
console.log(`${data.length} episódios adicionais preparados`);
