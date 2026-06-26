import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { MasteryTopicCard } from "@/components/mastery-topic-card";
import { listMasteryTopics } from "@/services/db/mastery";
import { listSessions } from "@/services/db/sessions";

export default async function Home() {
  const [topics, sessions] = await Promise.all([listMasteryTopics(), listSessions()]);

  if (topics.length === 0) {
    return (
      <EmptyState
        title="Cardiac Mastery OS"
        message="No training sessions yet. Capture a reflection, case note, or insight to generate your first one."
        ctaHref="/capture"
        ctaLabel="Go to Capture"
      />
    );
  }

  const recommended = topics[0];
  const weakestTopics = topics.slice(0, 3);
  const recentSessions = sessions.slice(0, 3);

  return (
    <div className="space-y-8">
      <Link
        href={`/capture?topic=${encodeURIComponent(recommended.topic)}`}
        className="glass-panel block space-y-2 p-6 transition-opacity hover:opacity-80"
      >
        <p className="text-sm text-muted-foreground">Recommended Focus</p>
        <p className="text-xl font-medium text-foreground">{recommended.topic}</p>
        <p className="text-sm text-muted-foreground">Confidence: {Math.round(recommended.confidenceScore)}</p>
      </Link>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Topic Mastery</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {weakestTopics.map((topic) => (
            <MasteryTopicCard
              key={topic.id}
              topic={topic}
              href={`/capture?topic=${encodeURIComponent(topic.topic)}`}
              compact
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent Activity</h2>
        <ul className="space-y-3">
          {recentSessions.map((session) => (
            <li key={session.id} className="glass-panel p-4">
              <Link href={`/training/${session.id}`} className="flex items-center justify-between">
                <span className="text-foreground">{session.topic ?? "Untitled Session"}</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(session.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
