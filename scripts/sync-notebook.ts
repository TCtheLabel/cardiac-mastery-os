import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { getNotebookId } from "./notebook-domains";
import { askNotebook } from "./notebookLmClient";
import { upsertNotebookKnowledge } from "../src/services/db/notebookKnowledge";

function synthesisPrompt(domain: string): string {
  return `Provide a comprehensive teaching synthesis on ${domain.replace(/_/g, " ")} for a cardiac surgery resident studying for oral boards. Cover key concepts, areas of clinical controversy, and board-relevant nuances. Cite a specific source for each major claim.`;
}

async function main() {
  const domain = process.argv[2];
  if (!domain) {
    console.error("Usage: npm run sync-notebook -- <domain>");
    process.exit(1);
  }

  const notebookId = getNotebookId(domain);
  console.log(`Syncing domain "${domain}" from notebook ${notebookId}...`);

  const { content, citations } = await askNotebook(notebookId, synthesisPrompt(domain));
  await upsertNotebookKnowledge(domain, content, citations);

  console.log(`Synced "${domain}": ${content.length} chars, ${citations.length} citations.`);
}

main().catch((error) => {
  console.error("sync-notebook failed:", error);
  process.exit(1);
});
