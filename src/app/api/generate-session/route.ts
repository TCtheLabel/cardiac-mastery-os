import { NextResponse } from "next/server";
import { generateSession } from "@/services/ai/generateSession";
import { createSessionWithQuestions } from "@/services/db/sessions";
import { createSource } from "@/services/db/sources";
import type { SourceType } from "@/types/database";

const VALID_SOURCE_TYPES: SourceType[] = ["reflection", "case_note", "article_summary", "insight"];

export async function POST(request: Request) {
  const body = await request.json();
  const { content, sourceType } = body as { content?: unknown; sourceType?: unknown };

  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  if (typeof sourceType !== "string" || !VALID_SOURCE_TYPES.includes(sourceType as SourceType)) {
    return NextResponse.json(
      { error: `sourceType must be one of: ${VALID_SOURCE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const source = await createSource(content, sourceType as SourceType);
    const generated = await generateSession(source);
    const { session } = await createSessionWithQuestions(source.id, generated.topic, generated.questions);

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
