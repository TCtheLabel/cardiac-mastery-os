import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";

const { mockClassifyTopicRegion } = vi.hoisted(() => ({
  mockClassifyTopicRegion: vi.fn(),
}));

vi.mock("@/services/ai/classifyTopicRegion", () => ({
  classifyTopicRegion: mockClassifyTopicRegion,
}));

import { listMasteryTopics, recordMasteryProgress } from "../mastery";

const TEST_TOPICS = ["__test__ Aortic Dissection", "__test__ Strong Topic", "__test__ Weak Topic"];

afterEach(async () => {
  const supabase = getSupabaseClient();
  await supabase.from("mastery_topics").delete().in("topic", TEST_TOPICS);
  mockClassifyTopicRegion.mockReset();
});

describe("mastery db service", () => {
  it("creates a new topic on first progress record", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("aortic_root_great_vessels");

    const topic = await recordMasteryProgress("__test__ Aortic Dissection", "adequate", [
      "Missed arch classification nuance.",
    ]);

    expect(topic.topic).toBe("__test__ Aortic Dissection");
    expect(topic.confidenceScore).toBe(65);
    expect(topic.sessionCount).toBe(1);
    expect(topic.weakAreas).toEqual(["Missed arch classification nuance."]);
    expect(topic.region).toBe("aortic_root_great_vessels");
  });

  it("blends confidence toward the new signal on repeat progress", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("aortic_root_great_vessels");
    await recordMasteryProgress("__test__ Aortic Dissection", "weak", ["Missed arch classification nuance."]);
    const updated = await recordMasteryProgress("__test__ Aortic Dissection", "strong", ["Missed timing of repair."]);

    // existing 35, blended 35*0.65 + 90*0.35 = 54.25
    expect(updated.confidenceScore).toBeCloseTo(54.25, 2);
    expect(updated.sessionCount).toBe(2);
    expect(updated.weakAreas[0]).toBe("Missed timing of repair.");
    expect(updated.weakAreas).toContain("Missed arch classification nuance.");
  });

  it("lists topics ordered by ascending confidence", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("left_ventricle");
    mockClassifyTopicRegion.mockResolvedValueOnce("left_ventricle");
    await recordMasteryProgress("__test__ Strong Topic", "strong", []);
    await recordMasteryProgress("__test__ Weak Topic", "weak", []);

    const topics = await listMasteryTopics();
    const names = topics.map((t) => t.topic);
    expect(names.indexOf("__test__ Weak Topic")).toBeLessThan(names.indexOf("__test__ Strong Topic"));
  });

  it("classifies a topic's region only once, never on repeat progress", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("mitral_valve");
    await recordMasteryProgress("__test__ Aortic Dissection", "adequate", []);

    // If called again, the mock would return undefined (no second mockResolvedValueOnce queued) —
    // a second classification call would surface as region becoming undefined/null, not "mitral_valve".
    const updated = await recordMasteryProgress("__test__ Aortic Dissection", "strong", []);

    expect(updated.region).toBe("mitral_valve");
    expect(mockClassifyTopicRegion).toHaveBeenCalledTimes(1);
  });

  it("falls back to whole_heart if classification fails", async () => {
    mockClassifyTopicRegion.mockRejectedValueOnce(new Error("OpenAI is down"));

    const topic = await recordMasteryProgress("__test__ Aortic Dissection", "adequate", []);

    expect(topic.region).toBe("whole_heart");
  });
});
