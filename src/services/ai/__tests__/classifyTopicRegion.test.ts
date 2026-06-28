import { describe, expect, it, vi } from "vitest";

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

import { classifyTopicRegion } from "../classifyTopicRegion";

describe("classifyTopicRegion", () => {
  it("parses the OpenAI response into a region", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ region: "mitral_valve" }) } }],
    });

    const region = await classifyTopicRegion("Mitral Valve Repair Technique");

    expect(region).toBe("mitral_valve");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        response_format: expect.objectContaining({ type: "json_schema" }),
      })
    );
  });

  it("throws if OpenAI returns an empty response", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

    await expect(classifyTopicRegion("Some topic")).rejects.toThrow("empty response");
  });
});
