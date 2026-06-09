import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { createSource } from "../sources";
import { createSessionWithQuestions, getSessionWithQuestions, listSessions } from "../sessions";

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

describe("sessions db service", () => {
  it("creates a session with questions and reads it back", async () => {
    const source = await createSource("Managed a post-op tamponade overnight.", "case_note");

    const { session, questions } = await createSessionWithQuestions(
      source.id,
      "Post-op Tamponade Management",
      [
        { category: "complication_management", prompt: "What were the early warning signs?" },
        { category: "decision_making", prompt: "Why was bedside re-exploration chosen over imaging first?" },
      ]
    );

    expect(session.sourceId).toBe(source.id);
    expect(session.topic).toBe("Post-op Tamponade Management");
    expect(questions).toHaveLength(2);
    expect(questions[0].orderIndex).toBe(0);
    expect(questions[1].orderIndex).toBe(1);

    const fetched = await getSessionWithQuestions(session.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.questions).toHaveLength(2);
    expect(fetched?.questions[0].prompt).toBe("What were the early warning signs?");
  });

  it("lists sessions newest first", async () => {
    const source = await createSource("Reviewed an aortic dissection paper.", "article_summary");
    const { session: first } = await createSessionWithQuestions(source.id, "Aortic Dissection", [
      { category: "pattern_recognition", prompt: "What imaging finding clinches the diagnosis?" },
    ]);
    const { session: second } = await createSessionWithQuestions(source.id, "Aortic Dissection Follow-up", [
      { category: "operative_planning", prompt: "How does arch involvement change the operative approach?" },
    ]);

    const sessions = await listSessions();
    const ids = sessions.map((s) => s.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });
});
