# Cardiac Mastery OS — Plan C: Home + Mastery + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Home dashboard and Mastery page — the final two screens of the MVP — completing the user-facing surface of the deliberate-practice loop.

**Architecture:** Two Server Components (`/mastery`, and a rewritten `/`) read directly from the existing `listMasteryTopics()` and `listSessions()` service functions — no new API routes or service logic needed. Two new shared presentational components (`EmptyState`, `MasteryTopicCard`) are introduced and reused across Home, Mastery, and a small refactor of the existing Training History page (which currently inlines its own empty-state markup).

**Tech Stack:** Next.js 16 (App Router, Server Components, TypeScript), Tailwind, shadcn/ui (`Badge`), existing `services/db/{mastery,sessions}.ts` (Plan A).

**Spec:** `docs/superpowers/specs/2026-06-26-home-mastery-polish-design.md`

---

## Before You Start

- Run all commands from the project root: `/Users/thomas/Desktop/Next Level/Projects/Cardiac Mastery OS`
- Plans A and B are complete. `listMasteryTopics()` (`src/services/db/mastery.ts`) returns `MasteryTopic[]` sorted by `confidenceScore` ascending (weakest first). `listSessions()` (`src/services/db/sessions.ts`) returns `TrainingSession[]` sorted by `createdAt` descending (most recent first). Neither needs modification.
- `MasteryTopic` has fields `id`, `topic`, `confidenceScore` (number), `sessionCount` (number), `weakAreas` (`string[]`) — see `src/types/database.ts`.
- No new automated tests in this plan — these are presentational pages/components with no new business logic. Verification is `npx tsc --noEmit` plus a manual check in the dev server, matching how `/capture` and `/training/[sessionId]` were verified in Plan B.
- There is likely already real data in Supabase Cloud from Plan B's end-to-end verification (at least one session and one mastery topic). Manual checks below assume the populated state renders; the empty-state path is verified by code reading since it's a straightforward conditional render.

---

### Task 1: EmptyState shared component

**Files:**
- Create: `src/components/empty-state.tsx`

This extracts the empty-state markup currently inlined in `src/app/training/page.tsx` (lines 7-19) into a reusable component, so Home, Mastery, and Training History all render the same pattern.

- [ ] **Step 1: Implement the component**

Create `src/components/empty-state.tsx`:

```tsx
import Link from "next/link";

interface EmptyStateProps {
  title: string;
  message: string;
  ctaHref: string;
  ctaLabel: string;
}

export function EmptyState({ title, message, ctaHref, ctaLabel }: EmptyStateProps) {
  return (
    <div className="glass-panel p-10 text-center">
      <h1 className="text-2xl font-medium text-foreground">{title}</h1>
      <p className="mt-3 text-muted-foreground">{message}</p>
      <Link href={ctaHref} className="mt-4 inline-block text-primary hover:underline">
        {ctaLabel}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/empty-state.tsx
git commit -m "Add EmptyState shared component"
git push
```

---

### Task 2: MasteryTopicCard shared component

**Files:**
- Create: `src/components/mastery-topic-card.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/mastery-topic-card.tsx`:

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { MasteryTopic } from "@/types/database";

interface MasteryTopicCardProps {
  topic: MasteryTopic;
  href?: string;
  compact?: boolean;
}

