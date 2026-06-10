import Link from "next/link";
import { listSessions } from "@/services/db/sessions";

export default async function TrainingHistoryPage() {
  const sessions = await listSessions();

  if (sessions.length === 0) {
    return (
      <div className="glass-panel p-10 text-center">
        <h1 className="text-2xl font-medium text-foreground">Training History</h1>
        <p className="mt-3 text-muted-foreground">
          No training sessions yet. Head to Capture to generate your first one.
        </p>
        <Link href="/capture" className="mt-4 inline-block text-primary hover:underline">
          Go to Capture
        </Link>
      </div>
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
