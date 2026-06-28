import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { getSessionWithQuestions } from "@/services/db/sessions";
import { getSourceById } from "@/services/db/sources";
import { upsertNotebookKnowledge } from "@/services/db/notebookKnowledge";

vi.mock("@/services/ai/generateSession", () => ({
  generateSession: vi.fn().mockResolvedValue({
    topic: "Aortic Dissection Classification",
    questions: [
      { category: "pattern_recognition", prompt: "What distinguishes a Class A from a Class B dissection?" },
    ],
  }),
}));

import { POST } from "../route";

const TEST_DOMAIN = "__test__ aortic_surgery";
const createdSourceIds: string[] = [];

afterEach(async () => {
  const supabase = getSupabaseClient();
  await supabase.from("notebook_knowledge").delete().eq("domain", TEST_DOMAIN);
  if (createdSourceIds.length > 0) {
    await supabase.from("training_sources").delete().in("id", createdSourceIds);
    createdSourceIds.length = 0;
  }
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/train-notebook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/train-notebook", () => {
  it("creates a session from synced notebook content with no topic prefix when topic is omitted", async () => {
    await upsertNotebookKnowledge(TEST_DOMAIN, "Aortic dissections are classified by the Stanford system.", []);

    const res = await POST(makeRequest({ domain: TEST_DOMAIN }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBeDefined();

    const sessionData = await getSessionWithQuestions(body.sessionId);
    if (sessionData) createdSourceIds.push(sessionData.session.sourceId);

    const source = await getSourceById(sessionData!.session.sourceId);
    expect(source?.content).toBe("Aortic dissections are classified by the Stanford system.");
    expect(source?.domain).toBe(TEST_DOMAIN);
  });

  it("prepends the topic as a focus-area hint when provided", async () => {
    await upsertNotebookKnowledge(TEST_DOMAIN, "Aortic dissections are classified by the Stanford system.", []);

    const res = await POST(makeRequest({ domain: TEST_DOMAIN, topic: "Stanford classification" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    const sessionData = await getSessionWithQuestions(body.sessionId);
    if (sessionData) createdSourceIds.push(sessionData.session.sourceId);

    const source = await getSourceById(sessionData!.session.sourceId);
    expect(source?.content).toBe(
      "Focus area: Stanford classification\n\nAortic dissections are classified by the Stanford system."
    );
  });

  it("returns 400 when domain is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the domain has no synced content", async () => {
    const res = await POST(makeRequest({ domain: "__test__ does_not_exist" }));
    expect(res.status).toBe(400);
  });
});
