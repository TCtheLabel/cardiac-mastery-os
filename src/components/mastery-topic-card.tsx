import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { MasteryTopic } from "@/types/database";

interface MasteryTopicCardProps {
  topic: MasteryTopic;
  href?: string;
  compact?: boolean;
}

export function MasteryTopicCard({ topic, href, compact = false }: MasteryTopicCardProps) {
  const content = (
    <div className="glass-panel space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{topic.topic}</span>
        <span className="text-sm text-muted-foreground">{Math.round(topic.confidenceScore)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${topic.confidenceScore}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {topic.sessionCount} session{topic.sessionCount === 1 ? "" : "s"}
      </p>
      {!compact && topic.weakAreas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topic.weakAreas.map((area) => (
            <Badge key={area} variant="outline">
              {area}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-80">
        {content}
      </Link>
    );
  }

  return content;
}
