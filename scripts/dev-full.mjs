import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["server/runtime.mjs"], {
    stdio: "inherit",
    windowsHide: true,
  }),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "0.0.0.0",
      "--port",
      "5173",
      "--strictPort",
    ],
    { stdio: "inherit", windowsHide: true },
  ),
];
let stopping = false;
const stop = () => {
  if (stopping) return;
  stopping = true;
  children.forEach((c) => c.kill());
};
children.forEach((c) =>
  c.on("exit", (code) => {
    stop();
    process.exitCode = code || 0;
  }),
);
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
