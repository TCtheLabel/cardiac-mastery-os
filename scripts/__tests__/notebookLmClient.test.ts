import { describe, expect, it } from "vitest";
import { normalizeAskQuestionResult } from "../notebookLmClient";

describe("normalizeAskQuestionResult", () => {
  it("extracts answer and sources from a successful envelope", () => {
    const result = normalizeAskQuestionResult({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            data: {
              answer: "Type A dissections involve the ascending aorta.",
              sources: [
                { sourceName: "Sabiston Ch. 4", sourceText: "Ascending aorta involvement defines Type A." },
              ],
            },
          }),
        },
      ],
    });

    expect(result.content).toBe("Type A dissections involve the ascending aorta.");
    expect(result.citations).toEqual([
      { text: "Ascending aorta involvement defines Type A.", sourceTitle: "Sabiston Ch. 4" },
    ]);
  });

  it("treats a non-array sources field as no citations", () => {
    const result = normalizeAskQuestionResult({
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, data: { answer: "Some answer.", sources: "not-an-array" } }),
        },
      ],
    });
    expect(result.citations).toEqual([]);
  });

  it("throws with the tool's own error message when success is false", () => {
    expect(() =>
      normalizeAskQuestionResult({
        content: [
          { type: "text", text: JSON.stringify({ success: false, error: "Failed to authenticate session" }) },
        ],
      })
    ).toThrow("Failed to authenticate session");
  });

  it("throws when the envelope reports success but has no answer", () => {
    expect(() =>
      normalizeAskQuestionResult({
        content: [{ type: "text", text: JSON.stringify({ success: true, data: {} }) }],
      })
    ).toThrow("no answer text");
  });

  it("falls back to plain text with no citations when the text block isn't the tool's JSON envelope", () => {
    const result = normalizeAskQuestionResult({
      content: [{ type: "text", text: "Type A dissections involve the ascending aorta." }],
    });

    expect(result.content).toBe("Type A dissections involve the ascending aorta.");
    expect(result.citations).toEqual([]);
  });

  it("throws when there is no usable content", () => {
    expect(() => normalizeAskQuestionResult({})).toThrow("no usable text content");
  });
});
