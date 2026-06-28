import { NextResponse } from "next/server";
import { generateSession } from "@/services/ai/generateSession";
import { getNotebookKnowledge } from "@/services/db/notebookKnowledge";
import { createSessionWithQuestions } from "@/services/db/sessions";
import { createSource } from "@/services/db/sources";

export async function POST(request: Request) {
  const body = await request.json();
  const { domain, topic } = body as { domain?: unknown; topic?: unknown };

  if (typeof domain !== "string" || domain.trim().length === 0) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const trimmedTopic = typeof topic === "string" ? topic.trim() : "";

  try {
    const knowledge = await getNotebookKnowledge(domain);
    if (!knowledge) {
      return NextResponse.json({ error: `No synced content for domain "${domain}"` }, { status: 400 });
    }

    const content = trimmedTopic ? `Focus area: ${trimmedTopic}\n\n${knowledge.content}` : knowledge.content;
    const source = await createSource(content, "notebook_sync", { domain, citations: knowledge.citations });
    const generated = await generateSession(source);
    const { session } = await createSessionWithQuestions(source.id, generated.topic, generated.questions);

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
