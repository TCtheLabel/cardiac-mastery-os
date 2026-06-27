import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { createSource } from "../sources";
import { createSessionWithQuestions, getSessionWithQuestions, getQuestionById, listSessions } from "../sessions";

const createdSourceIds: string[] = [];

afterEach(async () => {
  if (createdSourceIds.length === 0) return;
  const supabase = getSupabaseClient();
  await supabase.from("training_sources").delete().in("id", createdSourceIds);
  createdSourceIds.length = 0;
});

describe("sessions db service", () => {
  it("creates a session with questions and reads it back", async () => {
    const source = await createSource("Managed a post-op tamponade overnight.", "case_note");
    createdSourceIds.push(source.id);

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
    createdSourceIds.push(source.id);
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

  it("fetches a single question by id", async () => {
    const source = await createSource("Reviewed mitral valve repair technique.", "article_summary");
    createdSourceIds.push(source.id);
    const { questions } = await createSessionWithQuestions(source.id, "Mitral Valve Repair", [
      { category: "operative_planning", prompt: "How would you size the annuloplasty band?" },
    ]);

    const question = await getQuestionById(questions[0].id);
    expect(question).not.toBeNull();
    expect(question?.prompt).toBe("How would you size the annuloplasty band?");
    expect(question?.sessionId).toBe(questions[0].sessionId);
  });

  it("returns null for a missing question id", async () => {
    const question = await getQuestionById("00000000-0000-0000-0000-000000000001");
    expect(question).toBeNull();
  });
});
