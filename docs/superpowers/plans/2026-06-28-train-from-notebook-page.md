# Train from Notebook Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Thomas generate a training session from already-synced NotebookLM content through an in-app page, with no terminal required.

**Architecture:** A Server Component page (`/train-notebook`) lists synced domains via a new `listNotebookKnowledge()` DB function, handing them to a Client Component form (domain pills + optional free-text topic). Submit posts to a new `POST /api/train-notebook` route, which reads the cached `notebook_knowledge` row, optionally prepends a `Focus area: {topic}` line to its content, and runs that content through the existing `createSource` → `generateSession` → `createSessionWithQuestions` pipeline unchanged — identical to what `scripts/train-from-notebook.ts` already does from the CLI.

**Tech Stack:** Next.js 16 App Router (Server + Client Components), Supabase, Vitest, existing `@/components/ui` primitives (Button, Card, Textarea), `@/components/empty-state`.

**Reference spec:** `docs/superpowers/specs/2026-06-28-train-from-notebook-page-design.md`

**Process note:** Building directly on `main` (confirmed with Thomas 2026-06-28) — no dedicated worktree for this one, matching how the prior NotebookLM integration actually landed despite its plan saying otherwise. Push after every commit, per established project convention.

**Note on file count vs. spec:** the spec's "Files touched" list shows one new page file (`page.tsx`) containing both the server fetch and the client form. That's not achievable as a single file in the App Router: the page must be an `async` Server Component (it calls `listNotebookKnowledge()`, which talks to Supabase directly) and the form must be a `"use client"` component (it uses `useState`/`useRouter`) — a file can't be both. This plan therefore adds one extra file, `src/app/train-notebook/train-notebook-form.tsx`, holding the Client Component. Everything else matches the spec exactly.

---

### Task 1: `listNotebookKnowledge()` in the notebook knowledge service

**Files:**
- Modify: `src/services/db/notebookKnowledge.ts`
- Test: `src/services/db/__tests__/notebookKnowledge.test.ts`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to the bottom of `src/services/db/__tests__/notebookKnowledge.test.ts` (after the existing `describe("notebookKnowledge db service", ...)` block), and add `listNotebookKnowledge` to the existing import on line 3:

```ts
import { getNotebookKnowledge, listNotebookKnowledge, upsertNotebookKnowledge } from "../notebookKnowledge";
```

```ts
describe("listNotebookKnowledge", () => {
  it("includes a freshly upserted domain in the full list", async () => {
    const citations = [{ text: "Class A dissections involve the ascending aorta.", sourceTitle: "Sabiston Ch. 4" }];
    await upsertNotebookKnowledge(TEST_DOMAIN, "Synthesis content.", citations);

    const all = await listNotebookKnowledge();
    const found = all.find((row) => row.domain === TEST_DOMAIN);

    expect(found).toBeDefined();
    expect(found?.content).toBe("Synthesis content.");
    expect(found?.citations).toEqual(citations);
  });
});
```

