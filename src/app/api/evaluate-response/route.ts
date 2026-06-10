import { NextResponse } from "next/server";
import { evaluateResponse } from "@/services/ai/evaluateResponse";
import { createEvaluation } from "@/services/db/evaluations";
import { recordMasteryProgress } from "@/services/db/mastery";
import { createResponse } from "@/services/db/responses";
import { getQuestionById, getSessionWithQuestions } from "@/services/db/sessions";
import { getSourceById } from "@/services/db/sources";

function parseMissedConcepts(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { questionId, responseText } = body as { questionId?: unknown; responseText?: unknown };

  if (typeof questionId !== "string" || questionId.trim().length === 0) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }
  if (typeof responseText !== "string" || responseText.trim().length === 0) {
    return NextResponse.json({ error: "responseText is required" }, { status: 400 });
  }

  try {
    const question = await getQuestionById(questionId);
    if (!question) {
      return NextResponse.json({ error: `Question ${questionId} not found` }, { status: 400 });
    }
    const sessionData = await getSessionWithQuestions(question.sessionId);
    if (!sessionData) {
      return NextResponse.json({ error: `Session ${question.sessionId} not found` }, { status: 400 });
    }
    const source = await getSourceById(sessionData.session.sourceId);
    if (!source) {
      return NextResponse.json({ error: `Source ${sessionData.session.sourceId} not found` }, { status: 400 });
    }
    const response = await createResponse(questionId, responseText);
    const result = await evaluateResponse({ responseText, question, source });
    const evaluation = await createEvaluation(response.id, result);
    const topic = sessionData.session.topic ?? "Uncategorized";
    await recordMasteryProgress(topic, result.qualitySignal, parseMissedConcepts(result.missedConcepts));
    return NextResponse.json(evaluation);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
