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
      domain: null,
      citations: [],
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

  it("accepts a notebook_sync source", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              topic: "Aortic Dissection Classification",
              questions: [
                { category: "pattern_recognition", prompt: "What imaging finding distinguishes Type A from Type B?" },
              ],
            }),
          },
        },
      ],
    });

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Synthesis on aortic dissection classification, citing Sabiston Ch. 4.",
      sourceType: "notebook_sync",
      createdAt: new Date().toISOString(),
      domain: "aortic_surgery",
      citations: [{ text: "Type A involves the ascending aorta.", sourceTitle: "Sabiston Ch. 4" }],
    };

    const result = await generateSession(source);

    expect(result.topic).toBe("Aortic Dissection Classification");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Source type: notebook_sync"),
          }),
        ]),
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
      domain: null,
      citations: [],
    };

    await expect(generateSession(source)).rejects.toThrow("empty response");
  });
});
