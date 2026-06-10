import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { recordMasteryProgress } from "@/services/db/mastery";

async function cleanup() {
  const supabase = getSupabaseClient();
  await supabase.from("mastery_topics").delete().in("topic", ["Topic Low", "Topic High"]);
}

afterEach(async () => {
  await cleanup();
});

import { GET } from "../route";

describe("GET /api/mastery", () => {
  it("returns mastery topics ordered by confidence ascending", async () => {
    await recordMasteryProgress("Topic High", "strong", []);
    await recordMasteryProgress("Topic Low", "weak", []);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    const topics = body.filter((t: { topic: string }) => ["Topic Low", "Topic High"].includes(t.topic));
    expect(topics[0].topic).toBe("Topic Low");
    expect(topics[1].topic).toBe("Topic High");
  });
});
