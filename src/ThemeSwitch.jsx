import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "memorable-theme";
const EVENT = "memorable-theme-change";
const dark = () => window.matchMedia?.("(prefers-color-scheme: dark)").matches;
const saved = () => {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};
// "system" leaves the attribute off so the stylesheet follows the operating system.
function apply(choice) {
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}
export function useTheme() {
  const [choice, setChoice] = useState(saved);
  const [systemDark, setSystemDark] = useState(dark);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystem = () => setSystemDark(media.matches);
    const onChoice = () => setChoice(saved());
    media?.addEventListener("change", onSystem);
    window.addEventListener(EVENT, onChoice);
    return () => {
      media?.removeEventListener("change", onSystem);
      window.removeEventListener(EVENT, onChoice);
    };
  }, []);
  const resolved = choice === "system" ? (systemDark ? "dark" : "light") : choice;
  return { choice, resolved, setChoice: apply };
}
export function ThemeSwitch() {
  const { resolved, setChoice } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button className="theme-switch" onClick={() => setChoice(next)} aria-label={next === "dark" ? "Usar tema escuro" : "Usar tema claro"} title="Alternar tema">
      {next === "dark" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      <span>{next === "dark" ? "Escuro" : "Claro"}</span>
    </button>
  );
}
export function ThemeSetting() {
  const { choice, setChoice } = useTheme();
  return (
    <label>
      Tema da plataforma
      <select value={choice} onChange={(e) => setChoice(e.target.value)}>
        <option value="system">Seguir o sistema</option>
        <option value="light">Claro (papel)</option>
        <option value="dark">Escuro (estúdio)</option>
      </select>
    </label>
  );
}
