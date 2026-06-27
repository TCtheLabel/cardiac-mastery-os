# NotebookLM MCP Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Human checkpoint:** Task 2 (database migration) and Task 14 (end-to-end verification) require Thomas to take action outside this repo (Supabase Dashboard SQL Editor; Google/NotebookLM auth). A subagent cannot complete these steps — stop and wait for Thomas to confirm before continuing past them.

**Goal:** Pull a citation-backed teaching synthesis from existing NotebookLM notebooks into Cardiac Mastery OS via a local-only MCP client, and turn it into a training session using the existing generate → train → evaluate pipeline, with citations visible during training.

**Architecture:** Two standalone local scripts (`sync-notebook.ts`, `train-from-notebook.ts`) run by Thomas on his own machine. `sync-notebook` spawns `notebooklm-mcp` over stdio, queries a domain's notebook, and caches the result in a new `notebook_knowledge` Supabase table. `train-from-notebook` reads that cache and reuses the existing `createSource`/`generateSession`/`createSessionWithQuestions` pipeline unchanged. The deployed Vercel app never talks to NotebookLM — it only reads Supabase.

**Tech Stack:** Next.js 15, TypeScript, Supabase (`@supabase/supabase-js`), OpenAI (`openai`), Vitest, `@modelcontextprotocol/sdk` (MCP client), `tsx` (script runner), `dotenv`.

---

## Task 1: Make the test suite safe against production data

**Why this is first:** every existing test file's cleanup blanket-deletes an entire table on Supabase Cloud — the same database the deployed app reads from. Today all tables are empty (confirmed via direct query), so nothing has been lost, but the next time real data exists, running `npm test` will destroy it. This must be fixed before adding more tests that follow the same pattern.

**Files:**
- Modify: `vitest.config.ts`
- Modify: `src/services/db/__tests__/sources.test.ts`
- Modify: `src/services/db/__tests__/sessions.test.ts`
- Modify: `src/services/db/__tests__/responses-evaluations.test.ts`
- Modify: `src/services/db/__tests__/mastery.test.ts`
- Modify: `src/app/api/generate-session/__tests__/route.test.ts`
- Modify: `src/app/api/evaluate-response/__tests__/route.test.ts`

- [ ] **Step 1: Disable Vitest file parallelism (fixes the cross-file race that causes FK violations)**

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    globals: true,
    env: loadEnv(mode, process.cwd(), ""),
    fileParallelism: false,
  },
}));
```

- [ ] **Step 2: Scope `sources.test.ts` cleanup to rows it created**

Replace the whole file:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { createSource, getSourceById } from "../sources";

const createdSourceIds: string[] = [];

afterEach(async () => {
  if (createdSourceIds.length === 0) return;
  const supabase = getSupabaseClient();
  await supabase.from("training_sources").delete().in("id", createdSourceIds);
  createdSourceIds.length = 0;
});

describe("sources db service", () => {
  it("creates a source and reads it back", async () => {
    const created = await createSource("Reflected on a tough valve case today.", "reflection");
    createdSourceIds.push(created.id);

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
```

- [ ] **Step 3: Scope `sessions.test.ts` cleanup to rows it created**

Replace the whole file:

```ts
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
```

- [ ] **Step 4: Scope `responses-evaluations.test.ts` cleanup to rows it created**

Replace the whole file:

```ts
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
```

- [ ] **Step 5: Scope `mastery.test.ts` cleanup and rename topics to test-distinctive strings**

Real AI-generated topics read like "Aortic Dissection Classification and Management" — but `"Aortic Dissection"` alone is a plausible enough real topic name that a blanket-by-name approach is risky. Prefix all test topic names with `__test__ ` so they can never collide with real data, and scope the delete to exactly those names.

Replace the whole file:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { listMasteryTopics, recordMasteryProgress } from "../mastery";

const TEST_TOPICS = ["__test__ Aortic Dissection", "__test__ Strong Topic", "__test__ Weak Topic"];

afterEach(async () => {
  const supabase = getSupabaseClient();
  await supabase.from("mastery_topics").delete().in("topic", TEST_TOPICS);
});

