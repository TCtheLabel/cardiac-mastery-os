import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Citation } from "../src/types/database";

export interface AskQuestionResult {
  content: string;
  citations: Citation[];
}

interface RawToolResult {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
}

function normalizeCitation(raw: unknown): Citation {
  if (typeof raw === "string") {
    return { text: raw, sourceTitle: "" };
  }
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const text = typeof r.snippet === "string" ? r.snippet : typeof r.text === "string" ? r.text : "";
    const sourceTitle =
      typeof r.title === "string" ? r.title : typeof r.sourceTitle === "string" ? r.sourceTitle : "";
    return { text, sourceTitle };
  }
  return { text: "", sourceTitle: "" };
}

export function normalizeAskQuestionResult(raw: RawToolResult): AskQuestionResult {
  const structured = raw.structuredContent;

  if (structured && typeof structured.answer === "string") {
    const rawSources = Array.isArray(structured.sources) ? structured.sources : [];
    return {
      content: structured.answer,
      citations: rawSources.map(normalizeCitation),
    };
  }

  const textBlock = (raw.content ?? []).find((block) => block.type === "text" && typeof block.text === "string");
  if (!textBlock?.text) {
    throw new Error("ask_question returned no usable text or structured content");
  }

  try {
    const parsed = JSON.parse(textBlock.text) as { answer?: string; sources?: unknown[] };
    if (typeof parsed.answer === "string") {
      const rawSources = Array.isArray(parsed.sources) ? parsed.sources : [];
      return { content: parsed.answer, citations: rawSources.map(normalizeCitation) };
    }
  } catch {
    // Not JSON — fall through to plain text below.
  }

  return { content: textBlock.text, citations: [] };
}

export async function askNotebook(notebookId: string, question: string): Promise<AskQuestionResult> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["notebooklm-mcp@latest"],
  });

  const client = new Client({ name: "cardiac-mastery-os-sync", version: "1.0.0" });
  await client.connect(transport);

  try {
    await client.callTool({
      name: "select_notebook",
      arguments: { id: notebookId },
    });

    const result = await client.callTool({
      name: "ask_question",
      arguments: { question, source_format: "json" },
    });

    return normalizeAskQuestionResult(result as RawToolResult);
  } finally {
    await client.close();
  }
}
