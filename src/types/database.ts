export type SourceType = "reflection" | "case_note" | "article_summary" | "insight" | "notebook_sync";

export interface Citation {
  text: string;
  sourceTitle: string;
}

export type QuestionCategory =
  | "decision_making"
  | "operative_planning"
  | "complication_management"
  | "pattern_recognition"
  | "reflection";

export type QualitySignal = "strong" | "adequate" | "weak";

export interface TrainingSource {
  id: string;
  content: string;
  sourceType: SourceType;
  createdAt: string;
  domain: string | null;
  citations: Citation[];
}

export interface NotebookKnowledge {
  id: string;
  domain: string;
  content: string;
  citations: Citation[];
  syncedAt: string;
}

export interface TrainingSession {
  id: string;
  sourceId: string;
  topic: string | null;
  createdAt: string;
}

export interface Question {
  id: string;
  sessionId: string;
  category: QuestionCategory;
  prompt: string;
  orderIndex: number;
}

export interface QuestionResponse {
  id: string;
  questionId: string;
  response: string;
  createdAt: string;
}

export interface Evaluation {
  id: string;
  responseId: string;
  strengths: string | null;
  missedConcepts: string | null;
  improvements: string | null;
  principle: string | null;
  qualitySignal: QualitySignal;
  createdAt: string;
}

export interface MasteryTopic {
  id: string;
  topic: string;
  confidenceScore: number;
  sessionCount: number;
  weakAreas: string[];
}
