import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { listMasteryTopics } from "@/services/db/mastery";
import { createSessionWithQuestions } from "@/services/db/sessions";
import { createSource } from "@/services/db/sources";

vi.mock("@/services/ai/evaluateResponse", () => ({
  evaluateResponse: vi.fn().mockResolvedValue({
    strengths: "Correctly identified the need for re-exploration.",
    missedConcepts: "Did not mention bedside echo",
    improvements: "Consider ordering a bedside echo before re-exploration.",
    principle: "Hemodynamic instability after cardiac surgery requires rapid bedside assessment.",
    qualitySignal: "adequate",
  }),
}));

const { mockClassifyTopicRegion } = vi.hoisted(() => ({
  mockClassifyTopicRegion: vi.fn(),
}));

vi.mock("@/services/ai/classifyTopicRegion", () => ({
  classifyTopicRegion: mockClassifyTopicRegion,
}));

import { POST } from "../route";

const TOPIC = "__test__ Post-op Tamponade Management";
const createdSourceIds: string[] = [];

afterEach(async () => {
  const supabase = getSupabaseClient();
  if (createdSourceIds.length > 0) {
    await supabase.from("training_sources").delete().in("id", createdSourceIds);
    createdSourceIds.length = 0;
  }
  await supabase.from("mastery_topics").delete().eq("topic", TOPIC);
  mockClassifyTopicRegion.mockReset();
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/evaluate-response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setupFixture() {
  const source = await createSource("Managed a post-op tamponade overnight.", "case_note");
  createdSourceIds.push(source.id);
  const { questions } = await createSessionWithQuestions(source.id, TOPIC, [
    { category: "complication_management", prompt: "What were the early warning signs?" },
  ]);
  return { source, question: questions[0] };
}

describe("POST /api/evaluate-response", () => {
  it("creates a response, evaluation, and updates mastery progress", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("whole_heart");
    const { question } = await setupFixture();

    const res = await POST(
      makeRequest({
        questionId: question.id,
        responseText: "I would take the patient back to the OR for re-exploration.",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.qualitySignal).toBe("adequate");

    const topics = await listMasteryTopics();
    const topic = topics.find((t) => t.topic === TOPIC);
    expect(topic).toBeDefined();
    expect(topic?.weakAreas).toContain("Did not mention bedside echo");
  });

  it("returns 400 when questionId is missing", async () => {
    const res = await POST(makeRequest({ responseText: "some text" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when responseText is missing", async () => {
    const { question } = await setupFixture();

    const res = await POST(makeRequest({ questionId: question.id }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when questionId is not found", async () => {
    const res = await POST(
      makeRequest({
        questionId: "00000000-0000-0000-0000-000000000000",
        responseText: "some text",
      })
    );
    expect(res.status).toBe(400);
  });
});
