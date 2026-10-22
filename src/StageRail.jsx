import React from "react";
import { Check } from "lucide-react";
import { BOARD_COLUMNS, boardColumn } from "./workflow.mjs";

const SINGULAR = { Ideias: "Ideia" };
// The landing's step rail, reused to show where one content piece stands in the flow.
export function StageRail({ status }) {
  const current = BOARD_COLUMNS.indexOf(boardColumn(status));
  return (
    <ol className="stage-rail" aria-label="Etapa do conteúdo">
      {BOARD_COLUMNS.map((column, i) => (
        <li key={column.name} className={i < current ? "done" : ""} aria-current={i === current ? "step" : undefined}>
          {i < current && <Check size={13} aria-hidden="true" />}
          {SINGULAR[column.name] || column.name}
        </li>
      ))}
    </ol>
  );
}
