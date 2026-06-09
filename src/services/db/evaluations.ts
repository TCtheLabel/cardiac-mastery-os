import { getSupabaseClient } from "@/lib/supabase/server";
import type { Evaluation, QualitySignal } from "@/types/database";

interface EvaluationRow {
  id: string;
  response_id: string;
  strengths: string | null;
  missed_concepts: string | null;
  improvements: string | null;
  principle: string | null;
  quality_signal: QualitySignal;
  created_at: string;
}

function toEvaluation(row: EvaluationRow): Evaluation {
  return {
    id: row.id,
    responseId: row.response_id,
    strengths: row.strengths,
    missedConcepts: row.missed_concepts,
    improvements: row.improvements,
    principle: row.principle,
    qualitySignal: row.quality_signal,
    createdAt: row.created_at,
  };
}

export interface NewEvaluation {
  strengths: string;
  missedConcepts: string;
  improvements: string;
  principle: string;
  qualitySignal: QualitySignal;
}

export async function createEvaluation(responseId: string, evaluation: NewEvaluation): Promise<Evaluation> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      response_id: responseId,
      strengths: evaluation.strengths,
      missed_concepts: evaluation.missedConcepts,
      improvements: evaluation.improvements,
      principle: evaluation.principle,
      quality_signal: evaluation.qualitySignal,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create evaluation: ${error.message}`);
  return toEvaluation(data as EvaluationRow);
}
