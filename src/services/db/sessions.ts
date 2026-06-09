import { getSupabaseClient } from "@/lib/supabase/server";
import type { Question, QuestionCategory, TrainingSession } from "@/types/database";

interface SessionRow {
  id: string;
  source_id: string;
  topic: string | null;
  created_at: string;
}

interface QuestionRow {
  id: string;
  session_id: string;
  category: QuestionCategory;
  prompt: string;
  order_index: number;
}

function toTrainingSession(row: SessionRow): TrainingSession {
  return {
    id: row.id,
    sourceId: row.source_id,
    topic: row.topic,
    createdAt: row.created_at,
  };
}

function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    sessionId: row.session_id,
    category: row.category,
    prompt: row.prompt,
    orderIndex: row.order_index,
  };
}

export interface NewQuestion {
  category: QuestionCategory;
  prompt: string;
}

export async function createSessionWithQuestions(
  sourceId: string,
  topic: string,
  questions: NewQuestion[]
): Promise<{ session: TrainingSession; questions: Question[] }> {
  const supabase = getSupabaseClient();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("training_sessions")
    .insert({ source_id: sourceId, topic })
    .select()
    .single();

  if (sessionError) throw new Error(`Failed to create session: ${sessionError.message}`);

  const session = toTrainingSession(sessionRow as SessionRow);

  const { data: questionRows, error: questionsError } = await supabase
    .from("questions")
    .insert(
      questions.map((q, index) => ({
        session_id: session.id,
        category: q.category,
        prompt: q.prompt,
        order_index: index,
      }))
    )
    .select();

  if (questionsError) throw new Error(`Failed to create questions: ${questionsError.message}`);

  return {
    session,
    questions: (questionRows as QuestionRow[]).map(toQuestion),
  };
}

export async function getSessionWithQuestions(
  sessionId: string
): Promise<{ session: TrainingSession; questions: Question[] } | null> {
  const supabase = getSupabaseClient();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("training_sessions")
    .select()
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(`Failed to fetch session ${sessionId}: ${sessionError.message}`);
  if (!sessionRow) return null;

  const { data: questionRows, error: questionsError } = await supabase
    .from("questions")
    .select()
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true });

  if (questionsError)
    throw new Error(`Failed to fetch questions for session ${sessionId}: ${questionsError.message}`);

  return {
    session: toTrainingSession(sessionRow as SessionRow),
    questions: (questionRows as QuestionRow[]).map(toQuestion),
  };
}

export async function listSessions(): Promise<TrainingSession[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("training_sessions")
    .select()
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list sessions: ${error.message}`);
  return (data as SessionRow[]).map(toTrainingSession);
}