This reuses the existing `TEST_DOMAIN` constant and the file's existing `afterEach` cleanup — no new cleanup needed. It deliberately checks for the test row by `find()` rather than asserting list length, because the real Supabase project already has 7 real domain rows in `notebook_knowledge` (this is the same live dev database used elsewhere in this codebase — don't assert exact counts against it).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- notebookKnowledge`
Expected: FAIL — `listNotebookKnowledge is not a function` (or similar import error)

- [ ] **Step 3: Write minimal implementation**

Add to `src/services/db/notebookKnowledge.ts` (after `upsertNotebookKnowledge`, before `getNotebookKnowledge`, or after it — order doesn't matter):

```ts
export async function listNotebookKnowledge(): Promise<NotebookKnowledge[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("notebook_knowledge").select().order("domain", { ascending: true });

  if (error) throw new Error(`Failed to list notebook knowledge: ${error.message}`);
  return (data as NotebookKnowledgeRow[]).map(toNotebookKnowledge);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- notebookKnowledge`
Expected: PASS (4 tests: the 3 existing ones plus the new one)

- [ ] **Step 5: Commit and push**

```bash
git add src/services/db/notebookKnowledge.ts src/services/db/__tests__/notebookKnowledge.test.ts
git commit -m "Add listNotebookKnowledge for the in-app Train from Notebook page"
git push
```

---

### Task 2: `POST /api/train-notebook` route

**Files:**
- Create: `src/app/api/train-notebook/route.ts`
- Test: `src/app/api/train-notebook/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/train-notebook/__tests__/route.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { getSessionWithQuestions } from "@/services/db/sessions";
import { getSourceById } from "@/services/db/sources";
import { upsertNotebookKnowledge } from "@/services/db/notebookKnowledge";

vi.mock("@/services/ai/generateSession", () => ({
  generateSession: vi.fn().mockResolvedValue({
    topic: "Aortic Dissection Classification",
    questions: [
      { category: "pattern_recognition", prompt: "What distinguishes a Class A from a Class B dissection?" },
    ],
  }),
}));

import { POST } from "../route";

const TEST_DOMAIN = "__test__ aortic_surgery";
const createdSourceIds: string[] = [];

afterEach(async () => {
  const supabase = getSupabaseClient();
  await supabase.from("notebook_knowledge").delete().eq("domain", TEST_DOMAIN);
  if (createdSourceIds.length > 0) {
    await supabase.from("training_sources").delete().in("id", createdSourceIds);
    createdSourceIds.length = 0;
  }
});

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/train-notebook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/train-notebook", () => {
  it("creates a session from synced notebook content with no topic prefix when topic is omitted", async () => {
    await upsertNotebookKnowledge(TEST_DOMAIN, "Aortic dissections are classified by the Stanford system.", []);

    const res = await POST(makeRequest({ domain: TEST_DOMAIN }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionId).toBeDefined();

    const sessionData = await getSessionWithQuestions(body.sessionId);
    if (sessionData) createdSourceIds.push(sessionData.session.sourceId);

    const source = await getSourceById(sessionData!.session.sourceId);
    expect(source?.content).toBe("Aortic dissections are classified by the Stanford system.");
    expect(source?.domain).toBe(TEST_DOMAIN);
  });

  it("prepends the topic as a focus-area hint when provided", async () => {
    await upsertNotebookKnowledge(TEST_DOMAIN, "Aortic dissections are classified by the Stanford system.", []);

    const res = await POST(makeRequest({ domain: TEST_DOMAIN, topic: "Stanford classification" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    const sessionData = await getSessionWithQuestions(body.sessionId);
    if (sessionData) createdSourceIds.push(sessionData.session.sourceId);

    const source = await getSourceById(sessionData!.session.sourceId);
    expect(source?.content).toBe(
      "Focus area: Stanford classification\n\nAortic dissections are classified by the Stanford system."
    );
  });

  it("returns 400 when domain is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 when the domain has no synced content", async () => {
    const res = await POST(makeRequest({ domain: "__test__ does_not_exist" }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api/train-notebook`
Expected: FAIL — cannot find module `../route` (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `src/app/api/train-notebook/route.ts`:

```ts
import { NextResponse } from "next/server";
import { generateSession } from "@/services/ai/generateSession";
import { getNotebookKnowledge } from "@/services/db/notebookKnowledge";
import { createSessionWithQuestions } from "@/services/db/sessions";
import { createSource } from "@/services/db/sources";

export async function POST(request: Request) {
  const body = await request.json();
  const { domain, topic } = body as { domain?: unknown; topic?: unknown };

  if (typeof domain !== "string" || domain.trim().length === 0) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const trimmedTopic = typeof topic === "string" ? topic.trim() : "";

  try {
    const knowledge = await getNotebookKnowledge(domain);
    if (!knowledge) {
      return NextResponse.json({ error: `No synced content for domain "${domain}"` }, { status: 400 });
    }

    const content = trimmedTopic ? `Focus area: ${trimmedTopic}\n\n${knowledge.content}` : knowledge.content;
    const source = await createSource(content, "notebook_sync", { domain, citations: knowledge.citations });
    const generated = await generateSession(source);
    const { session } = await createSessionWithQuestions(source.id, generated.topic, generated.questions);

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- api/train-notebook`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit and push**

```bash
git add src/app/api/train-notebook/route.ts src/app/api/train-notebook/__tests__/route.test.ts
git commit -m "Add POST /api/train-notebook route"
git push
```

---

### Task 3: `/train-notebook` page (Server Component + Client form)

**Files:**
- Create: `src/app/train-notebook/page.tsx`
- Create: `src/app/train-notebook/train-notebook-form.tsx`

No automated test for this task — pages aren't unit-tested in this codebase (see Task 4's manual verification for how this gets checked).

- [ ] **Step 1: Create the Client Component form**

Create `src/app/train-notebook/train-notebook-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const DOMAIN_LABELS: Record<string, string> = {
  foundations: "Foundations",
  aortic_surgery: "Aortic Surgery",
  valve_surgery: "Valve Surgery",
  coronary_surgery: "Coronary Surgery",
  heart_failure_lvad_transplant: "Heart Failure / LVAD / Transplant",
  critical_care_ecmo_perfusion: "Critical Care / ECMO / Perfusion",
  cardiac_oncology: "Cardiac Oncology",
};

interface TrainNotebookFormProps {
  domains: string[];
}

export function TrainNotebookForm({ domains }: TrainNotebookFormProps) {
  const router = useRouter();

  const [domain, setDomain] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = domain !== null && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !domain) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/train-notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, topic: topic.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate training session");
      router.push(`/training/${data.sessionId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Card className="glass-panel">
      <CardHeader>
        <h1 className="text-2xl font-medium text-foreground">Train from Notebook</h1>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {domains.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDomain(value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                domain === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {DOMAIN_LABELS[value] ?? value}
            </button>
          ))}
        </div>
        <Textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Optional: focus on a specific topic within this domain..."
          className="min-h-24"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          {submitting ? "Generating…" : "Generate Training Session"}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create the Server Component page**

Create `src/app/train-notebook/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { listNotebookKnowledge } from "@/services/db/notebookKnowledge";
import { TrainNotebookForm } from "./train-notebook-form";

export default async function TrainNotebookPage() {
  const knowledge = await listNotebookKnowledge();

  if (knowledge.length === 0) {
    return (
      <EmptyState
        title="No notebooks synced yet"
        message="Run npm run sync-notebook -- <domain> from your terminal to pull content from NotebookLM."
        ctaHref="/"
        ctaLabel="Back to Home"
      />
    );
  }

  return <TrainNotebookForm domains={knowledge.map((row) => row.domain)} />;
}
```

- [ ] **Step 3: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: all existing tests still pass (no new tests added in this task)

- [ ] **Step 4: Commit and push**

```bash
git add src/app/train-notebook/page.tsx src/app/train-notebook/train-notebook-form.tsx
git commit -m "Add /train-notebook page"
git push
```

---

### Task 4: Nav link and manual verification

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: Add the nav link**

In `src/components/nav.tsx`, change the `links` array to insert the new link between Capture and Training:

```ts
const links = [
  { href: "/", label: "Home" },
  { href: "/capture", label: "Capture" },
  { href: "/train-notebook", label: "Train from Notebook" },
  { href: "/training", label: "Training" },
  { href: "/mastery", label: "Mastery" },
];
```

- [ ] **Step 2: Run the full test suite and lint**

Run: `npm test`
Expected: all tests pass (same count as before, just the nav file changed — no test covers `nav.tsx` directly)

Run: `npm run lint`
Expected: no errors

- [ ] **Step 3: Commit and push**

```bash
git add src/components/nav.tsx
git commit -m "Add Train from Notebook link to nav"
git push
```

- [ ] **Step 4: Manual verification (no automated test covers pages in this codebase)**

```bash
npm run dev
```

Then in a browser:
1. Go to `http://localhost:3000/train-notebook`. Confirm the domain pills render with the 7 real synced domains (Foundations, Aortic Surgery, Valve Surgery, Coronary Surgery, Heart Failure / LVAD / Transplant, Critical Care / ECMO / Perfusion, Cardiac Oncology) — Thomas's real Supabase data, not test fixtures.
2. Select a domain, leave the topic blank, click "Generate Training Session." Confirm it redirects to `/training/<id>` and the session has questions.
3. On that session page, confirm the "Sources" citations panel renders (it should, since the source carries the domain's real citations through unchanged).
4. Go back to `/train-notebook`, select a domain, type a topic (e.g. "valve sizing"), submit. Confirm it generates a session whose questions are noticeably focused on that topic.
5. Confirm the nav shows "Train from Notebook" between Capture and Training, and it's a working link from every page.

If any of these don't match, stop and report back rather than pushing further commits — these are real production data, not test data.

---

## Self-review notes (for whoever runs this plan)

- **Spec coverage:** all 4 "New pieces" from the spec are covered (Task 1: `listNotebookKnowledge`; Task 2: API route; Task 3: page + form; Task 4: nav link). Error handling section of the spec is covered by Task 2's 400-path tests. Testing section of the spec is covered by Task 1 and Task 2's tests plus Task 4's manual page verification, matching the spec's explicit "pages aren't unit-tested" convention.
- **Deviation from spec:** one extra file (`train-notebook-form.tsx`) beyond the spec's file list, for the Server/Client Component split reason explained in the plan header. Functionality and props match the spec exactly.
