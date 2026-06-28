// Filled in by Thomas using notebooklm-mcp's add_notebook/list_notebooks tools
// against his already-existing, already-populated NotebookLM notebooks.
export const DOMAIN_NOTEBOOKS: Record<string, string> = {
  foundations: "cardiac-surgery-foundations",
  aortic_surgery: "aortic-surgery",
  valve_surgery: "valve-surgery",
  coronary_surgery: "coronary-surgery",
  heart_failure_lvad_transplant: "heart-failure-mechanical-suppo",
  critical_care_ecmo_perfusion: "critical-care-ecmo-perfusion",
  cardiac_oncology: "cardiac-oncology",
};

export function getNotebookId(domain: string, table: Record<string, string> = DOMAIN_NOTEBOOKS): string {
  const id = table[domain];
  if (!id) {
    throw new Error(`Unknown domain "${domain}". Valid domains: ${Object.keys(table).join(", ")}`);
  }
  if (id.startsWith("<")) {
    throw new Error(
      `Domain "${domain}" has no notebooklm-mcp library id configured yet. ` +
        `Use notebooklm-mcp's add_notebook/list_notebooks tools to register your existing NotebookLM notebook, then fill in scripts/notebook-domains.ts.`
    );
  }
  return id;
}
