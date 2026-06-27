import { describe, expect, it } from "vitest";
import { getNotebookId } from "../notebook-domains";

describe("getNotebookId", () => {
  const table = { aortic_surgery: "<notebooklm-library-id>", valve_surgery: "real-id-123" };

  it("throws for a domain not in the table", () => {
    expect(() => getNotebookId("not_a_real_domain", table)).toThrow('Unknown domain "not_a_real_domain"');
  });

  it("throws for a domain with an unfilled placeholder id", () => {
    expect(() => getNotebookId("aortic_surgery", table)).toThrow("no notebooklm-mcp library id configured");
  });

  it("returns the configured id for a filled-in domain", () => {
    expect(getNotebookId("valve_surgery", table)).toBe("real-id-123");
  });
});