describe("mastery db service", () => {
  it("creates a new topic on first progress record", async () => {
    const topic = await recordMasteryProgress("__test__ Aortic Dissection", "adequate", [
      "Missed arch classification nuance.",
    ]);

    expect(topic.topic).toBe("__test__ Aortic Dissection");
    expect(topic.confidenceScore).toBe(65);
    expect(topic.sessionCount).toBe(1);
    expect(topic.weakAreas).toEqual(["Missed arch classification nuance."]);
  });

  it("blends confidence toward the new signal on repeat progress", async () => {
    await recordMasteryProgress("__test__ Aortic Dissection", "weak", ["Missed arch classification nuance."]);
    const updated = await recordMasteryProgress("__test__ Aortic Dissection", "strong", ["Missed timing of repair."]);

    // existing 35, blended 35*0.65 + 90*0.35 = 54.25
    expect(updated.confidenceScore).toBeCloseTo(54.25, 2);
    expect(updated.sessionCount).toBe(2);
    expect(updated.weakAreas[0]).toBe("Missed timing of repair.");
    expect(updated.weakAreas).toContain("Missed arch classification nuance.");
  });

  it("lists topics ordered by ascending confidence", async () => {
    await recordMasteryProgress("__test__ Strong Topic", "strong", []);
    await recordMasteryProgress("__test__ Weak Topic", "weak", []);

    const topics = await listMasteryTopics();
    const names = topics.map((t) => t.topic);
    expect(names.indexOf("__test__ Weak Topic")).toBeLessThan(names.indexOf("__test__ Strong Topic"));
  });
});
```

- [ ] **Step 6: Scope `generate-session` route test cleanup to rows it created**

Replace the whole file:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { getSessionWithQuestions } from "@/services/db/sessions";

vi.mock("@/services/ai/generateSession", () => ({
  generateSession: vi.fn().mockResolvedValue({
    topic: "Post-op Tamponade Management",
    questions: [
      { category: "complication_management", prompt: "What were the early warning signs?" },
      { category: "decision_making", prompt: "Why was bedside re-exploration chosen?" },
    ],
  }),
}));

import { POST } from "../route";

const createdSourceIds: string[] = [];

afterEach(async () => {
  if (createdSourceIds.length === 0) return;
  const supabase = getSupabaseClient();
  await supabase.from("training_sources").delete().in("id", createdSourceIds);
  createdSourceIds.length = 0;
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/generate-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/generate-session", () => {
  it("creates a source, session, and questions, and returns the sessionId", async () => {
    const res = await POST(
      makeRequest({ content: "Managed a post-op tamponade overnight.", sourceType: "case_note" })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBeDefined();

    const sessionData = await getSessionWithQuestions(body.sessionId);
    if (sessionData) createdSourceIds.push(sessionData.session.sourceId);
    expect(sessionData?.session.topic).toBe("Post-op Tamponade Management");
    expect(sessionData?.questions).toHaveLength(2);
  });

  it("returns 400 when content is missing", async () => {
    const res = await POST(makeRequest({ sourceType: "case_note" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sourceType is invalid", async () => {
    const res = await POST(makeRequest({ content: "Some content here that is long enough.", sourceType: "podcast" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 7: Scope `evaluate-response` route test cleanup and rename its topic constant**

`"Post-op Tamponade Management"` is used verbatim as an example topic elsewhere in this codebase and is plausible as real data. Rename to a test-distinctive constant.

Replace the whole file:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { listMasteryTopics } from "@/services/db/mastery";
import { createSessionWithQuestions } from "@/services/db/sessions";
import { createSource } from "@/services/db/sources";

vi.mock("@/services/ai/evaluateResponse", () => ({
  evaluateResponse: vi.fn().mockResolvedValue({
    strengths: "Correctly identified the need for re-exploration.",
    missedConcepts: "Did not mention bedside echo",
    improvements: "Consider ordering a bedside echo before re-exploration.",
    principle: "Hemodynamic instability after cardiac surgery requires rapid bedside assessment.",
    qualitySignal: "adequate",
  }),
}));

import { POST } from "../route";

const TOPIC = "__test__ Post-op Tamponade Management";
const createdSourceIds: string[] = [];

afterEach(async () => {
  const supabase = getSupabaseClient();
  if (createdSourceIds.length > 0) {
    await supabase.from("training_sources").delete().in("id", createdSourceIds);
    createdSourceIds.length = 0;
  }
  await supabase.from("mastery_topics").delete().eq("topic", TOPIC);
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/evaluate-response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setupFixture() {
  const source = await createSource("Managed a post-op tamponade overnight.", "case_note");
  createdSourceIds.push(source.id);
  const { questions } = await createSessionWithQuestions(source.id, TOPIC, [
    { category: "complication_management", prompt: "What were the early warning signs?" },
  ]);
  return { source, question: questions[0] };
}

describe("POST /api/evaluate-response", () => {
  it("creates a response, evaluation, and updates mastery progress", async () => {
    const { question } = await setupFixture();

    const res = await POST(
      makeRequest({
        questionId: question.id,
        responseText: "I would take the patient back to the OR for re-exploration.",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.qualitySignal).toBe("adequate");

    const topics = await listMasteryTopics();
    const topic = topics.find((t) => t.topic === TOPIC);
    expect(topic).toBeDefined();
    expect(topic?.weakAreas).toContain("Did not mention bedside echo");
  });

  it("returns 400 when questionId is missing", async () => {
    const res = await POST(makeRequest({ responseText: "some text" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when responseText is missing", async () => {
    const { question } = await setupFixture();

    const res = await POST(makeRequest({ questionId: question.id }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when questionId is not found", async () => {
    const res = await POST(
      makeRequest({
        questionId: "00000000-0000-0000-0000-000000000000",
        responseText: "some text",
      })
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 8: Run the full suite and confirm it passes deterministically**

Run: `npm test`
Expected: `Test Files  9 passed (9)`, `Tests  23 passed (23)`

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts src/services/db/__tests__/sources.test.ts src/services/db/__tests__/sessions.test.ts src/services/db/__tests__/responses-evaluations.test.ts src/services/db/__tests__/mastery.test.ts src/app/api/generate-session/__tests__/route.test.ts src/app/api/evaluate-response/__tests__/route.test.ts
git commit -m "Fix test suite to never touch rows it didn't create

Every test file blanket-deleted its whole table on every run, against
the live Supabase Cloud project with no separate test database. Scope
each cleanup to the specific rows/topics each test created instead."
```

