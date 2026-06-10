import { NextResponse } from "next/server";
import { getSessionWithQuestions } from "@/services/db/sessions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const result = await getSessionWithQuestions(sessionId);
  if (!result) {
    return NextResponse.json({ error: `Session ${sessionId} not found` }, { status: 404 });
  }
  return NextResponse.json(result);
}
