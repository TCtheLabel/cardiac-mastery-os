# Cardiac Mastery OS — Plan B: Capture → Generate → Train → Evaluate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full deliberate-practice loop end-to-end — capture a reflection/case note → AI generates a training session → user answers questions one at a time → AI evaluates each answer → mastery tracking updates — producing a usable product for the first time.

**Architecture:** Two new AI services (`src/services/ai/generateSession.ts`, `src/services/ai/evaluateResponse.ts`) wrap OpenAI's GPT-4o with `response_format: { type: "json_schema" }` for structured, parseable output. Four new API routes orchestrate the db services from Plan A with these AI services. Three new pages (`/capture`, `/training/[sessionId]`, `/training`) provide the UI, built as Client Components where interactivity is needed and Server Components where data is read-only.

**Tech Stack:** Next.js 16 (App Router, TypeScript, `src/` dir), shadcn/ui (Textarea, Card, Badge, Separator), `openai` npm package (GPT-4o, JSON schema structured outputs), Supabase Cloud (existing `services/db/*`), Vitest (OpenAI mocked, Supabase Cloud real).

**Spec:** `docs/superpowers/specs/2026-06-08-capture-train-evaluate-design.md`

---

## Before You Start

- Run all commands from the project root: `/Users/thomas/Desktop/Next Level/Projects/Cardiac Mastery OS`
- `.env` already contains `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — Vitest's `vitest.config.ts` loads these via `loadEnv`, and Next.js loads `.env`/`.env.local` automatically. No new env setup needed.
- Plan A is complete: `services/db/{sources,sessions,responses,evaluations,mastery}.ts` exist and are tested. This plan builds on top of them.
- **Important — Next.js 16 breaking change:** dynamic route `params` (and in some configurations `searchParams`) are `Promise`s, not plain objects. In Server Components, `await params`. In Client Component pages, use React's `use(params)`. This plan's code already accounts for this — follow it exactly, don't "fix" it back to the old synchronous pattern from training data.

---

### Task 1: OpenAI client singleton

**Files:**
- Create: `src/lib/openai/client.ts`
- Modify: `package.json` (via `npm install`)

- [ ] **Step 1: Install the OpenAI SDK**

```bash
npm install openai
```

Expected: `openai` (v6.x) added to `package.json` dependencies and `package-lock.json`.

- [ ] **Step 2: Create the client singleton**

Create `src/lib/openai/client.ts`:

```ts
import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (client) return client;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY environment variable");
  }

  client = new OpenAI({ apiKey });

  return client;
}
```

This mirrors the pattern in `src/lib/supabase/server.ts` (singleton, throws on missing env var).

- [ ] **Step 3: Verify the project still builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit and push**

```bash
git add package.json package-lock.json src/lib/openai/client.ts
git commit -m "Add OpenAI client singleton"
git push
```

---

### Task 2: AI service — generateSession

**Files:**
- Create: `src/services/ai/generateSession.ts`
- Test: `src/services/ai/__tests__/generateSession.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/ai/__tests__/generateSession.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { TrainingSource } from "@/types/database";

const mockCreate = vi.fn();

vi.mock("@/lib/openai/client", () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

import { generateSession } from "../generateSession";

describe("generateSession", () => {
  it("parses the OpenAI response into a topic and questions", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              topic: "Post-op Tamponade Management",
              questions: [
                {
                  category: "complication_management",
                  prompt: "What were the early warning signs of tamponade in this case?",
                },
                {
                  category: "decision_making",
                  prompt: "Why was bedside re-exploration chosen over imaging first?",
                },
              ],
            }),
          },
        },
      ],
    });

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Managed a post-op tamponade overnight.",
      sourceType: "case_note",
      createdAt: new Date().toISOString(),
    };

    const result = await generateSession(source);

    expect(result.topic).toBe("Post-op Tamponade Management");
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].category).toBe("complication_management");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        response_format: expect.objectContaining({ type: "json_schema" }),
      })
    );
  });

  it("throws if OpenAI returns an empty response", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Reviewed an aortic dissection paper.",
      sourceType: "article_summary",
      createdAt: new Date().toISOString(),
    };

    await expect(generateSession(source)).rejects.toThrow("empty response");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/ai/__tests__/generateSession.test.ts