---

## Task 2: Database migration — `notebook_knowledge` table + `training_sources` columns

**Human checkpoint:** the Supabase CLI is not linked in this environment (`supabase migration list` fails with "Cannot find project ref"). Applying this migration to the live Supabase Cloud database requires Thomas to run the SQL manually via the Supabase Dashboard. A subagent cannot do this step.

**Files:**
- Create: `supabase/migrations/20260627000000_notebooklm_integration.sql`

- [ ] **Step 1: Write the migration file**

```sql
create table notebook_knowledge (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

alter table training_sources
  add column domain text,
  add column citations jsonb not null default '[]'::jsonb;

alter table training_sources drop constraint if exists training_sources_source_type_check;
alter table training_sources add constraint training_sources_source_type_check
  check (source_type in ('reflection', 'case_note', 'article_summary', 'insight', 'notebook_sync'));
```

- [ ] **Step 2: STOP — Thomas applies this manually**

Open the Supabase Dashboard for this project → SQL Editor → New Query. Paste the full contents of `supabase/migrations/20260627000000_notebooklm_integration.sql` and run it. Confirm it completes with no errors, then tell the implementing agent to continue.

- [ ] **Step 3: Verify the migration applied**

Run:

```bash
node -e '
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from("notebook_knowledge").select("*", { count: "exact", head: true }).then(({ count, error }) => {
  console.log(error ? "ERROR: " + error.message : "OK, count=" + count);
});
'
```

Expected: `OK, count=0` (table exists and is empty). If it prints an error about the relation not existing, Step 2 was not completed — stop and re-check with Thomas before continuing.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260627000000_notebooklm_integration.sql
git commit -m "Add notebook_knowledge table and training_sources columns for NotebookLM sync"
```

---

## Task 3: Extend types for notebook-sourced content

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/services/ai/__tests__/generateSession.test.ts`
- Modify: `src/services/ai/__tests__/evaluateResponse.test.ts`

- [ ] **Step 1: Add `Citation`, `NotebookKnowledge`, extend `SourceType` and `TrainingSource`**

In `src/types/database.ts`, change:

```ts
export type SourceType = "reflection" | "case_note" | "article_summary" | "insight";
```

to:

```ts
export type SourceType = "reflection" | "case_note" | "article_summary" | "insight" | "notebook_sync";

export interface Citation {
  text: string;
  sourceTitle: string;
}
```

And change:

```ts
export interface TrainingSource {
  id: string;
  content: string;
  sourceType: SourceType;
  createdAt: string;
}
```

to:

```ts
export interface TrainingSource {
  id: string;
  content: string;
  sourceType: SourceType;
  createdAt: string;
  domain: string | null;
  citations: Citation[];
}

export interface NotebookKnowledge {
  id: string;
  domain: string;
  content: string;
  citations: Citation[];
  syncedAt: string;
}
```

- [ ] **Step 2: Fix existing `TrainingSource` literals in `generateSession.test.ts`**

In `src/services/ai/__tests__/generateSession.test.ts`, both literal `TrainingSource` objects (around lines 42 and 65) are now missing required fields. Add `domain: null,` and `citations: [],` to each, e.g.:

```ts
    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Managed a post-op tamponade overnight.",
      sourceType: "case_note",
      createdAt: new Date().toISOString(),
      domain: null,
      citations: [],
    };
```

Apply the same two added lines to the second literal (content: `"Reviewed an aortic dissection paper."`, sourceType: `"article_summary"`).

- [ ] **Step 3: Fix existing `TrainingSource` literals in `evaluateResponse.test.ts`**

In `src/services/ai/__tests__/evaluateResponse.test.ts`, both literal `TrainingSource` objects (around lines 44 and 78) need the same two added fields:

```ts
    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Managed a post-op tamponade overnight.",
      sourceType: "case_note",
      createdAt: new Date().toISOString(),
      domain: null,
      citations: [],
    };
```

Apply the same two added lines to the second literal (content: `"Reviewed an aortic dissection paper."`, sourceType: `"article_summary"`).

