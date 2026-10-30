import React from "react";
import { ModelLab } from "./ModelLab";
import { ModelRoles } from "./ModelRoles";
import { Subtabs, Subpanel, useSubtab } from "./Subtabs";

// The platform's own area, for the team that runs Memorável: the benchmark that calibrates models and
// prices, and which model plays each role for every account. Customers never see it (the service refuses
// them too).
const TABS = [["laboratorio", "Laboratório"], ["modelos", "Quem faz o quê"]];

export function PlatformAdmin() {
  const [tab, setTab] = useSubtab("admin", TABS.map(([id]) => id));
  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <h1>Administração da Memorável</h1>
          <p>Área da equipe da plataforma: benchmark de modelos, escolha de quem escreve, revisa e julga, e o custo real da operação. Os clientes não veem esta área.</p>
        </div>
      </div>
      <Subtabs label="Administração da plataforma" items={TABS} value={tab} onChange={setTab} />
      {tab === "modelos" ? <Subpanel id="modelos"><ModelRoles /></Subpanel> : <Subpanel id="laboratorio"><ModelLab /></Subpanel>}
    </div>
  );
}
