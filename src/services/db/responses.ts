import { getSupabaseClient } from "@/lib/supabase/server";
import type { QuestionResponse } from "@/types/database";

interface ResponseRow {
  id: string;
  question_id: string;
  response: string;
  created_at: string;
}

function toQuestionResponse(row: ResponseRow): QuestionResponse {
  return {
    id: row.id,
    questionId: row.question_id,
    response: row.response,
    createdAt: row.created_at,
  };
}

export async function createResponse(questionId: string, response: string): Promise<QuestionResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("responses")
    .insert({ question_id: questionId, response })
    .select()
    .single();

  if (error) throw new Error(`Failed to create response: ${error.message}`);
  return toQuestionResponse(data as ResponseRow);
}

export async function getResponseById(id: string): Promise<QuestionResponse | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("responses")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch response ${id}: ${error.message}`);
  return data ? toQuestionResponse(data as ResponseRow) : null;
}