- [ ] **Step 4: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: `Tests  23 passed (23)` (no behavior changed yet, just types).

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts src/services/ai/__tests__/generateSession.test.ts src/services/ai/__tests__/evaluateResponse.test.ts
git commit -m "Extend SourceType and TrainingSource for notebook-sourced content"
```

---

## Task 4: `notebookKnowledge` db service

**Files:**
- Create: `src/services/db/notebookKnowledge.ts`
- Create: `src/services/db/__tests__/notebookKnowledge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/services/db/__tests__/notebookKnowledge.test.ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/services/db/__tests__/notebookKnowledge.test.ts`
Expected: FAIL — `Failed to resolve import "../notebookKnowledge"` (module doesn't exist yet).

- [ ] **Step 3: Implement the service**

```ts
// src/services/db/notebookKnowledge.ts
import { getSupabaseClient } from "@/lib/supabase/server";
import type { Citation, NotebookKnowledge } from "@/types/database";

interface NotebookKnowledgeRow {
  id: string;
  domain: string;
  content: string;
  citations: Citation[];
  synced_at: string;
}

function toNotebookKnowledge(row: NotebookKnowledgeRow): NotebookKnowledge {
  return {
    id: row.id,
    domain: row.domain,
    content: row.content,
    citations: row.citations,
    syncedAt: row.synced_at,
  };
}

export async function upsertNotebookKnowledge(
  domain: string,
  content: string,
  citations: Citation[]
): Promise<NotebookKnowledge> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("notebook_knowledge")
    .upsert(
      { domain, content, citations, synced_at: new Date().toISOString() },
      { onConflict: "domain" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert notebook knowledge for domain "${domain}": ${error.message}`);
  return toNotebookKnowledge(data as NotebookKnowledgeRow);
}

export async function getNotebookKnowledge(domain: string): Promise<NotebookKnowledge | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("notebook_knowledge")
    .select()
    .eq("domain", domain)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch notebook knowledge for domain "${domain}": ${error.message}`);
  return data ? toNotebookKnowledge(data as NotebookKnowledgeRow) : null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/services/db/__tests__/notebookKnowledge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/db/notebookKnowledge.ts src/services/db/__tests__/notebookKnowledge.test.ts
git commit -m "Add notebookKnowledge db service for caching synced notebook content"
```

---

## Task 5: Extend `createSource` to accept domain and citations

**Files:**
- Modify: `src/services/db/sources.ts`
- Modify: `src/services/db/__tests__/sources.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/services/db/__tests__/sources.test.ts`, inside the existing `describe("sources db service", ...)` block, after the "creates a source and reads it back" test:

```ts
  it("creates a notebook_sync source with domain and citations", async () => {
    const citations = [{ text: "Type A dissections require emergent repair.", sourceTitle: "Sabiston Ch. 4" }];
    const created = await createSource("Synthesis on aortic dissection.", "notebook_sync", {
      domain: "aortic_surgery",
      citations,
    });
    createdSourceIds.push(created.id);

    expect(created.sourceType).toBe("notebook_sync");
    expect(created.domain).toBe("aortic_surgery");
    expect(created.citations).toEqual(citations);
  });

  it("defaults domain to null and citations to an empty array when omitted", async () => {
    const created = await createSource("Reflected on a tough valve case today.", "reflection");
    createdSourceIds.push(created.id);

    expect(created.domain).toBeNull();
    expect(created.citations).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/services/db/__tests__/sources.test.ts`
Expected: FAIL — TypeScript error (`createSource` doesn't accept a third argument yet) or a runtime error if the check constraint from Task 2 rejects `'notebook_sync'` (confirms Task 2 must be done first).

- [ ] **Step 3: Implement the change**

Replace the whole file `src/services/db/sources.ts`:

```ts
import { getSupabaseClient } from "@/lib/supabase/server";
import type { Citation, SourceType, TrainingSource } from "@/types/database";

interface SourceRow {
  id: string;
  content: string;
  source_type: SourceType;
  created_at: string;
  domain: string | null;
  citations: Citation[];
}

function toTrainingSource(row: SourceRow): TrainingSource {
  return {
    id: row.id,
    content: row.content,
    sourceType: row.source_type,
    createdAt: row.created_at,
    domain: row.domain,
    citations: row.citations,
  };
}

export interface CreateSourceOptions {
  domain?: string;
  citations?: Citation[];
}

export async function createSource(
  content: string,
  sourceType: SourceType,
  options: CreateSourceOptions = {}
): Promise<TrainingSource> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("training_sources")
    .insert({
      content,
      source_type: sourceType,
      domain: options.domain ?? null,
      citations: options.citations ?? [],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create source: ${error.message}`);
  return toTrainingSource(data as SourceRow);
}

export async function getSourceById(id: string): Promise<TrainingSource | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("training_sources")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch source ${id}: ${error.message}`);
  return data ? toTrainingSource(data as SourceRow) : null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/services/db/__tests__/sources.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/db/sources.ts src/services/db/__tests__/sources.test.ts
git commit -m "Extend createSource with optional domain and citations for notebook_sync sources"
```

---

## Task 6: Teach `generateSession` to recognize notebook-sourced content

**Files:**
- Modify: `src/services/ai/generateSession.ts`
- Modify: `src/services/ai/__tests__/generateSession.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/services/ai/__tests__/generateSession.test.ts`, inside `describe("generateSession", ...)`, after the first test:

```ts
  it("accepts a notebook_sync source", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              topic: "Aortic Dissection Classification",
              questions: [
                { category: "pattern_recognition", prompt: "What imaging finding distinguishes Type A from Type B?" },
              ],
            }),
          },
        },
      ],
    });

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Synthesis on aortic dissection classification, citing Sabiston Ch. 4.",
      sourceType: "notebook_sync",
      createdAt: new Date().toISOString(),
      domain: "aortic_surgery",
      citations: [{ text: "Type A involves the ascending aorta.", sourceTitle: "Sabiston Ch. 4" }],
    };

    const result = await generateSession(source);

    expect(result.topic).toBe("Aortic Dissection Classification");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Source type: notebook_sync"),
          }),
        ]),
      })
    );
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/services/ai/__tests__/generateSession.test.ts`
Expected: this specific test should actually already pass mechanically (the function doesn't validate `sourceType`), since Task 3 already made `TrainingSource` accept `domain`/`citations`. Run it anyway to confirm — if it passes already, that's expected; proceed to Step 3 for the prompt wording change regardless, since the goal of this task is the system prompt, not just this test.

- [ ] **Step 3: Update the system prompt**

In `src/services/ai/generateSession.ts`, change:

```ts
const SYSTEM_PROMPT = `You are an expert cardiac surgery educator creating deliberate-practice training questions for a surgical resident.

Read the resident's submitted content (a reflection, case note, article summary, or insight). Then:
```

