import { EmptyState } from "@/components/empty-state";
import { MasteryTopicCard } from "@/components/mastery-topic-card";
import { listMasteryTopics } from "@/services/db/mastery";

export default async function MasteryPage() {
  const topics = await listMasteryTopics();

  if (topics.length === 0) {
    return (
      <EmptyState
        title="Mastery"
        message="No mastery data yet. Complete a training session to start tracking your progress."
        ctaHref="/capture"
        ctaLabel="Go to Capture"
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-foreground">Mastery</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {topics.map((topic) => (
          <MasteryTopicCard key={topic.id} topic={topic} />
        ))}
      </div>
    </div>
  );
}
