import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { createSessionWithQuestions } from "@/services/db/sessions";
import { createSource } from "@/services/db/sources";
import { GET } from "../route";

const createdSourceIds: string[] = [];

afterEach(async () => {
  if (createdSourceIds.length === 0) return;
  const supabase = getSupabaseClient();
  await supabase.from("training_sources").delete().in("id", createdSourceIds);
  createdSourceIds.length = 0;
});

function makeParams(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) };
}

describe("GET /api/sessions/[sessionId]", () => {
  it("returns an empty citations array for a non-notebook source", async () => {
    const source = await createSource("Managed a post-op tamponade overnight.", "case_note");
    createdSourceIds.push(source.id);
    const { session } = await createSessionWithQuestions(source.id, "Post-op Tamponade Management", [
      { category: "complication_management", prompt: "What were the early warning signs?" },
    ]);

    const res = await GET(new Request("http://localhost/api/sessions/x"), makeParams(session.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.citations).toEqual([]);
  });

  it("returns citations from the source for a notebook_sync session", async () => {
    const citations = [{ text: "Type A dissections involve the ascending aorta.", sourceTitle: "Sabiston Ch. 4" }];
    const source = await createSource("Synthesis on aortic dissection.", "notebook_sync", {
      domain: "aortic_surgery",
      citations,
    });
    createdSourceIds.push(source.id);
    const { session } = await createSessionWithQuestions(source.id, "Aortic Dissection", [
      { category: "pattern_recognition", prompt: "What imaging finding distinguishes Type A from Type B?" },
    ]);

    const res = await GET(new Request("http://localhost/api/sessions/x"), makeParams(session.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.citations).toEqual(citations);
  });

  it("returns 404 for an unknown session", async () => {
    const res = await GET(
      new Request("http://localhost/api/sessions/x"),
      makeParams("00000000-0000-0000-0000-000000000000")
    );
    expect(res.status).toBe(404);
  });
});