to:

```ts
const SYSTEM_PROMPT = `You are an expert cardiac surgery educator creating deliberate-practice training questions for a surgical resident.

Read the resident's submitted content — a reflection, case note, article summary, insight, or a source-grounded synthesis pulled from the resident's curated reference library (NotebookLM). Then:
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: `Tests  24 passed (24)`.

- [ ] **Step 5: Commit**

```bash
git add src/services/ai/generateSession.ts src/services/ai/__tests__/generateSession.test.ts
git commit -m "Teach generateSession to recognize notebook-sourced content"
```

---

## Task 7: Add script dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install dependencies**

```bash
npm install --save-dev tsx dotenv @modelcontextprotocol/sdk
```

These are dev-time only: `scripts/*.ts` run locally via `tsx`, are never imported by anything under `src/app`, and are not bundled into the deployed app.

- [ ] **Step 2: Verify install**

Run: `npm ls tsx dotenv @modelcontextprotocol/sdk`
Expected: all three listed with no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add tsx, dotenv, and @modelcontextprotocol/sdk for local notebook sync scripts"
```

---

## Task 8: Domain → notebook mapping config

**Files:**
- Create: `scripts/notebook-domains.ts`
- Create: `scripts/__tests__/notebook-domains.test.ts`

`getNotebookId` takes the lookup table as an optional parameter (defaulting to the real `DOMAIN_NOTEBOOKS` map) so tests can use a synthetic fixture table instead of depending on the real config's mutable placeholder/filled-in state.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/__tests__/notebook-domains.test.ts
import { describe, expect, it } from "vitest";
import { getNotebookId } from "../notebook-domains";

describe("getNotebookId", () => {
  const table = { aortic_surgery: "<notebooklm-library-id>", valve_surgery: "real-id-123" };

  it("throws for a domain not in the table", () => {
    expect(() => getNotebookId("not_a_real_domain", table)).toThrow('Unknown domain "not_a_real_domain"');
  });

  it("throws for a domain with an unfilled placeholder id", () => {
    expect(() => getNotebookId("aortic_surgery", table)).toThrow("no notebooklm-mcp library id configured");
  });

  it("returns the configured id for a filled-in domain", () => {
    expect(getNotebookId("valve_surgery", table)).toBe("real-id-123");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/notebook-domains.test.ts`
Expected: FAIL — module `../notebook-domains` doesn't exist yet.

- [ ] **Step 3: Implement the config**

```ts
// scripts/notebook-domains.ts

// Filled in by Thomas using notebooklm-mcp's add_notebook/list_notebooks tools
// against his already-existing, already-populated NotebookLM notebooks.
export const DOMAIN_NOTEBOOKS: Record<string, string> = {
  foundations: "<notebooklm-library-id>",
  aortic_surgery: "<notebooklm-library-id>",
  valve_surgery: "<notebooklm-library-id>",
  coronary_surgery: "<notebooklm-library-id>",
  heart_failure_lvad_transplant: "<notebooklm-library-id>",
  critical_care_ecmo_perfusion: "<notebooklm-library-id>",
  cardiac_oncology: "<notebooklm-library-id>",
};

export function getNotebookId(domain: string, table: Record<string, string> = DOMAIN_NOTEBOOKS): string {
  const id = table[domain];
  if (!id) {
    throw new Error(`Unknown domain "${domain}". Valid domains: ${Object.keys(table).join(", ")}`);
  }
  if (id.startsWith("<")) {
    throw new Error(
      `Domain "${domain}" has no notebooklm-mcp library id configured yet. ` +
        `Use notebooklm-mcp's add_notebook/list_notebooks tools to register your existing NotebookLM notebook, then fill in scripts/notebook-domains.ts.`
    );
  }
  return id;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/__tests__/notebook-domains.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/notebook-domains.ts scripts/__tests__/notebook-domains.test.ts
