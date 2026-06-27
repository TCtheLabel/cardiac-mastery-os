import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { getNotebookKnowledge, upsertNotebookKnowledge } from "../notebookKnowledge";

const TEST_DOMAIN = "__test__ aortic_surgery";

afterEach(async () => {
  const supabase = getSupabaseClient();
  await supabase.from("notebook_knowledge").delete().eq("domain", TEST_DOMAIN);
});

describe("notebookKnowledge db service", () => {
  it("creates a notebook knowledge row and reads it back", async () => {
    const citations = [{ text: "Class A dissections involve the ascending aorta.", sourceTitle: "Sabiston Ch. 4" }];
    const created = await upsertNotebookKnowledge(TEST_DOMAIN, "Synthesis content.", citations);

    expect(created.domain).toBe(TEST_DOMAIN);
    expect(created.content).toBe("Synthesis content.");
    expect(created.citations).toEqual(citations);

    const fetched = await getNotebookKnowledge(TEST_DOMAIN);
    expect(fetched?.content).toBe("Synthesis content.");
    expect(fetched?.citations).toEqual(citations);
  });

  it("overwrites existing content for the same domain on re-sync", async () => {
    await upsertNotebookKnowledge(TEST_DOMAIN, "First synthesis.", []);
    const updated = await upsertNotebookKnowledge(TEST_DOMAIN, "Second synthesis.", []);

    expect(updated.content).toBe("Second synthesis.");

    const fetched = await getNotebookKnowledge(TEST_DOMAIN);
    expect(fetched?.content).toBe("Second synthesis.");
  });

  it("returns null for an unknown domain", async () => {
    const fetched = await getNotebookKnowledge("__test__ does_not_exist");
    expect(fetched).toBeNull();
  });
});
