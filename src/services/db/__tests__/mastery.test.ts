import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { listMasteryTopics, recordMasteryProgress } from "../mastery";

async function cleanup() {
  const supabase = getSupabaseClient();
  await supabase
    .from("mastery_topics")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
}

afterEach(async () => {
  await cleanup();
});

describe("mastery db service", () => {
  it("creates a new topic on first progress record", async () => {
    const topic = await recordMasteryProgress("Aortic Dissection", "adequate", [
      "Missed arch classification nuance.",
    ]);

    expect(topic.topic).toBe("Aortic Dissection");
    expect(topic.confidenceScore).toBe(65);
    expect(topic.sessionCount).toBe(1);
    expect(topic.weakAreas).toEqual(["Missed arch classification nuance."]);
  });

  it("blends confidence toward the new signal on repeat progress", async () => {
    await recordMasteryProgress("Aortic Dissection", "weak", ["Missed arch classification nuance."]);
    const updated = await recordMasteryProgress("Aortic Dissection", "strong", ["Missed timing of repair."]);

    // existing 35, blended 35*0.65 + 90*0.35 = 54.25
    expect(updated.confidenceScore).toBeCloseTo(54.25, 2);
    expect(updated.sessionCount).toBe(2);
    expect(updated.weakAreas[0]).toBe("Missed timing of repair.");
    expect(updated.weakAreas).toContain("Missed arch classification nuance.");
  });

  it("lists topics ordered by ascending confidence", async () => {
    await recordMasteryProgress("Strong Topic", "strong", []);
    await recordMasteryProgress("Weak Topic", "weak", []);

    const topics = await listMasteryTopics();
    const names = topics.map((t) => t.topic);
    expect(names.indexOf("Weak Topic")).toBeLessThan(names.indexOf("Strong Topic"));
  });
});
