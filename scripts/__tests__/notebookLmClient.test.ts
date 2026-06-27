import { describe, expect, it } from "vitest";
import { normalizeAskQuestionResult } from "../notebookLmClient";

describe("normalizeAskQuestionResult", () => {
  it("reads answer and sources from structuredContent when present", () => {
    const result = normalizeAskQuestionResult({
      structuredContent: {
        answer: "Type A dissections involve the ascending aorta.",
        sources: [{ title: "Sabiston Ch. 4", snippet: "Ascending aorta involvement defines Type A." }],
      },
    });

    expect(result.content).toBe("Type A dissections involve the ascending aorta.");
    expect(result.citations).toEqual([
      { text: "Ascending aorta involvement defines Type A.", sourceTitle: "Sabiston Ch. 4" },
    ]);
  });

  it("treats a non-array sources field as no citations", () => {
    const result = normalizeAskQuestionResult({
      structuredContent: { answer: "Some answer.", sources: "not-an-array" },
    });
    expect(result.citations).toEqual([]);
  });

  it("parses a JSON-encoded text block when structuredContent is absent", () => {
    const result = normalizeAskQuestionResult({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            answer: "Type B dissections spare the ascending aorta.",
            sources: ["Sabiston Ch. 4"],
          }),
        },
      ],
    });

    expect(result.content).toBe("Type B dissections spare the ascending aorta.");
    expect(result.citations).toEqual([{ text: "Sabiston Ch. 4", sourceTitle: "" }]);
  });

  it("falls back to plain text with no citations when the text block isn't JSON", () => {
    const result = normalizeAskQuestionResult({
      content: [{ type: "text", text: "Type A dissections involve the ascending aorta." }],
    });

    expect(result.content).toBe("Type A dissections involve the ascending aorta.");
    expect(result.citations).toEqual([]);
  });

  it("throws when there is no usable content", () => {
    expect(() => normalizeAskQuestionResult({})).toThrow("no usable text or structured content");
  });
});
