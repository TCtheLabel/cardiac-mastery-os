import { getOpenAIClient } from "@/lib/openai/client";
import type { QuestionCategory, TrainingSource } from "@/types/database";

export interface GeneratedQuestion {
  category: QuestionCategory;
  prompt: string;
}

export interface GeneratedSession {
  topic: string;
  questions: GeneratedQuestion[];
}

const QUESTION_CATEGORIES: QuestionCategory[] = [
  "decision_making",
  "operative_planning",
  "complication_management",
  "pattern_recognition",
  "reflection",
];

const SYSTEM_PROMPT = `You are an expert cardiac surgery educator creating deliberate-practice training questions for a surgical resident.

Read the resident's submitted content (a reflection, case note, article summary, or insight). Then:

1. Identify a single, specific topic that captures the clinical focus of this content. This will be used as the session title (e.g., "Post-op Tamponade Management", "Aortic Valve Replacement Sizing").
2. Generate 3 to 6 training questions that test the resident's clinical judgment related to this content. Distribute questions across these categories as relevant to the content — not every category needs to be used, and do not force categories that don't fit:
   - decision_making: Why was a particular choice made, and what alternatives existed?
   - operative_planning: How would the operative approach be planned or modified?
   - complication_management: How should a related complication be recognized and managed?
   - pattern_recognition: What clinical or imaging pattern is significant here?
   - reflection: What broader principle or lesson applies?

Each question prompt must be specific to the submitted content, not generic. Write prompts as direct questions a senior attending might ask during a case discussion.`;

export async function generateSession(source: TrainingSource): Promise<GeneratedSession> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Source type: ${source.sourceType}\n\nContent:\n${source.content}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "training_session",
        strict: true,
        schema: {
          type: "object",
          properties: {
            topic: { type: "string" },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string", enum: QUESTION_CATEGORIES },
                  prompt: { type: "string" },
                },
                required: ["category", "prompt"],
                additionalProperties: false,
              },
            },
          },
          required: ["topic", "questions"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response for generateSession");
  }

  return JSON.parse(content) as GeneratedSession;
}
