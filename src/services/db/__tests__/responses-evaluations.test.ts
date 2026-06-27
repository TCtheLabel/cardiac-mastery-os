import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { createSource } from "../sources";
import { createSessionWithQuestions } from "../sessions";
import { createResponse, getResponseById } from "../responses";
import { createEvaluation } from "../evaluations";

const createdSourceIds: string[] = [];

afterEach(async () => {
  if (createdSourceIds.length === 0) return;
  const supabase = getSupabaseClient();
  await supabase.from("training_sources").delete().in("id", createdSourceIds);
  createdSourceIds.length = 0;
});

async function seedQuestion() {
  const source = await createSource("Reflected on an LVAD complication.", "reflection");
  createdSourceIds.push(source.id);
  const { questions } = await createSessionWithQuestions(source.id, "LVAD Complications", [
    { category: "complication_management", prompt: "How would you triage a suspected pump thrombosis?" },
  ]);
  return questions[0];
}

describe("responses db service", () => {
  it("creates a response and reads it back", async () => {
    const question = await seedQuestion();
    const created = await createResponse(question.id, "I would start with LDH and free hemoglobin levels.");

    expect(created.questionId).toBe(question.id);

    const fetched = await getResponseById(created.id);
    expect(fetched?.response).toBe(created.response);
  });
});

describe("evaluations db service", () => {
  it("creates an evaluation linked to a response", async () => {
    const question = await seedQuestion();
    const response = await createResponse(question.id, "I would start with LDH and free hemoglobin levels.");

    const evaluation = await createEvaluation(response.id, {
      strengths: "Correctly identified hemolysis labs as first-line workup.",
      missedConcepts: "Did not mention echocardiographic ramp study.",
      improvements: "Pair lab workup with imaging-based confirmation earlier.",
      principle: "Suspected pump thrombosis requires combined biochemical and imaging evaluation.",
      qualitySignal: "adequate",
    });

    expect(evaluation.responseId).toBe(response.id);
    expect(evaluation.qualitySignal).toBe("adequate");
    expect(evaluation.principle).toContain("pump thrombosis");
  });
});
