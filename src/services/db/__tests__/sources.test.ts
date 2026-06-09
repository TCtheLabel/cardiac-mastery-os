import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { createSource, getSourceById } from "../sources";

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

describe("sources db service", () => {
  it("creates a source and reads it back", async () => {
    const created = await createSource("Reflected on a tough valve case today.", "reflection");

    expect(created.id).toBeTruthy();
    expect(created.content).toBe("Reflected on a tough valve case today.");
    expect(created.sourceType).toBe("reflection");

    const fetched = await getSourceById(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.content).toBe(created.content);
  });

  it("returns null for an unknown id", async () => {
    const fetched = await getSourceById("00000000-0000-0000-0000-000000000000");
    expect(fetched).toBeNull();
  });
});
