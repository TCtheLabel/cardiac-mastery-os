import { describe, expect, it, vi } from "vitest";
import type { TrainingSource } from "@/types/database";

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

import { generateSession } from "../generateSession";

describe("generateSession", () => {
  it("parses the OpenAI response into a topic and questions", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              topic: "Post-op Tamponade Management",
              questions: [
                {
                  category: "complication_management",
                  prompt: "What were the early warning signs of tamponade in this case?",
                },
                {
                  category: "decision_making",
                  prompt: "Why was bedside re-exploration chosen over imaging first?",
                },
              ],
            }),
          },
        },
      ],
    });

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Managed a post-op tamponade overnight.",
      sourceType: "case_note",
      createdAt: new Date().toISOString(),
    };

    const result = await generateSession(source);

    expect(result.topic).toBe("Post-op Tamponade Management");
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].category).toBe("complication_management");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        response_format: expect.objectContaining({ type: "json_schema" }),
      })
    );
  });

  it("throws if OpenAI returns an empty response", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Reviewed an aortic dissection paper.",
      sourceType: "article_summary",
      createdAt: new Date().toISOString(),
    };

    await expect(generateSession(source)).rejects.toThrow("empty response");
  });
});
