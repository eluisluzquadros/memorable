import React, { useEffect, useState } from "react";

// Sub-tabs with their own address (#app/<page>/<tab>), so links, reloads and the back button land
// on the right section. Same look as the other tabs in the app.
const readTab = () => location.hash.replace(/^#app\/[^/]+\/?/, "").split(/[/?]/)[0];

export function useSubtab(page, ids) {
  const pick = () => (ids.includes(readTab()) ? readTab() : ids[0]);
  const [tab, setTab] = useState(pick);
  useEffect(() => {
    // Only this page's address moves its tab; another page in the hash (a tour step) leaves it alone.
    const sync = () => { if (location.hash.split(/[/?]/)[1] === page) setTab(pick()); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [ids.join("|")]);
  const change = (id) => {
    setTab(id);
    history.replaceState(null, "", `#app/${page}/${id}`);
  };
  return [tab, change];
}

export function Subtabs({ label, items, value, onChange }) {
  const onKey = (e, i) => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const next = items[(i + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length][0];
    onChange(next);
    requestAnimationFrame(() => document.getElementById(`subtab-${next}`)?.focus());
  };
  return (
    <div className="r-tabs" role="tablist" aria-label={label}>
      {items.map(([id, name], i) => (
        <button
          type="button"
          role="tab"
          id={`subtab-${id}`}
          aria-selected={value === id}
          aria-controls={`subpanel-${id}`}
          tabIndex={value === id ? 0 : -1}
          key={id}
          onClick={() => onChange(id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

export function Subpanel({ id, children }) {
  return (
    <div role="tabpanel" id={`subpanel-${id}`} aria-labelledby={`subtab-${id}`}>
      {children}
    </div>
  );
}