git commit -m "Add domain-to-notebook mapping config"
```

---

## Task 9: MCP client wrapper for `notebooklm-mcp`

This is the only task that talks to the actual `notebooklm-mcp` tool. Its exact response shape for `ask_question` (per the project's README: "answer text + `_provenance` envelope + optional `sources[]` array") is not fully documented down to the field level — `normalizeAskQuestionResult` is written defensively against the most likely shape (an MCP `structuredContent` object with `answer`/`sources`, falling back to parsing a JSON text block, falling back to plain text). **This is expected to need a small adjustment during Task 14's real end-to-end run** — if so, only `normalizeCitation`'s field lookups need to change, not the surrounding orchestration.

**Files:**
- Create: `scripts/notebookLmClient.ts`
- Create: `scripts/__tests__/notebookLmClient.test.ts`

- [ ] **Step 1: Write the failing tests for `normalizeAskQuestionResult`**

```ts
// scripts/__tests__/notebookLmClient.test.ts
import { describe, expect, it } from "vitest";
import { normalizeAskQuestionResult } from "../notebookLmClient";

describe("normalizeAskQuestionResult", () => {
  it("reads answer and sources from structuredContent when present", () => {
    const result = normalizeAskQuestionResult({
      structuredContent: {
        answer: "Type A dissections involve the ascending aorta.",
        sources: [{ title: "Sabiston Ch. 4", snippet: "Ascending aorta involvement defines Type A." }],
      },
    });

    expect(result.content).toBe("Type A dissections involve the ascending aorta.");
    expect(result.citations).toEqual([
      { text: "Ascending aorta involvement defines Type A.", sourceTitle: "Sabiston Ch. 4" },
    ]);
  });

  it("parses a JSON-encoded text block when structuredContent is absent", () => {
    const result = normalizeAskQuestionResult({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            answer: "Type B dissections spare the ascending aorta.",
            sources: ["Sabiston Ch. 4"],
          }),
        },
      ],
    });

    expect(result.content).toBe("Type B dissections spare the ascending aorta.");
    expect(result.citations).toEqual([{ text: "Sabiston Ch. 4", sourceTitle: "" }]);
  });

  it("falls back to plain text with no citations when the text block isn't JSON", () => {
    const result = normalizeAskQuestionResult({
      content: [{ type: "text", text: "Type A dissections involve the ascending aorta." }],
    });

    expect(result.content).toBe("Type A dissections involve the ascending aorta.");
    expect(result.citations).toEqual([]);
  });

  it("throws when there is no usable content", () => {
    expect(() => normalizeAskQuestionResult({})).toThrow("no usable text or structured content");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/__tests__/notebookLmClient.test.ts`
Expected: FAIL — module `../notebookLmClient` doesn't exist yet.

- [ ] **Step 3: Implement `notebookLmClient.ts`**

```ts
// scripts/notebookLmClient.ts
import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Citation } from "../src/types/database";

export interface AskQuestionResult {
  content: string;
  citations: Citation[];
}

interface RawToolResult {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
}

function normalizeCitation(raw: unknown): Citation {
  if (typeof raw === "string") {
    return { text: raw, sourceTitle: "" };
  }
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const text = typeof r.snippet === "string" ? r.snippet : typeof r.text === "string" ? r.text : "";
    const sourceTitle =
      typeof r.title === "string" ? r.title : typeof r.sourceTitle === "string" ? r.sourceTitle : "";
    return { text, sourceTitle };
  }
  return { text: "", sourceTitle: "" };
}

export function normalizeAskQuestionResult(raw: RawToolResult): AskQuestionResult {
  const structured = raw.structuredContent;

  if (structured && typeof structured.answer === "string") {
    const rawSources = Array.isArray(structured.sources) ? structured.sources : [];
    return {
      content: structured.answer,
      citations: rawSources.map(normalizeCitation),
    };
  }

  const textBlock = (raw.content ?? []).find((block) => block.type === "text" && typeof block.text === "string");
  if (!textBlock?.text) {
    throw new Error("ask_question returned no usable text or structured content");
  }

  try {
    const parsed = JSON.parse(textBlock.text) as { answer?: string; sources?: unknown[] };
    if (typeof parsed.answer === "string") {
      const rawSources = Array.isArray(parsed.sources) ? parsed.sources : [];
      return { content: parsed.answer, citations: rawSources.map(normalizeCitation) };
    }
  } catch {
    // Not JSON — fall through to plain text below.
  }

  return { content: textBlock.text, citations: [] };
}

