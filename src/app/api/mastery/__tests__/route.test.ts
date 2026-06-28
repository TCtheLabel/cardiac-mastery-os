import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { recordMasteryProgress } from "@/services/db/mastery";

const { mockClassifyTopicRegion } = vi.hoisted(() => ({
  mockClassifyTopicRegion: vi.fn(),
}));

vi.mock("@/services/ai/classifyTopicRegion", () => ({
  classifyTopicRegion: mockClassifyTopicRegion,
}));

const TEST_TOPICS = ["__test__ Topic Low", "__test__ Topic High"];

afterEach(async () => {
  const supabase = getSupabaseClient();
  await supabase.from("mastery_topics").delete().in("topic", TEST_TOPICS);
  mockClassifyTopicRegion.mockReset();
});

import { GET } from "../route";

describe("GET /api/mastery", () => {
  it("returns mastery topics ordered by confidence ascending", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("left_ventricle");
    mockClassifyTopicRegion.mockResolvedValueOnce("left_ventricle");
    await recordMasteryProgress("__test__ Topic High", "strong", []);
    await recordMasteryProgress("__test__ Topic Low", "weak", []);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    const topics = body.filter((t: { topic: string }) => TEST_TOPICS.includes(t.topic));
    expect(topics[0].topic).toBe("__test__ Topic Low");
    expect(topics[1].topic).toBe("__test__ Topic High");
  });
});