export function MasteryTopicCard({ topic, href, compact = false }: MasteryTopicCardProps) {
  const content = (
    <div className="glass-panel space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{topic.topic}</span>
        <span className="text-sm text-muted-foreground">{Math.round(topic.confidenceScore)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${topic.confidenceScore}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        {topic.sessionCount} session{topic.sessionCount === 1 ? "" : "s"}
      </p>
      {!compact && topic.weakAreas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topic.weakAreas.map((area) => (
            <Badge key={area} variant="outline">
              {area}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-80">
        {content}
      </Link>
    );
  }

  return content;
}
```

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add src/components/mastery-topic-card.tsx
git commit -m "Add MasteryTopicCard shared component"
git push
```

---

### Task 3: Refactor Training History to use EmptyState

**Files:**
- Modify: `src/app/training/page.tsx`

- [ ] **Step 1: Replace the inline empty-state block**

In `src/app/training/page.tsx`, replace the whole file with:

```tsx
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { listSessions } from "@/services/db/sessions";

export default async function TrainingHistoryPage() {
  const sessions = await listSessions();

  if (sessions.length === 0) {
    return (
      <EmptyState
        title="Training History"
        message="No training sessions yet. Head to Capture to generate your first one."
        ctaHref="/capture"
        ctaLabel="Go to Capture"
      />
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

This is a one-to-one refactor — only the empty-state branch changed (now delegates to `EmptyState`), the populated branch is untouched.

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual check with dev server**

```bash
npm run dev
```

Visit `http://localhost:3000/training`. Confirm the page renders exactly as before (sessions list newest first, each linking to `/training/[sessionId]`). Stop the dev server (Ctrl+C) when done.

- [ ] **Step 4: Commit and push**

```bash
git add src/app/training/page.tsx
git commit -m "Refactor Training History to use EmptyState component"
git push
```

---

### Task 4: /mastery page

**Files:**
- Create: `src/app/mastery/page.tsx`

- [ ] **Step 1: Implement the Mastery page**

Create `src/app/mastery/page.tsx`:

```tsx
import { EmptyState } from "@/components/empty-state";
import { MasteryTopicCard } from "@/components/mastery-topic-card";
import { listMasteryTopics } from "@/services/db/mastery";

export default async function MasteryPage() {
  const topics = await listMasteryTopics();

  if (topics.length === 0) {
    return (
      <EmptyState
        title="Mastery"
        message="No mastery data yet. Complete a training session to start tracking your progress."
        ctaHref="/capture"
        ctaLabel="Go to Capture"
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-medium text-foreground">Mastery</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {topics.map((topic) => (
          <MasteryTopicCard key={topic.id} topic={topic} />
        ))}
      </div>
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

Visit `http://localhost:3000/mastery`. Confirm: a card grid renders, one card per mastery topic, each showing topic name, confidence score with a filled progress bar, session count, and weak-area tags (if any). Cards are not clickable. Stop the dev server (Ctrl+C) when done.

- [ ] **Step 4: Commit and push**

```bash
git add src/app/mastery/page.tsx
git commit -m "Add /mastery page"
git push
```

---

### Task 5: Home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Implement the Home page**

Replace `src/app/page.tsx` with:

```tsx
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { MasteryTopicCard } from "@/components/mastery-topic-card";
import { listMasteryTopics } from "@/services/db/mastery";
import { listSessions } from "@/services/db/sessions";

export default async function Home() {
  const [topics, sessions] = await Promise.all([listMasteryTopics(), listSessions()]);

  if (topics.length === 0) {
    return (
      <EmptyState
        title="Cardiac Mastery OS"
        message="No training sessions yet. Capture a reflection, case note, or insight to generate your first one."
        ctaHref="/capture"
        ctaLabel="Go to Capture"
      />
    );
  }

  const recommended = topics[0];
  const weakestTopics = topics.slice(0, 3);
  const recentSessions = sessions.slice(0, 3);

  return (
    <div className="space-y-8">
      <Link
        href={`/capture?topic=${encodeURIComponent(recommended.topic)}`}
        className="glass-panel block space-y-2 p-6 transition-opacity hover:opacity-80"
      >
        <p className="text-sm text-muted-foreground">Recommended Focus</p>
        <p className="text-xl font-medium text-foreground">{recommended.topic}</p>
        <p className="text-sm text-muted-foreground">Confidence: {Math.round(recommended.confidenceScore)}</p>
      </Link>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Topic Mastery</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {weakestTopics.map((topic) => (
            <MasteryTopicCard
              key={topic.id}
              topic={topic}
              href={`/capture?topic=${encodeURIComponent(topic.topic)}`}
              compact
            />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Recent Activity</h2>
        <ul className="space-y-3">
          {recentSessions.map((session) => (
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
    </div>
  );
}
```

Note: it's expected and fine for the same topic to appear in both "Recommended Focus" and "Topic Mastery" — they answer different questions ("what next" vs. "where do things stand").

- [ ] **Step 2: Verify the project builds**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual check with dev server**

```bash
npm run dev
```

Visit `http://localhost:3000/`. Confirm: "Recommended Focus" hero card shows the lowest-confidence topic and links to `/capture?topic=<topic>`; "Topic Mastery" shows up to 3 compact cards (no weak-area tags) each linking to `/capture?topic=<topic>`; "Recent Activity" shows up to 3 sessions newest first, each linking to `/training/[sessionId]`. Click through each link type once to confirm navigation. Stop the dev server (Ctrl+C) when done.

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: every test file passes (this plan adds no new tests, but confirms nothing existing broke).

- [ ] **Step 5: Commit and push**

```bash
git add src/app/page.tsx
git commit -m "Add Home dashboard"
git push
```

---

## Definition of Done

- `/` shows a recommendation (lowest-confidence topic → `/capture?topic=`), the 3 weakest mastery topics, and the 3 most recent sessions — or an empty state for a first-time user with no data.
- `/mastery` shows a card grid of all mastery topics with confidence score, progress bar, session count, and weak areas — or an empty state.
- `/training` (Training History) renders identically to before, now via the shared `EmptyState` component.
- `npx tsc --noEmit` and `npm test` both pass.
- All work is committed and pushed to `TCtheLabel/cardiac-mastery-os`.

## What's Next

V1.0 (MVP) is complete after this plan: Home, Capture, Training Sessions, AI Question Generation, AI Evaluation, and Mastery Tracking are all built and working end-to-end. Per `docs/Roadmap.md`, V1.1 ("Enhanced Training" — better question diversity, improved evaluations, topic-specific training modes, session templates) would be the next phase, to be brainstormed and spec'd separately when picked up.
