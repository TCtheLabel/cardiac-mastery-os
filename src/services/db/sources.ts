import { getSupabaseClient } from "@/lib/supabase/server";
import type { Citation, SourceType, TrainingSource } from "@/types/database";

interface SourceRow {
  id: string;
  content: string;
  source_type: SourceType;
  created_at: string;
  domain: string | null;
  citations: Citation[];
}

function toTrainingSource(row: SourceRow): TrainingSource {
  return {
    id: row.id,
    content: row.content,
    sourceType: row.source_type,
    createdAt: row.created_at,
    domain: row.domain,
    citations: row.citations,
  };
}

export async function createSource(content: string, sourceType: SourceType): Promise<TrainingSource> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("training_sources")
    .insert({ content, source_type: sourceType })
    .select()
    .single();

  if (error) throw new Error(`Failed to create source: ${error.message}`);
  return toTrainingSource(data as SourceRow);
}

export async function getSourceById(id: string): Promise<TrainingSource | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("training_sources")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch source ${id}: ${error.message}`);
  return data ? toTrainingSource(data as SourceRow) : null;
}
