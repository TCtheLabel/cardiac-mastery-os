import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { getSessionWithQuestions } from "@/services/db/sessions";

vi.mock("@/services/ai/generateSession", () => ({
  generateSession: vi.fn().mockResolvedValue({
    topic: "Post-op Tamponade Management",
    questions: [
      { category: "complication_management", prompt: "What were the early warning signs?" },
      { category: "decision_making", prompt: "Why was bedside re-exploration chosen?" },
    ],
  }),
}));

import { POST } from "../route";

async function cleanup() {
  const supabase = getSupabaseClient();
  await supabase
    .from("training_sources")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
}

afterEach(async () => {
  await cleanup();
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/generate-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-session", () => {
  it("creates a source, session, and questions, and returns the sessionId", async () => {
    const res = await POST(
      makeRequest({ content: "Managed a post-op tamponade overnight.", sourceType: "case_note" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBeDefined();

    const sessionData = await getSessionWithQuestions(body.sessionId);
    expect(sessionData?.session.topic).toBe("Post-op Tamponade Management");
    expect(sessionData?.questions).toHaveLength(2);
  });

  it("returns 400 when content is missing", async () => {
    const res = await POST(makeRequest({ sourceType: "case_note" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sourceType is invalid", async () => {
    const res = await POST(makeRequest({ content: "Some content here that is long enough.", sourceType: "podcast" }));
    expect(res.status).toBe(400);
  });
});
