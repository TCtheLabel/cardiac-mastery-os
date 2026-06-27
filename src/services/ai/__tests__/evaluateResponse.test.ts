import { describe, expect, it, vi } from "vitest";
import type { Question, TrainingSource } from "@/types/database";

const mockCreate = vi.fn();

vi.mock("@/lib/openai/client", () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

import { evaluateResponse } from "../evaluateResponse";

describe("evaluateResponse", () => {
  it("parses the OpenAI response into an evaluation result", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              strengths: "Correctly identified hypotension and rising CVP as key signs.",
              missedConcepts: "Did not mention echo as a confirmatory step\nDid not discuss output trends",
              improvements: "Mention bedside echo before deciding on re-exploration.",
              principle: "Tamponade is a clinical diagnosis; imaging should not delay treatment when classic signs are present.",
              qualitySignal: "adequate",
            }),
          },
        },
      ],
    });

    const question: Question = {
      id: "22222222-2222-2222-2222-222222222222",
      sessionId: "33333333-3333-3333-3333-333333333333",
      category: "complication_management",
      prompt: "What were the early warning signs of tamponade in this case?",
      orderIndex: 0,
    };

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Managed a post-op tamponade overnight.",
      sourceType: "case_note",
      createdAt: new Date().toISOString(),
      domain: null,
      citations: [],
    };

    const result = await evaluateResponse({
      responseText: "Hypotension and rising CVP were the early signs.",
      question,
      source,
    });

    expect(result.qualitySignal).toBe("adequate");
    expect(result.missedConcepts).toContain("echo");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        response_format: expect.objectContaining({ type: "json_schema" }),
      })
    );
  });

  it("throws if OpenAI returns an empty response", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

    const question: Question = {
      id: "22222222-2222-2222-2222-222222222222",
      sessionId: "33333333-3333-3333-3333-333333333333",
      category: "reflection",
      prompt: "What principle applies here?",
      orderIndex: 0,
    };

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Reviewed an aortic dissection paper.",
      sourceType: "article_summary",
      createdAt: new Date().toISOString(),
      domain: null,
      citations: [],
    };

    await expect(
      evaluateResponse({ responseText: "Some answer.", question, source })
    ).rejects.toThrow("empty response");
  });
});
