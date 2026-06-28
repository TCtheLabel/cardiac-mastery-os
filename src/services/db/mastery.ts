import { getSupabaseClient } from "@/lib/supabase/server";
import { classifyTopicRegion } from "@/services/ai/classifyTopicRegion";
import type { HeartRegion, MasteryTopic, QualitySignal } from "@/types/database";

interface MasteryTopicRow {
  id: string;
  topic: string;
  confidence_score: number;
  session_count: number;
  weak_areas: string[];
  region: string | null;
}

function toMasteryTopic(row: MasteryTopicRow): MasteryTopic {
  return {
    id: row.id,
    topic: row.topic,
    confidenceScore: row.confidence_score,
    sessionCount: row.session_count,
    weakAreas: row.weak_areas,
    region: row.region as HeartRegion | null,
  };
}

const QUALITY_SCORES: Record<QualitySignal, number> = {
  strong: 90,
  adequate: 65,
  weak: 35,
};

const RECENCY_WEIGHT = 0.35;
const MAX_WEAK_AREAS = 5;

export async function listMasteryTopics(): Promise<MasteryTopic[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("mastery_topics")
    .select()
    .order("confidence_score", { ascending: true });

  if (error) throw new Error(`Failed to list mastery topics: ${error.message}`);
  return (data as MasteryTopicRow[]).map(toMasteryTopic);
}

async function classifyRegionSafely(topic: string): Promise<HeartRegion> {
  try {
    return await classifyTopicRegion(topic);
  } catch {
    return "whole_heart";
  }
}

export async function recordMasteryProgress(
  topic: string,
  qualitySignal: QualitySignal,
  newMissedConcepts: string[]
): Promise<MasteryTopic> {
  const supabase = getSupabaseClient();

  const { data: existingRow, error: fetchError } = await supabase
    .from("mastery_topics")
    .select()
    .eq("topic", topic)
    .maybeSingle();

  if (fetchError) throw new Error(`Failed to fetch mastery topic "${topic}": ${fetchError.message}`);

  const existing = existingRow ? toMasteryTopic(existingRow as MasteryTopicRow) : null;
  const signalScore = QUALITY_SCORES[qualitySignal];

  const nextConfidence = existing
    ? existing.confidenceScore * (1 - RECENCY_WEIGHT) + signalScore * RECENCY_WEIGHT
    : signalScore;

  const nextWeakAreas = mergeWeakAreas(existing?.weakAreas ?? [], newMissedConcepts);

  const payload: Record<string, unknown> = {
    id: existing?.id,
    topic,
    confidence_score: Math.round(nextConfidence * 100) / 100,
    session_count: (existing?.sessionCount ?? 0) + 1,
    weak_areas: nextWeakAreas,
  };

  if (!existing) {
    payload.region = await classifyRegionSafely(topic);
  }

  const { data: savedRow, error: saveError } = await supabase
    .from("mastery_topics")
    .upsert(payload, { onConflict: "topic" })
    .select()
    .single();

  if (saveError) throw new Error(`Failed to save mastery topic "${topic}": ${saveError.message}`);
  return toMasteryTopic(savedRow as MasteryTopicRow);
}

function mergeWeakAreas(existing: string[], incoming: string[]): string[] {
  const merged = [...incoming.filter((area) => area.trim().length > 0), ...existing];
  const deduped = Array.from(new Set(merged.map((area) => area.trim())));
  return deduped.slice(0, MAX_WEAK_AREAS);
}
