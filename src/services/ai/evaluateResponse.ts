import { getOpenAIClient } from "@/lib/openai/client";
import type { Question, QualitySignal, TrainingSource } from "@/types/database";

export interface EvaluateResponseInput {
  responseText: string;
  question: Question;
  source: TrainingSource;
}

export interface EvaluationResult {
  strengths: string;
  missedConcepts: string;
  improvements: string;
  principle: string;
  qualitySignal: QualitySignal;
}

const QUALITY_SIGNALS: QualitySignal[] = ["strong", "adequate", "weak"];

const SYSTEM_PROMPT = `You are an expert cardiac surgery attending evaluating a resident's answer to a training question, in the context of the original case material they submitted.

Given the original source content, the question asked, and the resident's response, evaluate the response and return:

- strengths: What the response got right, specifically.
- missedConcepts: Important concepts, considerations, or risks the response missed. Write each distinct missed concept on its own line. If nothing important was missed, return an empty string.
- improvements: Concrete suggestions for how the response could be strengthened.
- principle: The single most important underlying surgical principle this question and response illustrate, stated concisely.
- qualitySignal: An overall judgment of the response's clinical reasoning quality:
  - "strong": thorough, accurate, anticipates complications
  - "adequate": correct core reasoning but missing depth or nuance
  - "weak": significant gaps, inaccuracies, or superficial reasoning`;

export async function evaluateResponse(input: EvaluateResponseInput): Promise<EvaluationResult> {
  const client = getOpenAIClient();
  const { responseText, question, source } = input;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Original source content:\n${source.content}\n\nQuestion (${question.category}):\n${question.prompt}\n\nResident's response:\n${responseText}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "response_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            strengths: { type: "string" },
            missedConcepts: { type: "string" },
            improvements: { type: "string" },
            principle: { type: "string" },
            qualitySignal: { type: "string", enum: QUALITY_SIGNALS },
          },
          required: ["strengths", "missedConcepts", "improvements", "principle", "qualitySignal"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response for evaluateResponse");
  }

  return JSON.parse(content) as EvaluationResult;
}
