import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Citation } from "../src/types/database";

export interface AskQuestionResult {
  content: string;
  citations: Citation[];
}

interface RawToolResult {
  content?: Array<{ type: string; text?: string }>;
}

interface RawSource {
  sourceName?: string;
  sourceText?: string;
}

interface ToolEnvelope {
  success: boolean;
  data?: {
    answer?: string;
    sources?: RawSource[];
  };
  error?: string;
}

function normalizeCitation(raw: RawSource): Citation {
  return {
    text: typeof raw.sourceText === "string" ? raw.sourceText : "",
    sourceTitle: typeof raw.sourceName === "string" ? raw.sourceName : "",
  };
}

export function normalizeAskQuestionResult(raw: RawToolResult): AskQuestionResult {
  const textBlock = (raw.content ?? []).find((block) => block.type === "text" && typeof block.text === "string");
  if (!textBlock?.text) {
    throw new Error("ask_question returned no usable text content");
  }

  let envelope: ToolEnvelope;
  try {
    envelope = JSON.parse(textBlock.text) as ToolEnvelope;
  } catch {
    // Not the tool's standard {success, data} envelope — treat as plain text.
    return { content: textBlock.text, citations: [] };
  }

  if (!envelope.success) {
    throw new Error(`ask_question failed: ${envelope.error ?? "unknown error"}`);
  }

  const answer = envelope.data?.answer;
  if (typeof answer !== "string") {
    throw new Error("ask_question succeeded but returned no answer text");
  }

  const rawSources = Array.isArray(envelope.data?.sources) ? envelope.data.sources : [];
  return { content: answer, citations: rawSources.map(normalizeCitation) };
}

export async function askNotebook(notebookId: string, question: string): Promise<AskQuestionResult> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["notebooklm-mcp@latest"],
  });

  const client = new Client({ name: "cardiac-mastery-os-sync", version: "1.0.0" });

  try {
    await client.connect(transport);

    await client.callTool({
      name: "select_notebook",
      arguments: { id: notebookId },
    });

    const result = await client.callTool(
      {
        name: "ask_question",
        arguments: { question, source_format: "json" },
      },
      undefined,
      { timeout: 180_000 }
    );

    return normalizeAskQuestionResult(result as RawToolResult);
  } finally {
    await client.close();
  }
}
