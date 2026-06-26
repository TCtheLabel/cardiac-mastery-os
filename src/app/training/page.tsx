import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { listSessions } from "@/services/db/sessions";

export default async function TrainingHistoryPage() {
  const sessions = await listSessions();

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Training History"
        message="No training sessions yet. Head to Capture to generate your first one."
        ctaHref="/capture"
        ctaLabel="Go to Capture"
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-foreground">Training History</h1>
      <ul className="space-y-3">
        {sessions.map((session) => (
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
  );
}