```

Expected: FAIL — `Cannot find module '../generateSession'`.

- [ ] **Step 3: Implement generateSession**

Create `src/services/ai/generateSession.ts`:

```ts
import { getOpenAIClient } from "@/lib/openai/client";
import type { QuestionCategory, TrainingSource } from "@/types/database";

export interface GeneratedQuestion {
  category: QuestionCategory;
  prompt: string;
}

export interface GeneratedSession {
  topic: string;
  questions: GeneratedQuestion[];
}

const QUESTION_CATEGORIES: QuestionCategory[] = [
  "decision_making",
  "operative_planning",
  "complication_management",
  "pattern_recognition",
  "reflection",
];

const SYSTEM_PROMPT = `You are an expert cardiac surgery educator creating deliberate-practice training questions for a surgical resident.

Read the resident's submitted content (a reflection, case note, article summary, or insight). Then:

1. Identify a single, specific topic that captures the clinical focus of this content. This will be used as the session title (e.g., "Post-op Tamponade Management", "Aortic Valve Replacement Sizing").
2. Generate 3 to 6 training questions that test the resident's clinical judgment related to this content. Distribute questions across these categories as relevant to the content — not every category needs to be used, and do not force categories that don't fit:
   - decision_making: Why was a particular choice made, and what alternatives existed?
   - operative_planning: How would the operative approach be planned or modified?
   - complication_management: How should a related complication be recognized and managed?
   - pattern_recognition: What clinical or imaging pattern is significant here?
   - reflection: What broader principle or lesson applies?

Each question prompt must be specific to the submitted content, not generic. Write prompts as direct questions a senior attending might ask during a case discussion.`;

export async function generateSession(source: TrainingSource): Promise<GeneratedSession> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Source type: ${source.sourceType}\n\nContent:\n${source.content}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "training_session",
        strict: true,
        schema: {
          type: "object",
          properties: {
            topic: { type: "string" },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string", enum: QUESTION_CATEGORIES },
                  prompt: { type: "string" },
                },
                required: ["category", "prompt"],
                additionalProperties: false,
              },
            },
          },
          required: ["topic", "questions"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response for generateSession");
  }

  return JSON.parse(content) as GeneratedSession;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/ai/__tests__/generateSession.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/services/ai/generateSession.ts src/services/ai/__tests__/generateSession.test.ts
git commit -m "Add generateSession AI service"
git push
```

---

### Task 3: AI service — evaluateResponse

**Files:**
- Create: `src/services/ai/evaluateResponse.ts`
- Test: `src/services/ai/__tests__/evaluateResponse.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/ai/__tests__/evaluateResponse.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Question, TrainingSource } from "@/types/database";

const mockCreate = vi.fn();

vi.mock("@/lib/openai/client", () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }),
}));

import { evaluateResponse } from "../evaluateResponse";