export async function askNotebook(notebookId: string, question: string): Promise<AskQuestionResult> {
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["notebooklm-mcp@latest"],
  });

  const client = new Client({ name: "cardiac-mastery-os-sync", version: "1.0.0" });
  await client.connect(transport);

  try {
    await client.callTool({
      name: "select_notebook",
      arguments: { id: notebookId },
    });

    const result = await client.callTool({
      name: "ask_question",
      arguments: { question, source_format: "json" },
    });

    return normalizeAskQuestionResult(result as RawToolResult);
  } finally {
    await client.close();
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/__tests__/notebookLmClient.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/notebookLmClient.ts scripts/__tests__/notebookLmClient.test.ts
git commit -m "Add notebooklm-mcp client wrapper with defensive response normalization"
```

---

## Task 10: `sync-notebook` script

No automated test — this orchestrates a real subprocess (browser automation against NotebookLM) and is verified manually in Task 14.

**Files:**
- Create: `scripts/sync-notebook.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the script**

```ts
// scripts/sync-notebook.ts
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { getNotebookId } from "./notebook-domains";
import { askNotebook } from "./notebookLmClient";
import { upsertNotebookKnowledge } from "../src/services/db/notebookKnowledge";

function synthesisPrompt(domain: string): string {
  return `Provide a comprehensive teaching synthesis on ${domain.replace(/_/g, " ")} for a cardiac surgery resident studying for oral boards. Cover key concepts, areas of clinical controversy, and board-relevant nuances. Cite a specific source for each major claim.`;
}

async function main() {
  const domain = process.argv[2];
  if (!domain) {
    console.error("Usage: npm run sync-notebook -- <domain>");
    process.exit(1);
  }

  const notebookId = getNotebookId(domain);
  console.log(`Syncing domain "${domain}" from notebook ${notebookId}...`);

  const { content, citations } = await askNotebook(notebookId, synthesisPrompt(domain));
  await upsertNotebookKnowledge(domain, content, citations);

  console.log(`Synced "${domain}": ${content.length} chars, ${citations.length} citations.`);
}

main().catch((error) => {
  console.error("sync-notebook failed:", error);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script entry**

In `package.json`, add to `"scripts"`:

```json
"sync-notebook": "tsx scripts/sync-notebook.ts",
```

- [ ] **Step 3: Verify it runs and fails correctly without configuration (expected at this point)**

Run: `npm run sync-notebook -- aortic_surgery`
Expected: fails with `Domain "aortic_surgery" has no notebooklm-mcp library id configured yet.` — this confirms the script wires up correctly end-to-end up to the point where real configuration (Task 14) is required.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-notebook.ts package.json
git commit -m "Add sync-notebook script"
```

---

## Task 11: `train-from-notebook` script

No automated test — verified manually in Task 14 alongside `sync-notebook`.

**Files:**
- Create: `scripts/train-from-notebook.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the script**

```ts
// scripts/train-from-notebook.ts
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { getNotebookKnowledge } from "../src/services/db/notebookKnowledge";
import { createSource } from "../src/services/db/sources";
import { generateSession } from "../src/services/ai/generateSession";
import { createSessionWithQuestions } from "../src/services/db/sessions";

async function main() {
  const domain = process.argv[2];
  if (!domain) {
    console.error("Usage: npm run train-from-notebook -- <domain>");
    process.exit(1);
  }

  const knowledge = await getNotebookKnowledge(domain);
  if (!knowledge) {
    console.error(`No synced content for domain "${domain}". Run "npm run sync-notebook -- ${domain}" first.`);
    process.exit(1);
  }

  const source = await createSource(knowledge.content, "notebook_sync", {
    domain,
    citations: knowledge.citations,
  });
  const generated = await generateSession(source);
  const { session } = await createSessionWithQuestions(source.id, generated.topic, generated.questions);

  console.log(`Training session ready: http://localhost:3000/training/${session.id}`);
}

main().catch((error) => {
  console.error("train-from-notebook failed:", error);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script entry**

In `package.json`, add to `"scripts"`:

```json
"train-from-notebook": "tsx scripts/train-from-notebook.ts",
```

- [ ] **Step 3: Verify it runs and fails correctly without synced content (expected at this point)**

Run: `npm run train-from-notebook -- aortic_surgery`
Expected: fails with `No synced content for domain "aortic_surgery". Run "npm run sync-notebook -- aortic_surgery" first.`

- [ ] **Step 4: Commit**

```bash
git add scripts/train-from-notebook.ts package.json
git commit -m "Add train-from-notebook script"
```

---

## Task 12: Surface citations from `/api/sessions/[sessionId]`

**Files:**
- Modify: `src/app/api/sessions/[sessionId]/route.ts`
- Create: `src/app/api/sessions/[sessionId]/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/api/sessions/[sessionId]/__tests__/route.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run "src/app/api/sessions/[sessionId]/__tests__/route.test.ts"`
Expected: FAIL — `body.citations` is `undefined`, not `[]`.

- [ ] **Step 3: Implement the change**

Replace the whole file `src/app/api/sessions/[sessionId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionWithQuestions } from "@/services/db/sessions";
import { getSourceById } from "@/services/db/sources";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const result = await getSessionWithQuestions(sessionId);
  if (!result) {
    return NextResponse.json({ error: `Session ${sessionId} not found` }, { status: 404 });
  }

  const source = await getSourceById(result.session.sourceId);

  return NextResponse.json({
    ...result,
    citations: source?.citations ?? [],
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run "src/app/api/sessions/[sessionId]/__tests__/route.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all tests pass (31 total).

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/sessions/[sessionId]/route.ts" "src/app/api/sessions/[sessionId]/__tests__/route.test.ts"
git commit -m "Include source citations in the session API response"
```

---

## Task 13: Render citations during training

No automated test — this codebase tests services/API routes, not pages (established pattern from Plan C). Verified manually here and again end-to-end in Task 14.

**Files:**
- Modify: `src/app/training/[sessionId]/page.tsx`

- [ ] **Step 1: Add citations state and fetch it**

In `src/app/training/[sessionId]/page.tsx`, change the type import:

```ts
import type { Citation, Evaluation, Question, QuestionCategory, TrainingSession } from "@/types/database";
```

Add state alongside the existing `session`/`questions` state:

```ts
  const [citations, setCitations] = useState<Citation[]>([]);
```

In the `load()` function, where `setSession(data.session); setQuestions(data.questions);` currently is, add:

```ts
          setSession(data.session);
          setQuestions(data.questions);
          setCitations(data.citations ?? []);
```

- [ ] **Step 2: Render a citations panel when present**

In the active-question return block (the `return (<div className="space-y-6">...` near the bottom), add a collapsible panel right after the "Question X of Y" paragraph and before the question `<Card>`:

```tsx
      <p className="text-sm text-muted-foreground">
        Question {currentIndex + 1} of {questions.length}
      </p>

      {citations.length > 0 && (
        <details className="glass-panel rounded-lg p-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Sources ({citations.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {citations.map((citation, index) => (
              <li key={index} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{citation.sourceTitle || "Source"}:</span>{" "}
                {citation.text}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Card className="glass-panel">
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Start the dev server (`npm run dev`), open any existing training session (created via the normal Capture flow), and confirm the page renders exactly as before with no citations panel (since `citations` will be `[]` for reflection/case_note/article_summary/insight sources). The notebook_sync case is verified end-to-end in Task 14, once real citations exist.

- [ ] **Step 5: Commit**

```bash
git add "src/app/training/[sessionId]/page.tsx"
git commit -m "Render citations panel during training when the source has them"
```

---

## Task 14: End-to-end verification with a real notebook

**Human checkpoint:** every step here requires Thomas's own Google account, browser, and NotebookLM notebooks. A subagent cannot complete this task.

- [ ] **Step 1: One-time `notebooklm-mcp` auth**

If not already authenticated (e.g. via a personal Claude Desktop/Code MCP setup), run:

```bash
npx notebooklm-mcp@latest
```

and complete the one-time interactive Google login when the browser window opens. Auth persists locally afterward — this is a one-time step, not part of the regular sync flow.

- [ ] **Step 2: Register one real domain notebook**

Using `notebooklm-mcp`'s tools (via Claude Desktop/Code if already configured there, or any MCP-capable client), call `add_notebook` with the share URL of one existing domain notebook (e.g. Aortic Surgery), or `list_notebooks` if it's already registered. Note the returned library `id`.

- [ ] **Step 3: Fill in the config**

In `scripts/notebook-domains.ts`, replace the placeholder for that one domain (e.g. `aortic_surgery`) with the real id from Step 2. Leave the rest as placeholders for now — they can be filled in later the same way, one line each, with no code changes.

- [ ] **Step 4: Run sync**

```bash
npm run sync-notebook -- aortic_surgery
```

Expected: prints `Synced "aortic_surgery": N chars, M citations.` If it errors, check the error message:
- MCP/browser-automation error → re-run; this integration is expected to be occasionally flaky per the design spec.
- Citation/content shape looks wrong (e.g. 0 citations when sources clearly exist, or garbled content) → `normalizeAskQuestionResult` in `scripts/notebookLmClient.ts` (Task 9) needs its field-name assumptions adjusted to match what this real run actually returned. Add a temporary `console.log(JSON.stringify(result))` right before the `normalizeAskQuestionResult` call in `askNotebook` to inspect the real shape, fix the field lookups, remove the log, and re-run.

- [ ] **Step 5: Run train-from-notebook**

```bash
npm run train-from-notebook -- aortic_surgery
```

Expected: prints a `http://localhost:3000/training/<sessionId>` URL.

- [ ] **Step 6: Complete the session in the browser**

With the dev server running (`npm run dev`), open the printed URL. Confirm:
- The "Sources" panel appears and lists real citations.
- Questions read naturally as being about the synced domain content (not generic).
- Answering a question and submitting still evaluates normally and updates mastery tracking, exactly as with a regular captured source.

- [ ] **Step 7: Commit the filled-in config**

```bash
git add scripts/notebook-domains.ts
git commit -m "Configure aortic_surgery domain notebook mapping"
```

This is a private repo, so committing the real notebooklm-mcp library id is fine — it's not a secret, just an identifier in Thomas's own local tool's library.

