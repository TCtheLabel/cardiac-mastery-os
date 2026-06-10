"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { SourceType } from "@/types/database";

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "reflection", label: "Reflection" },
  { value: "case_note", label: "Case Note" },
  { value: "article_summary", label: "Article Summary" },
  { value: "insight", label: "Insight" },
];

const MIN_CONTENT_LENGTH = 20;

function CaptureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusTopic = searchParams.get("topic");

  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = sourceType !== null && content.trim().length >= MIN_CONTENT_LENGTH && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !sourceType) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, sourceType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate training session");
      router.push(`/training/${data.sessionId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <h1 className="text-2xl font-medium text-foreground">Capture</h1>
        {focusTopic && <p className="text-sm text-muted-foreground">Focus: {focusTopic}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {SOURCE_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setSourceType(type.value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                sourceType === type.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your reflection, case note, article summary, or insight..."
          className="min-h-48"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {submitting ? "Generating…" : "Generate Training Session"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={<div className="glass-panel p-10 text-center text-muted-foreground">Loading…</div>}>
      <CaptureForm />
    </Suspense>
  );
}
