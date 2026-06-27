"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Citation, Evaluation, Question, QuestionCategory, TrainingSession } from "@/types/database";

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  decision_making: "Decision Making",
  operative_planning: "Operative Planning",
  complication_management: "Complication Management",
  pattern_recognition: "Pattern Recognition",
  reflection: "Reflection",
};

function QualityBadge({ qualitySignal }: { qualitySignal: Evaluation["qualitySignal"] }) {
  if (qualitySignal === "strong") {
    return <Badge className="bg-accent text-accent-foreground">Strong</Badge>;
  }
  if (qualitySignal === "weak") {
    return <Badge variant="destructive">Weak</Badge>;
  }
  return <Badge variant="secondary">Adequate</Badge>;
}

export default function TrainingSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responseText, setResponseText] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load session");
        }

        if (!cancelled) {
          setSession(data.session);
          setQuestions(data.questions);
          setCitations(data.citations ?? []);
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function handleSubmit() {
    const question = questions[currentIndex];
    if (!question || responseText.trim().length === 0 || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/evaluate-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, responseText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to evaluate response");
      }

      setEvaluation(data as Evaluation);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    setCurrentIndex((i) => i + 1);
    setResponseText("");
    setEvaluation(null);
    setSubmitError(null);
  }

  if (loading) {
    return <div className="glass-panel p-10 text-center text-muted-foreground">Loading…</div>;
  }

  if (loadError || !session) {
    return (
      <div className="glass-panel p-10 text-center">
        <p className="text-destructive">{loadError ?? "Session not found"}</p>
      </div>
    );
  }

  const isLastQuestion = currentIndex === questions.length - 1;
  const question = questions[currentIndex];

  if (finished) {
    return (
      <Card className="glass-panel">
        <CardContent className="space-y-4 p-10 text-center">
          <h1 className="text-2xl font-medium text-foreground">Session Complete</h1>
          <p className="text-muted-foreground">{session.topic}</p>
          <p className="text-sm text-muted-foreground">{questions.length} questions answered</p>
          <Link href="/capture">
            <Button className="mt-4">Capture Another</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Question {currentIndex + 1} of {questions.length}
      </p>

      {citations.length > 0 && (
        <details className="glass-panel rounded-lg p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Sources ({citations.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {citations.map((citation, index) => (
              <li key={index} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{citation.sourceTitle || "Source"}:</span>{" "}
                {citation.text}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Card className="glass-panel">
        <CardHeader className="space-y-2">
          <Badge variant="outline">{CATEGORY_LABELS[question.category]}</Badge>
          <p className="text-lg text-foreground">{question.prompt}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Write your response..."
            className="min-h-32"
            disabled={evaluation !== null}
          />

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          {!evaluation && (
            <Button
              onClick={handleSubmit}
              disabled={responseText.trim().length === 0 || submitting}
              className="w-full"
            >
              {submitting ? "Evaluating…" : "Submit Answer"}
            </Button>
          )}

          {evaluation && (
            <div className="space-y-4">
              <Separator />

              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">Evaluation</h2>
                <QualityBadge qualitySignal={evaluation.qualitySignal} />
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Strengths</h3>
                <p className="mt-1 text-foreground">{evaluation.strengths}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Missed Concepts</h3>
                <p className="mt-1 text-foreground">{evaluation.missedConcepts || "None"}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Improvements</h3>
                <p className="mt-1 text-foreground">{evaluation.improvements}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Principle</h3>
                <p className="mt-1 text-foreground">{evaluation.principle}</p>
              </div>

              {isLastQuestion ? (
                <Button onClick={() => setFinished(true)} className="w-full">
                  Finish Session
                </Button>
              ) : (
                <Button onClick={handleNext} className="w-full">
                  Next Question →
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
