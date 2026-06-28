import { EmptyState } from "@/components/empty-state";
import { listNotebookKnowledge } from "@/services/db/notebookKnowledge";
import { TrainNotebookForm } from "./train-notebook-form";

export default async function TrainNotebookPage() {
  const knowledge = await listNotebookKnowledge();

  if (knowledge.length === 0) {
    return (
      <EmptyState
        title="No notebooks synced yet"
        message="Run npm run sync-notebook -- <domain> from your terminal to pull content from NotebookLM."
        ctaHref="/"
        ctaLabel="Back to Home"
      />
    );
  }

  return <TrainNotebookForm domains={knowledge.map((row) => row.domain)} />;
}
