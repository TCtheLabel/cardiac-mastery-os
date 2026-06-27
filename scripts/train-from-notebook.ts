import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { getNotebookKnowledge } from "../src/services/db/notebookKnowledge";
import { createSource } from "../src/services/db/sources";
import { generateSession } from "../src/services/ai/generateSession";
import { createSessionWithQuestions } from "../src/services/db/sessions";

async function main() {
  const domain = process.argv[2];
  if (!domain) {
    console.error("Usage: npm run train-from-notebook -- <domain>");
    process.exit(1);
  }

  const knowledge = await getNotebookKnowledge(domain);
  if (!knowledge) {
    console.error(`No synced content for domain "${domain}". Run "npm run sync-notebook -- ${domain}" first.`);
    process.exit(1);
  }

  const source = await createSource(knowledge.content, "notebook_sync", {
    domain,
    citations: knowledge.citations,
  });
  const generated = await generateSession(source);
  const { session } = await createSessionWithQuestions(source.id, generated.topic, generated.questions);

  console.log(`Training session ready: http://localhost:3000/training/${session.id}`);
}

main().catch((error) => {
  console.error("train-from-notebook failed:", error);
  process.exit(1);
});
