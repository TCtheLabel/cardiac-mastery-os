import Link from "next/link";

interface EmptyStateProps {
  title: string;
  message: string;
  ctaHref: string;
  ctaLabel: string;
}

export function EmptyState({ title, message, ctaHref, ctaLabel }: EmptyStateProps) {
  return (
    <div className="glass-panel p-10 text-center">
      <h1 className="text-2xl font-medium text-foreground">{title}</h1>
      <p className="mt-3 text-muted-foreground">{message}</p>
      <Link href={ctaHref} className="mt-4 inline-block text-primary hover:underline">
        {ctaLabel}
      </Link>
    </div>
  );
}
