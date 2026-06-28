"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const DOMAIN_LABELS: Record<string, string> = {
  foundations: "Foundations",
  aortic_surgery: "Aortic Surgery",
  valve_surgery: "Valve Surgery",
  coronary_surgery: "Coronary Surgery",
  heart_failure_lvad_transplant: "Heart Failure / LVAD / Transplant",
  critical_care_ecmo_perfusion: "Critical Care / ECMO / Perfusion",
  cardiac_oncology: "Cardiac Oncology",
};

interface TrainNotebookFormProps {
  domains: string[];
}

export function TrainNotebookForm({ domains }: TrainNotebookFormProps) {
  const router = useRouter();

  const [domain, setDomain] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = domain !== null && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !domain) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/train-notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, topic: topic.trim() || undefined }),
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
        <h1 className="text-2xl font-medium text-foreground">Train from Notebook</h1>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {domains.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDomain(value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                domain === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {DOMAIN_LABELS[value] ?? value}
            </button>
          ))}
        </div>
        <Textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Optional: focus on a specific topic within this domain..."
          className="min-h-24"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {submitting ? "Generating…" : "Generate Training Session"}
        </Button>
      </CardContent>
    </Card>
  );
}