describe("evaluateResponse", () => {
  it("parses the OpenAI response into an evaluation result", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              strengths: "Correctly identified hypotension and rising CVP as key signs.",
              missedConcepts: "Did not mention echo as a confirmatory step\nDid not discuss output trends",
              improvements: "Mention bedside echo before deciding on re-exploration.",
              principle: "Tamponade is a clinical diagnosis; imaging should not delay treatment when classic signs are present.",
              qualitySignal: "adequate",
            }),
          },
        },
      ],
    });

    const question: Question = {
      id: "22222222-2222-2222-2222-222222222222",
      sessionId: "33333333-3333-3333-3333-333333333333",
      category: "complication_management",
      prompt: "What were the early warning signs of tamponade in this case?",
      orderIndex: 0,
    };

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Managed a post-op tamponade overnight.",
      sourceType: "case_note",
      createdAt: new Date().toISOString(),
    };

    const result = await evaluateResponse({
      responseText: "Hypotension and rising CVP were the early signs.",
      question,
      source,
    });

    expect(result.qualitySignal).toBe("adequate");
    expect(result.missedConcepts).toContain("echo");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        response_format: expect.objectContaining({ type: "json_schema" }),
      })
    );
  });

  it("throws if OpenAI returns an empty response", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

    const question: Question = {
      id: "22222222-2222-2222-2222-222222222222",
      sessionId: "33333333-3333-3333-3333-333333333333",
      category: "reflection",
      prompt: "What principle applies here?",
      orderIndex: 0,
    };

    const source: TrainingSource = {
      id: "11111111-1111-1111-1111-111111111111",
      content: "Reviewed an aortic dissection paper.",
      sourceType: "article_summary",
      createdAt: new Date().toISOString(),
    };

    await expect(
      evaluateResponse({ responseText: "Some answer.", question, source })
    ).rejects.toThrow("empty response");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/ai/__tests__/evaluateResponse.test.ts
```

Expected: FAIL — `Cannot find module '../evaluateResponse'`.

- [ ] **Step 3: Implement evaluateResponse**

Create `src/services/ai/evaluateResponse.ts`:

```ts
import { getOpenAIClient } from "@/lib/openai/client";
import type { Question, QualitySignal, TrainingSource } from "@/types/database";

export interface EvaluateResponseInput {
  responseText: string;
  question: Question;
  source: TrainingSource;
}

export interface EvaluationResult {
  strengths: string;
  missedConcepts: string;
  improvements: string;
  principle: string;
  qualitySignal: QualitySignal;
}

const QUALITY_SIGNALS: QualitySignal[] = ["strong", "adequate", "weak"];

const SYSTEM_PROMPT = `You are an expert cardiac surgery attending evaluating a resident's answer to a training question, in the context of the original case material they submitted.

Given the original source content, the question asked, and the resident's response, evaluate the response and return:

- strengths: What the response got right, specifically.
- missedConcepts: Important concepts, considerations, or risks the response missed. Write each distinct missed concept on its own line. If nothing important was missed, return an empty string.
- improvements: Concrete suggestions for how the response could be strengthened.
- principle: The single most important underlying surgical principle this question and response illustrate, stated concisely.
- qualitySignal: An overall judgment of the response's clinical reasoning quality:
  - "strong": thorough, accurate, anticipates complications
  - "adequate": correct core reasoning but missing depth or nuance
  - "weak": significant gaps, inaccuracies, or superficial reasoning`;

export async function evaluateResponse(input: EvaluateResponseInput): Promise<EvaluationResult> {
  const client = getOpenAIClient();
  const { responseText, question, source } = input;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Original source content:\n${source.content}\n\nQuestion (${question.category}):\n${question.prompt}\n\nResident's response:\n${responseText}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "response_evaluation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            strengths: { type: "string" },
            missedConcepts: { type: "string" },
            improvements: { type: "string" },
            principle: { type: "string" },
            qualitySignal: { type: "string", enum: QUALITY_SIGNALS },
          },
          required: ["strengths", "missedConcepts", "improvements", "principle", "qualitySignal"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response for evaluateResponse");
  }

  return JSON.parse(content) as EvaluationResult;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/ai/__tests__/evaluateResponse.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/services/ai/evaluateResponse.ts src/services/ai/__tests__/evaluateResponse.test.ts
git commit -m "Add evaluateResponse AI service"
git push
```

---

### Task 4: getQuestionById db helper

**Files:**
- Modify: `src/services/db/sessions.ts`
- Test: `src/services/db/__tests__/sessions.test.ts`

The `/api/evaluate-response` route (Task 8) needs to look up a question by id to fetch its session and source for AI context. Add this helper alongside the existing session/question functions.

- [ ] **Step 1: Write the failing test**

Add to `src/services/db/__tests__/sessions.test.ts` (inside the existing `describe` block, after the "lists sessions newest first" test). First update the import line:

```ts
import { createSessionWithQuestions, getSessionWithQuestions, getQuestionById, listSessions } from "../sessions";
```

Then add the new test:

```ts
  it("fetches a single question by id", async () => {
    const source = await createSource("Reviewed mitral valve repair technique.", "article_summary");
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/db/__tests__/sessions.test.ts
```

Expected: FAIL — `getQuestionById is not a function`.

- [ ] **Step 3: Implement getQuestionById**

In `src/services/db/sessions.ts`, add this function after `getSessionWithQuestions` (which ends around line 107):

```ts
export async function getQuestionById(id: string): Promise<Question | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("questions")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch question ${id}: ${error.message}`);
  return data ? toQuestion(data as QuestionRow) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/db/__tests__/sessions.test.ts
```

Expected: PASS — all four tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/services/db/sessions.ts src/services/db/__tests__/sessions.test.ts
git commit -m "Add getQuestionById db helper"
git push
```

---

### Task 5: POST /api/generate-session

**Files:**
- Create: `src/app/api/generate-session/route.ts`
- Test: `src/app/api/generate-session/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/generate-session/__tests__/route.test.ts`:

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

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/generate-session/__tests__/route.test.ts
```

Expected: FAIL — `Failed to resolve import "../route"`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/generate-session/route.ts`:

```ts
import { NextResponse } from "next/server";
import { generateSession } from "@/services/ai/generateSession";
import { createSessionWithQuestions } from "@/services/db/sessions";
import { createSource } from "@/services/db/sources";
import type { SourceType } from "@/types/database";

const VALID_SOURCE_TYPES: SourceType[] = ["reflection", "case_note", "article_summary", "insight"];

export async function POST(request: Request) {
  const body = await request.json();
  const { content, sourceType } = body as { content?: unknown; sourceType?: unknown };

  if (typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  if (typeof sourceType !== "string" || !VALID_SOURCE_TYPES.includes(sourceType as SourceType)) {
    return NextResponse.json(
      { error: `sourceType must be one of: ${VALID_SOURCE_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const source = await createSource(content, sourceType as SourceType);
    const generated = await generateSession(source);
    const { session } = await createSessionWithQuestions(source.id, generated.topic, generated.questions);

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/api/generate-session/__tests__/route.test.ts
```

Expected: PASS — all three tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/app/api/generate-session/
git commit -m "Add POST /api/generate-session route"
git push
```

---

### Task 6: shadcn Textarea + Card components

**Files:**
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/card.tsx`

- [ ] **Step 1: Add the components via shadcn CLI**

```bash
npx shadcn@latest add textarea card
```

Expected: `src/components/ui/textarea.tsx` and `src/components/ui/card.tsx` are created (following the same `base-nova` style as the existing `button.tsx`). The CLI may prompt to overwrite `globals.css` or `components.json` — answer no/skip if it offers to overwrite existing files; it should only add the new component files.

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/ui/textarea.tsx src/components/ui/card.tsx
git commit -m "Add shadcn Textarea and Card components"
git push
```

---

### Task 7: /capture page

**Files:**
- Create: `src/app/capture/page.tsx`

- [ ] **Step 1: Implement the Capture page**

Create `src/app/capture/page.tsx`:

```tsx
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { SourceType } from "@/types/database";

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "reflection", label: "Reflection" },
  { value: "case_note", label: "Case Note" },
  { value: "article_summary", label: "Article Summary" },
  { value: "insight", label: "Insight" },
];

const MIN_CONTENT_LENGTH = 20;

function CaptureForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusTopic = searchParams.get("topic");

  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = sourceType !== null && content.trim().length >= MIN_CONTENT_LENGTH && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !sourceType) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, sourceType }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate training session");
      }

      router.push(`/training/${data.sessionId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <h1 className="text-2xl font-medium text-foreground">Capture</h1>
        {focusTopic && <p className="text-sm text-muted-foreground">Focus: {focusTopic}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {SOURCE_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setSourceType(type.value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                sourceType === type.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your reflection, case note, article summary, or insight..."
          className="min-h-48"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {submitting ? "Generating…" : "Generate Training Session"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CapturePage() {
  return (
    <Suspense fallback={<div className="glass-panel p-10 text-center text-muted-foreground">Loading…</div>}>
      <CaptureForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual check with dev server**

```bash
npm run dev
```

Visit `http://localhost:3000/capture`. Confirm: pill buttons toggle, textarea accepts input, "Generate Training Session" button is disabled until a source type is selected and content is at least 20 characters. Stop the dev server (Ctrl+C) when done.

- [ ] **Step 4: Commit and push**

```bash
git add src/app/capture/page.tsx
git commit -m "Add /capture page"
git push
```

---

### Task 8: POST /api/evaluate-response

**Files:**
- Create: `src/app/api/evaluate-response/route.ts`
- Test: `src/app/api/evaluate-response/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/evaluate-response/__tests__/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { createSource } from "@/services/db/sources";
import { createSessionWithQuestions } from "@/services/db/sessions";

vi.mock("@/services/ai/evaluateResponse", () => ({
  evaluateResponse: vi.fn().mockResolvedValue({
    strengths: "Correctly identified hypotension and rising CVP.",
    missedConcepts: "Did not mention bedside echo",
    improvements: "Mention bedside echo before re-exploration.",
    principle: "Tamponade is a clinical diagnosis.",
    qualitySignal: "adequate",
  }),
}));

import { POST } from "../route";

async function cleanup() {
  const supabase = getSupabaseClient();
  await supabase
    .from("training_sources")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase
    .from("mastery_topics")
    .delete()
    .eq("topic", "Post-op Tamponade Management");
}

afterEach(async () => {
  await cleanup();
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/evaluate-response", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/evaluate-response", () => {
  it("creates a response, evaluation, and updates mastery", async () => {
    const source = await createSource("Managed a post-op tamponade overnight.", "case_note");
    const { questions } = await createSessionWithQuestions(source.id, "Post-op Tamponade Management", [
      { category: "complication_management", prompt: "What were the early warning signs?" },
    ]);

    const res = await POST(
      makeRequest({ questionId: questions[0].id, responseText: "Hypotension and rising CVP were the early signs." })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.qualitySignal).toBe("adequate");
    expect(body.principle).toBe("Tamponade is a clinical diagnosis.");

    const supabase = getSupabaseClient();
    const { data: masteryRow } = await supabase
      .from("mastery_topics")
      .select()
      .eq("topic", "Post-op Tamponade Management")
      .maybeSingle();

    expect(masteryRow).not.toBeNull();
    expect(masteryRow?.weak_areas).toContain("Did not mention bedside echo");
  });

  it("returns 400 when questionId is missing", async () => {
    const res = await POST(makeRequest({ responseText: "Some response." }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when responseText is missing", async () => {
    const res = await POST(makeRequest({ questionId: "00000000-0000-0000-0000-000000000001" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when questionId does not exist", async () => {
    const res = await POST(
      makeRequest({ questionId: "00000000-0000-0000-0000-000000000001", responseText: "Some response." })
    );
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/evaluate-response/__tests__/route.test.ts
```

Expected: FAIL — `Failed to resolve import "../route"`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/evaluate-response/route.ts`:

```ts
import { NextResponse } from "next/server";
import { evaluateResponse } from "@/services/ai/evaluateResponse";
import { createEvaluation } from "@/services/db/evaluations";
import { recordMasteryProgress } from "@/services/db/mastery";
import { createResponse } from "@/services/db/responses";
import { getQuestionById, getSessionWithQuestions } from "@/services/db/sessions";
import { getSourceById } from "@/services/db/sources";

function parseMissedConcepts(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { questionId, responseText } = body as { questionId?: unknown; responseText?: unknown };

  if (typeof questionId !== "string" || questionId.trim().length === 0) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }

  if (typeof responseText !== "string" || responseText.trim().length === 0) {
    return NextResponse.json({ error: "responseText is required" }, { status: 400 });
  }

  try {
    const question = await getQuestionById(questionId);
    if (!question) {
      return NextResponse.json({ error: `Question ${questionId} not found` }, { status: 400 });
    }

    const sessionData = await getSessionWithQuestions(question.sessionId);
    if (!sessionData) {
      return NextResponse.json({ error: `Session ${question.sessionId} not found` }, { status: 400 });
    }

    const source = await getSourceById(sessionData.session.sourceId);
    if (!source) {
      return NextResponse.json({ error: `Source ${sessionData.session.sourceId} not found` }, { status: 400 });
    }

    const response = await createResponse(questionId, responseText);
    const result = await evaluateResponse({ responseText, question, source });
    const evaluation = await createEvaluation(response.id, result);

    const topic = sessionData.session.topic ?? "Uncategorized";
    await recordMasteryProgress(topic, result.qualitySignal, parseMissedConcepts(result.missedConcepts));

    return NextResponse.json(evaluation);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/api/evaluate-response/__tests__/route.test.ts
```

Expected: PASS — all four tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/app/api/evaluate-response/
git commit -m "Add POST /api/evaluate-response route"
git push
```

---

### Task 9: shadcn Badge + Separator components

**Files:**
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/separator.tsx`

- [ ] **Step 1: Add the components via shadcn CLI**

```bash
npx shadcn@latest add badge separator
```

Expected: `src/components/ui/badge.tsx` and `src/components/ui/separator.tsx` are created.

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/ui/badge.tsx src/components/ui/separator.tsx
git commit -m "Add shadcn Badge and Separator components"
git push
```

---

### Task 10: GET /api/sessions/[sessionId]

**Files:**
- Create: `src/app/api/sessions/[sessionId]/route.ts`

No new test — this is a direct pass-through to `getSessionWithQuestions()`, already covered by Plan A's `sessions.test.ts` and Task 4's additions.

- [ ] **Step 1: Implement the route**

Create `src/app/api/sessions/[sessionId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSessionWithQuestions } from "@/services/db/sessions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const result = await getSessionWithQuestions(sessionId);

  if (!result) {
    return NextResponse.json({ error: `Session ${sessionId} not found` }, { status: 404 });
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add src/app/api/sessions/
git commit -m "Add GET /api/sessions/[sessionId] route"
git push
```

---

### Task 11: /training/[sessionId] page

**Files:**
- Create: `src/app/training/[sessionId]/page.tsx`

- [ ] **Step 1: Implement the training session page**

Create `src/app/training/[sessionId]/page.tsx`:

```tsx
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { Evaluation, Question, QuestionCategory, TrainingSession } from "@/types/database";

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  decision_making: "Decision Making",
  operative_planning: "Operative Planning",
  complication_management: "Complication Management",
  pattern_recognition: "Pattern Recognition",
  reflection: "Reflection",
};

function QualityBadge({ qualitySignal }: { qualitySignal: Evaluation["qualitySignal"] }) {
  if (qualitySignal === "strong") {
    return <Badge className="bg-accent text-accent-foreground">Strong</Badge>;
  }
  if (qualitySignal === "weak") {
    return <Badge variant="destructive">Weak</Badge>;
  }
  return <Badge variant="secondary">Adequate</Badge>;
}

export default function TrainingSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [responseText, setResponseText] = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load session");
        }

        if (!cancelled) {
          setSession(data.session);
          setQuestions(data.questions);
        }
      } catch (err) {
        if (!cancelled) setLoadError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function handleSubmit() {
    const question = questions[currentIndex];
    if (!question || responseText.trim().length === 0 || submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/evaluate-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, responseText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to evaluate response");
      }

      setEvaluation(data as Evaluation);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    setCurrentIndex((i) => i + 1);
    setResponseText("");
    setEvaluation(null);
    setSubmitError(null);
  }

  if (loading) {
    return <div className="glass-panel p-10 text-center text-muted-foreground">Loading…</div>;
  }

  if (loadError || !session) {
    return (
      <div className="glass-panel p-10 text-center">
        <p className="text-destructive">{loadError ?? "Session not found"}</p>
      </div>
    );
  }

  const isLastQuestion = currentIndex === questions.length - 1;
  const sessionComplete = isLastQuestion && evaluation !== null;
  const question = questions[currentIndex];

  if (sessionComplete) {
    return (
      <Card className="glass-panel">
        <CardContent className="space-y-4 p-10 text-center">
          <h1 className="text-2xl font-medium text-foreground">Session Complete</h1>
          <p className="text-muted-foreground">{session.topic}</p>
          <p className="text-sm text-muted-foreground">{questions.length} questions answered</p>
          <Link href="/capture">
            <Button className="mt-4">Capture Another</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Question {currentIndex + 1} of {questions.length}
      </p>

      <Card className="glass-panel">
        <CardHeader className="space-y-2">
          <Badge variant="outline">{CATEGORY_LABELS[question.category]}</Badge>
          <p className="text-lg text-foreground">{question.prompt}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Write your response..."
            className="min-h-32"
            disabled={evaluation !== null}
          />

          {submitError && <p className="text-sm text-destructive">{submitError}</p>}

          {!evaluation && (
            <Button
              onClick={handleSubmit}
              disabled={responseText.trim().length === 0 || submitting}
              className="w-full"
            >
              {submitting ? "Evaluating…" : "Submit Answer"}
            </Button>
          )}

          {evaluation && (
            <div className="space-y-4">
              <Separator />

              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">Evaluation</h2>
                <QualityBadge qualitySignal={evaluation.qualitySignal} />
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Strengths</h3>
                <p className="mt-1 text-foreground">{evaluation.strengths}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Missed Concepts</h3>
                <p className="mt-1 text-foreground">{evaluation.missedConcepts || "None"}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Improvements</h3>
                <p className="mt-1 text-foreground">{evaluation.improvements}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Principle</h3>
                <p className="mt-1 text-foreground">{evaluation.principle}</p>
              </div>

              {!isLastQuestion && (
                <Button onClick={handleNext} className="w-full">
                  Next Question →
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual check with dev server**

```bash
npm run dev
```

Use `/capture` to generate a real session (this calls the real OpenAI API), then confirm: questions display one at a time, submitting an answer shows the evaluation with a quality badge, "Next Question" advances, and the last question shows the completion card linking back to `/capture`. Stop the dev server (Ctrl+C) when done.

- [ ] **Step 4: Commit and push**

```bash
git add src/app/training/\[sessionId\]/page.tsx
git commit -m "Add /training/[sessionId] page"
git push
```

---

### Task 12: GET /api/mastery

**Files:**
- Create: `src/app/api/mastery/route.ts`
- Test: `src/app/api/mastery/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/mastery/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/mastery/__tests__/route.test.ts
```

Expected: FAIL — `Failed to resolve import "../route"`.

- [ ] **Step 3: Implement the route**

Create `src/app/api/mastery/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listMasteryTopics } from "@/services/db/mastery";

export async function GET() {
  const topics = await listMasteryTopics();
  return NextResponse.json(topics);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/api/mastery/__tests__/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit and push**

```bash
git add src/app/api/mastery/
git commit -m "Add GET /api/mastery route"
git push
```

---

### Task 13: /training history page

**Files:**
- Create: `src/app/training/page.tsx`

- [ ] **Step 1: Implement the training history page**

Create `src/app/training/page.tsx`:

```tsx
import Link from "next/link";
import { listSessions } from "@/services/db/sessions";

export default async function TrainingHistoryPage() {
  const sessions = await listSessions();

  if (sessions.length === 0) {
    return (
      <div className="glass-panel p-10 text-center">
        <h1 className="text-2xl font-medium text-foreground">Training History</h1>
        <p className="mt-3 text-muted-foreground">
          No training sessions yet. Head to Capture to generate your first one.
        </p>
        <Link href="/capture" className="mt-4 inline-block text-primary hover:underline">
          Go to Capture
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-foreground">Training History</h1>
      <ul className="space-y-3">
        {sessions.map((session) => (
          <li key={session.id} className="glass-panel p-4">
            <Link href={`/training/${session.id}`} className="flex items-center justify-between">
              <span className="text-foreground">{session.topic ?? "Untitled Session"}</span>
              <span className="text-sm text-muted-foreground">
                {new Date(session.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual check with dev server**

```bash
npm run dev
```

Visit `http://localhost:3000/training`. Confirm: lists past sessions (created during Task 11's manual check) newest first, each linking to `/training/[sessionId]`. Stop the dev server (Ctrl+C) when done.

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: every test file passes.

- [ ] **Step 5: Commit and push**

```bash
git add src/app/training/page.tsx
git commit -m "Add /training history page"
git push
```

---

## Definition of Done

- `/capture` accepts a reflection/case note/article summary/insight, generates a training session via OpenAI, and redirects to `/training/[sessionId]`.
- `/training/[sessionId]` walks through questions one at a time, evaluates each response via OpenAI, and shows a completion screen after the last question.
- `/training` lists past sessions newest first, with an empty state when none exist.
- `/api/mastery` returns mastery topics ordered by confidence ascending (used by Plan C).
- Mastery tracking updates automatically after each evaluated response.
- `npm test` passes (OpenAI mocked, Supabase Cloud real).
- All work is committed and pushed to `TCtheLabel/cardiac-mastery-os`.

## What's Next

Plan C ("Home + Mastery + Polish") builds the Home dashboard (lowest-confidence topic recommendation linking to `/capture?topic=<topic>`) and the Mastery page (consuming `/api/mastery`), plus empty/loading/error state polish across the app.
