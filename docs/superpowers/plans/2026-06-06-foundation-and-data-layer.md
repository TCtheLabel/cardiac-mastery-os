# Cardiac Mastery OS — Foundation & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js + Tailwind + shadcn/ui project with a dark-only "surgical" theme, a local Supabase Postgres database with the full MVP schema, and a tested `services/db` data-access layer — producing a running, navigable app shell wired to a working database.

**Architecture:** A fresh Next.js App Router project (TypeScript, Tailwind, `src/` dir) restyled with a custom dark CSS-variable palette over shadcn/ui's structure. Postgres runs locally via the Supabase CLI (Docker-based); a single server-side Supabase client (service-role key, no auth/RLS — this is a single-user app per Agent.md) backs a thin `services/db/*.ts` layer of typed CRUD functions, each covered by Vitest integration tests that run against the local database.

**Tech Stack:** Next.js (App Router, TypeScript, Tailwind, `src/` dir, npm), shadcn/ui, Supabase (local via CLI + `@supabase/supabase-js`), Vitest + `@vitejs/plugin-react` + `vite-tsconfig-paths`.

**Spec:** `docs/superpowers/specs/2026-06-06-mvp-build-design.md`

---

## Current Build Status

**Last updated:** 2026-06-08
**Status:** ✅ COMPLETE — all 14 tasks done, 9 tests passing, pushed to TCtheLabel/cardiac-mastery-os

**Where we are:**
- Tasks 1–14 are all **pending** (no code has been written yet)
- Task 1 (scaffold) was attempted on 2026-06-06 and stopped safely before running `create-next-app`
- The project directory currently contains only `docs/` and a `.env` file (no Next.js code)

**Architecture change — Supabase Cloud instead of local CLI:**
- The original plan used the Supabase CLI + Docker for local Postgres. That requirement is removed.
- Instead: create a free project at supabase.com; use the hosted URL + service_role key in `.env.local`.
- Task 7 and Task 9 are updated below to reflect this. Everything else (client code, db services, Vitest tests) is unchanged.

**Known pre-existing file to be aware of:**
- `.env` already exists in the project root with `OPENAI_API_KEY=...`
- This key was placed there intentionally by the user; it will be needed in Task 7
- This file **must** be gitignored before the first `git commit` in Task 1 — the standard Next.js `.gitignore` template covers it, but verify explicitly right after scaffolding and before accepting the automatic initial commit

---

## Before You Start

- A free Supabase project must exist at supabase.com with its API URL and service_role key available (needed in Task 7).
- The GitHub CLI (`gh`) must be installed and authenticated (`gh auth status`).
- You'll need an OpenAI API key ready to paste into `.env.local` in Task 7 (it isn't used by this plan's code yet, but the env file is created here so later plans can rely on it).
- Run all commands from the project root: `/Users/thomas/Desktop/Next Level/Projects/Cardiac Mastery OS`

---

### Task 1: Scaffold the Next.js project

**Files:**
- Create: entire Next.js scaffold (`package.json`, `next.config.ts`, `tsconfig.json`, `src/app/*`, etc.)

- [ ] **Step 1: Run create-next-app in the current directory**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

Expected: the CLI runs non-interactively (all relevant prompts are answered by flags), reports "Success! Created..." and finishes by running `git init` + an initial commit automatically (since this directory is not yet a git repo). It will note that `docs/` and `.DS_Store` already exist but will not block — Next.js scaffold files don't conflict with them.

- [ ] **Step 2: Verify the dev server runs**

```bash
npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill %1
```

Expected: prints `200`.

- [ ] **Step 3: Confirm the automatic initial commit exists**

```bash
git log --oneline -1
```

Expected: one commit, something like `Initial commit from Create Next App`. (No manual commit needed for this task — create-next-app already made one. If for any reason no commit exists, run `git add -A && git commit -m "Initial commit from Create Next App"`.)

---

### Task 2: Create the GitHub repository and push

**Files:** none (remote setup only)

- [ ] **Step 1: Create a private GitHub repo from the local project and push**

```bash
gh repo create cardiac-mastery-os --private --source=. --remote=origin --push
```

Expected: output confirms repo creation (`https://github.com/<your-username>/cardiac-mastery-os`), adds `origin` remote, and pushes `main` with upstream tracking set.

- [ ] **Step 2: Verify the remote and push succeeded**

```bash
git remote -v
git log origin/main --oneline -1
```

Expected: `origin` listed with fetch/push URLs, and `origin/main` shows the same commit as local `main`.

---

### Task 3: Install and configure shadcn/ui

**Files:**
- Create: `components.json`, `src/lib/utils.ts` (generated by shadcn init)
- Modify: `src/app/globals.css` (shadcn adds its base CSS variables — we'll override them in Task 4)

- [ ] **Step 1: Run shadcn init with defaults**

```bash
npx shadcn@latest init -d
```

Expected: completes without prompts (`-d` accepts defaults), creates `components.json` and `src/lib/utils.ts`, and adds shadcn's base CSS-variable theme to `src/app/globals.css`.

- [ ] **Step 2: Verify the generated files exist**

```bash
test -f components.json && test -f src/lib/utils.ts && echo "shadcn initialized"
```

Expected: prints `shadcn initialized`.

*(We are not adding any shadcn components yet — Button, Textarea, Card, etc. will be added in later plans as each screen needs them, per YAGNI.)*

- [ ] **Step 3: Commit and push**

```bash
git add components.json src/lib/utils.ts src/app/globals.css
git commit -m "Initialize shadcn/ui"
git push
```

---

### Task 4: Apply the dark "surgical" theme palette

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update the CSS custom properties in `:root` (and `.dark`, if shadcn generated one)**

Open `src/app/globals.css`. Shadcn's init generated a `:root { ... }` block (and possibly a `.dark { ... }` block) defining color variables like `--background`, `--foreground`, `--primary`, etc. Since this app is **dark mode only**, set the values in `:root` to the palette below — and if a `.dark` block exists, give it the *same* values so the app looks identical regardless of class.

Use whichever color function the generated file already uses for its values (`hsl(...)`, raw `H S% L%` consumed via `hsl(var(--x))`, or `oklch(...)`). The triplets below are in the long-standing `H S% L%` shadcn convention — if the file uses `oklch()`, keep that function and substitute these equivalent dark values that satisfy the same intent (background reads near-black, card reads as a lighter charcoal panel, primary reads as a deep red, secondary as steel blue, accent as warm gold):

```css
--radius: 1rem;
--background: 222 12% 6%;          /* Surgical Black */
--foreground: 210 20% 92%;
--card: 222 10% 11%;               /* Deep Charcoal */
--card-foreground: 210 20% 92%;
--popover: 222 10% 11%;
--popover-foreground: 210 20% 92%;
--primary: 350 65% 47%;            /* Aortic Red */
--primary-foreground: 0 0% 100%;
--secondary: 212 35% 47%;          /* Steel Blue */
--secondary-foreground: 0 0% 100%;
--muted: 222 8% 16%;
--muted-foreground: 215 12% 65%;
--accent: 38 55% 58%;              /* Warm Gold */
--accent-foreground: 222 12% 6%;
--destructive: 350 65% 47%;
--destructive-foreground: 0 0% 100%;
--border: 222 8% 18%;
--input: 222 8% 18%;
--ring: 350 65% 47%;
```

- [ ] **Step 2: Append a `.glass-panel` utility for frosted/glass surfaces**

Add this block at the end of `src/app/globals.css` (this is the recurring "frosted panel" surface called for throughout the design — large glass cards over the dark background):

```css
@layer utilities {
  .glass-panel {
    background-color: hsl(var(--card) / 0.6);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid hsl(var(--border) / 0.5);
    border-radius: var(--radius);
  }
}
```

- [ ] **Step 3: Verify the dev server still runs and renders the dark palette**

```bash
npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill %1
```

Expected: `200`. Open `http://localhost:3000` in a browser to visually confirm the page now renders on a near-black background (it will still show the default Next.js starter content — that gets replaced in Task 5).

- [ ] **Step 4: Commit and push**

```bash
git add src/app/globals.css
git commit -m "Apply dark surgical theme palette and glass-panel utility"
git push
```

---

### Task 5: Build the base layout and navigation shell

**Files:**
- Create: `src/components/nav.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create the navigation component**

Create `src/components/nav.tsx`:

```tsx
import Link from "next/link";

const links = [
  { href: "/", label: "Home" },
  { href: "/capture", label: "Capture" },
  { href: "/training", label: "Training" },
  { href: "/mastery", label: "Mastery" },
];

export function Nav() {
  return (
    <header className="border-b border-border/40">
      <nav className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-sm font-medium tracking-wide text-foreground/90">
          Cardiac Mastery OS
        </Link>
        <ul className="flex items-center gap-6">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Replace `src/app/layout.tsx`**

Replace its entire contents with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cardiac Mastery OS",
  description: "A deliberate-practice environment for cardiac surgical judgment.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <Nav />
        <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Replace `src/app/page.tsx` with a placeholder Home**

The real Home dashboard is built in a later plan. For now, replace its contents with a minimal placeholder that proves the layout, nav, and glass-panel styling work together:

```tsx
export default function Home() {
  return (
    <div className="glass-panel p-10 text-center">
      <h1 className="text-2xl font-medium text-foreground">Cardiac Mastery OS</h1>
      <p className="mt-3 text-muted-foreground">
        Foundation scaffold running. The home dashboard arrives in a later phase.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify in the browser**

```bash
npm run dev &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
kill %1
```

Expected: `200`. Open `http://localhost:3000` and confirm: a quiet top nav with "Cardiac Mastery OS" + four links (Home/Capture/Training/Mastery — they 404 for now, that's expected), and a centered frosted glass panel with the placeholder heading, all on the dark palette.

- [ ] **Step 5: Commit and push**

```bash
git add src/components/nav.tsx src/app/layout.tsx src/app/page.tsx
git commit -m "Add base layout, navigation shell, and placeholder home"
git push
```

---

### Task 6: Set up Vitest

**Files:**
- Create: `vitest.config.ts`, `src/lib/__tests__/sanity.test.ts`
- Modify: `package.json` (add `test` script)

- [ ] **Step 1: Install Vitest and its Vite plugins**

```bash
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 2: Create `vitest.config.ts`**

This loads `.env.local` into the test process (so the db-service tests in later tasks can reach the local Supabase instance) and resolves the `@/*` import alias:

```typescript
import { defineConfig, loadEnv } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    globals: true,
    env: loadEnv(mode, process.cwd(), ""),
  },
}));
```

- [ ] **Step 3: Add the `test` script to `package.json`**

In the `"scripts"` section, add:

```json
"test": "vitest run"
```

- [ ] **Step 4: Write a smoke test**

Create `src/lib/__tests__/sanity.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

describe("sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

```bash
npm test
```

Expected: `sanity > runs` passes, summary shows `1 passed`.

- [ ] **Step 6: Delete the smoke test**

It served only to prove the runner works — keeping a meaningless test around adds noise.

```bash
rm src/lib/__tests__/sanity.test.ts
rmdir src/lib/__tests__
```

- [ ] **Step 7: Commit and push**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "Set up Vitest test runner"
git push
```

---

### Task 7: Set up Supabase Cloud and environment config

**Context:** This app uses Supabase Cloud (hosted, free tier) instead of a local Docker-based Supabase stack. The API URL and service_role key come from a pre-existing Supabase project on supabase.com — the user will supply them.

**Files:**
- Create: `.env.local`

- [ ] **Step 1: Obtain the Supabase project credentials**

The user has a Supabase project at supabase.com. From the project dashboard → Settings → API, collect:
- **Project URL** (e.g. `https://xxxxxxxxxxxx.supabase.co`)
- **service_role secret key** (under "Project API keys" — the `service_role` key, not the `anon` key)

These values are provided by the user and should be pasted into `.env.local` in the next step.

- [ ] **Step 2: Create `.env.local`**

Create `.env.local` in the project root with the values the user provides:

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role key from supabase.com>
OPENAI_API_KEY=<value already in .env — copy it here>
```

Note: The `.env` file that already exists in the project root contains `OPENAI_API_KEY`. Copy that value into `.env.local`. Do not delete `.env` — just make sure `.env.local` has all three variables.

- [ ] **Step 3: Confirm `.env.local` is gitignored**

```bash
git check-ignore .env.local && echo "ignored"
```

Expected: prints `.env.local` then `ignored` (create-next-app's default `.gitignore` already excludes `.env*.local`). If it does NOT print `ignored`, add `.env.local` to `.gitignore` before continuing — never commit secrets.

- [ ] **Step 4: No files to commit for this task**

`.env.local` is gitignored and must not be committed. There are no other files to add. Skip the commit step.

---

### Task 8: Create the Supabase server client

**Files:**
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Install the Supabase JS client**

```bash
npm install @supabase/supabase-js
```

- [ ] **Step 2: Create the server client factory**

Create `src/lib/supabase/server.ts`. This app has no authentication (per Agent.md) and runs entirely server-side (Server Components + API routes), so a single service-role client is sufficient — no browser client, no cookie/session handling:

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return client;
}
```

- [ ] **Step 3: Commit and push**

(This file is exercised end-to-end by the db-service tests in Task 11 — there's nothing meaningful to query yet since the schema doesn't exist until Task 9.)

```bash
git add package.json package-lock.json src/lib/supabase/server.ts
git commit -m "Add Supabase server client factory"
git push
```

---

### Task 9: Write and apply the initial schema migration

**Context:** Using Supabase Cloud (no local CLI). The migration SQL is stored as a file in the repo for version control, and applied by running it in the Supabase SQL Editor on supabase.com.

**Files:**
- Create: `supabase/migrations/20260606000000_initial_schema.sql`

- [ ] **Step 1: Create the migrations directory and file manually**

```bash
mkdir -p supabase/migrations
touch supabase/migrations/20260606000000_initial_schema.sql
```

- [ ] **Step 2: Write the schema**

Open `supabase/migrations/20260606000000_initial_schema.sql` and write:

```sql
create table training_sources (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  source_type text not null check (source_type in ('reflection', 'case_note', 'article_summary', 'insight')),
  created_at timestamptz not null default now()
);

create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references training_sources(id) on delete cascade,
  topic text,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  category text not null check (category in (
    'decision_making', 'operative_planning', 'complication_management',
    'pattern_recognition', 'reflection'
  )),
  prompt text not null,
  order_index int not null default 0
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  response text not null,
  created_at timestamptz not null default now()
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references responses(id) on delete cascade,
  strengths text,
  missed_concepts text,
  improvements text,
  principle text,
  quality_signal text not null check (quality_signal in ('strong', 'adequate', 'weak')),
  created_at timestamptz not null default now()
);

create table mastery_topics (
  id uuid primary key default gen_random_uuid(),
  topic text not null unique,
  confidence_score numeric not null default 0,
  session_count int not null default 0,
  weak_areas text[] not null default '{}'
);
```

- [ ] **Step 3: Apply the migration via the Supabase SQL Editor**

This step requires the user to run the SQL manually:

1. Go to supabase.com → your project → SQL Editor
2. Paste the entire contents of `supabase/migrations/20260606000000_initial_schema.sql`
3. Click **Run**

Expected: all statements execute without error. The Tables section of the Supabase dashboard should now show all six tables: `training_sources`, `training_sessions`, `questions`, `responses`, `evaluations`, `mastery_topics`.

**Do not proceed to Task 10 until the user confirms the migration ran successfully.**

- [ ] **Step 4: Commit and push**

```bash
git add supabase/migrations
git commit -m "Add initial database schema migration"
git push
```

---

### Task 10: Define shared TypeScript types

**Files:**
- Create: `src/types/database.ts`

- [ ] **Step 1: Write the shared types**

Create `src/types/database.ts`:

```typescript
export type SourceType = "reflection" | "case_note" | "article_summary" | "insight";

export type QuestionCategory =
  | "decision_making"
  | "operative_planning"
  | "complication_management"
  | "pattern_recognition"
  | "reflection";

export type QualitySignal = "strong" | "adequate" | "weak";

export interface TrainingSource {
  id: string;
  content: string;
  sourceType: SourceType;
  createdAt: string;
}

export interface TrainingSession {
  id: string;
  sourceId: string;
  topic: string | null;
  createdAt: string;
}

export interface Question {
  id: string;
  sessionId: string;
  category: QuestionCategory;
  prompt: string;
  orderIndex: number;
}

export interface QuestionResponse {
  id: string;
  questionId: string;
  response: string;
  createdAt: string;
}

export interface Evaluation {
  id: string;
  responseId: string;
  strengths: string | null;
  missedConcepts: string | null;
  improvements: string | null;
  principle: string | null;
  qualitySignal: QualitySignal;
  createdAt: string;
}

export interface MasteryTopic {
  id: string;
  topic: string;
  confidenceScore: number;
  sessionCount: number;
  weakAreas: string[];
}
```

- [ ] **Step 2: Verify the project still type-checks**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit and push**

```bash
git add src/types/database.ts
git commit -m "Add shared database TypeScript types"
git push
```

---

### Task 11: Build the `training_sources` db service

**Files:**
- Create: `src/services/db/sources.ts`
- Test: `src/services/db/__tests__/sources.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/db/__tests__/sources.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/services/db/__tests__/sources.test.ts
```

Expected: FAIL — `Cannot find module '../sources'` (the implementation doesn't exist yet).

- [ ] **Step 3: Implement the service**

Create `src/services/db/sources.ts`:

```typescript
import { getSupabaseClient } from "@/lib/supabase/server";
import type { SourceType, TrainingSource } from "@/types/database";

interface SourceRow {
  id: string;
  content: string;
  source_type: SourceType;
  created_at: string;
}

function toTrainingSource(row: SourceRow): TrainingSource {
  return {
    id: row.id,
    content: row.content,
    sourceType: row.source_type,
    createdAt: row.created_at,
  };
}

export async function createSource(content: string, sourceType: SourceType): Promise<TrainingSource> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("training_sources")
    .insert({ content, source_type: sourceType })
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

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx vitest run src/services/db/__tests__/sources.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/services/db/sources.ts src/services/db/__tests__/sources.test.ts
git commit -m "Add training_sources db service"
git push
```

---

### Task 12: Build the `training_sessions` + `questions` db service

**Files:**
- Create: `src/services/db/sessions.ts`
- Test: `src/services/db/__tests__/sessions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/db/__tests__/sessions.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/services/db/__tests__/sessions.test.ts
```

Expected: FAIL — `Cannot find module '../sessions'`.

- [ ] **Step 3: Implement the service**

Create `src/services/db/sessions.ts`:

```typescript
import { getSupabaseClient } from "@/lib/supabase/server";
import type { Question, QuestionCategory, TrainingSession } from "@/types/database";

interface SessionRow {
  id: string;
  source_id: string;
  topic: string | null;
  created_at: string;
}

interface QuestionRow {
  id: string;
  session_id: string;
  category: QuestionCategory;
  prompt: string;
  order_index: number;
}

function toTrainingSession(row: SessionRow): TrainingSession {
  return {
    id: row.id,
    sourceId: row.source_id,
    topic: row.topic,
    createdAt: row.created_at,
  };
}

function toQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    sessionId: row.session_id,
    category: row.category,
    prompt: row.prompt,
    orderIndex: row.order_index,
  };
}

export interface NewQuestion {
  category: QuestionCategory;
  prompt: string;
}

export async function createSessionWithQuestions(
  sourceId: string,
  topic: string,
  questions: NewQuestion[]
): Promise<{ session: TrainingSession; questions: Question[] }> {
  const supabase = getSupabaseClient();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("training_sessions")
    .insert({ source_id: sourceId, topic })
    .select()
    .single();

  if (sessionError) throw new Error(`Failed to create session: ${sessionError.message}`);

  const session = toTrainingSession(sessionRow as SessionRow);

  const { data: questionRows, error: questionsError } = await supabase
    .from("questions")
    .insert(
      questions.map((q, index) => ({
        session_id: session.id,
        category: q.category,
        prompt: q.prompt,
        order_index: index,
      }))
    )
    .select();

  if (questionsError) throw new Error(`Failed to create questions: ${questionsError.message}`);

  return {
    session,
    questions: (questionRows as QuestionRow[]).map(toQuestion),
  };
}

export async function getSessionWithQuestions(
  sessionId: string
): Promise<{ session: TrainingSession; questions: Question[] } | null> {
  const supabase = getSupabaseClient();

  const { data: sessionRow, error: sessionError } = await supabase
    .from("training_sessions")
    .select()
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw new Error(`Failed to fetch session ${sessionId}: ${sessionError.message}`);
  if (!sessionRow) return null;

  const { data: questionRows, error: questionsError } = await supabase
    .from("questions")
    .select()
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true });

  if (questionsError)
    throw new Error(`Failed to fetch questions for session ${sessionId}: ${questionsError.message}`);

  return {
    session: toTrainingSession(sessionRow as SessionRow),
    questions: (questionRows as QuestionRow[]).map(toQuestion),
  };
}

export async function listSessions(): Promise<TrainingSession[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("training_sessions")
    .select()
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list sessions: ${error.message}`);
  return (data as SessionRow[]).map(toTrainingSession);
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx vitest run src/services/db/__tests__/sessions.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit and push**

```bash
git add src/services/db/sessions.ts src/services/db/__tests__/sessions.test.ts
git commit -m "Add training_sessions and questions db service"
git push
```

---

### Task 13: Build the `responses` + `evaluations` db services

**Files:**
- Create: `src/services/db/responses.ts`, `src/services/db/evaluations.ts`
- Test: `src/services/db/__tests__/responses-evaluations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/db/__tests__/responses-evaluations.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { createSource } from "../sources";
import { createSessionWithQuestions } from "../sessions";
import { createResponse, getResponseById } from "../responses";
import { createEvaluation } from "../evaluations";

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

async function seedQuestion() {
  const source = await createSource("Reflected on an LVAD complication.", "reflection");
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

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/services/db/__tests__/responses-evaluations.test.ts
```

Expected: FAIL — `Cannot find module '../responses'`.

- [ ] **Step 3: Implement `responses.ts`**

Create `src/services/db/responses.ts`. Note: the shared type is named `QuestionResponse` (not `Response`) specifically to avoid colliding with the global Web API `Response` type that Next.js route handlers use constantly — keep that naming throughout:

```typescript
import { getSupabaseClient } from "@/lib/supabase/server";
import type { QuestionResponse } from "@/types/database";

interface ResponseRow {
  id: string;
  question_id: string;
  response: string;
  created_at: string;
}

function toQuestionResponse(row: ResponseRow): QuestionResponse {
  return {
    id: row.id,
    questionId: row.question_id,
    response: row.response,
    createdAt: row.created_at,
  };
}

export async function createResponse(questionId: string, response: string): Promise<QuestionResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("responses")
    .insert({ question_id: questionId, response })
    .select()
    .single();

  if (error) throw new Error(`Failed to create response: ${error.message}`);
  return toQuestionResponse(data as ResponseRow);
}

export async function getResponseById(id: string): Promise<QuestionResponse | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("responses")
    .select()
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch response ${id}: ${error.message}`);
  return data ? toQuestionResponse(data as ResponseRow) : null;
}
```

- [ ] **Step 4: Implement `evaluations.ts`**

Create `src/services/db/evaluations.ts`:

```typescript
import { getSupabaseClient } from "@/lib/supabase/server";
import type { Evaluation, QualitySignal } from "@/types/database";

interface EvaluationRow {
  id: string;
  response_id: string;
  strengths: string | null;
  missed_concepts: string | null;
  improvements: string | null;
  principle: string | null;
  quality_signal: QualitySignal;
  created_at: string;
}

function toEvaluation(row: EvaluationRow): Evaluation {
  return {
    id: row.id,
    responseId: row.response_id,
    strengths: row.strengths,
    missedConcepts: row.missed_concepts,
    improvements: row.improvements,
    principle: row.principle,
    qualitySignal: row.quality_signal,
    createdAt: row.created_at,
  };
}

export interface NewEvaluation {
  strengths: string;
  missedConcepts: string;
  improvements: string;
  principle: string;
  qualitySignal: QualitySignal;
}

export async function createEvaluation(responseId: string, evaluation: NewEvaluation): Promise<Evaluation> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("evaluations")
    .insert({
      response_id: responseId,
      strengths: evaluation.strengths,
      missed_concepts: evaluation.missedConcepts,
      improvements: evaluation.improvements,
      principle: evaluation.principle,
      quality_signal: evaluation.qualitySignal,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create evaluation: ${error.message}`);
  return toEvaluation(data as EvaluationRow);
}
```

- [ ] **Step 5: Run the test again and confirm it passes**

```bash
npx vitest run src/services/db/__tests__/responses-evaluations.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 6: Commit and push**

```bash
git add src/services/db/responses.ts src/services/db/evaluations.ts src/services/db/__tests__/responses-evaluations.test.ts
git commit -m "Add responses and evaluations db services"
git push
```

---

### Task 14: Build the `mastery_topics` db service

This is the service that implements the mastery-scoring logic from the spec: blending each new `qualitySignal` into a running `confidence_score` (weighted toward recent results), incrementing `session_count`, and folding new `missed_concepts` into a deduped, capped `weak_areas` list.

**Files:**
- Create: `src/services/db/mastery.ts`
- Test: `src/services/db/__tests__/mastery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/db/__tests__/mastery.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";
import { listMasteryTopics, recordMasteryProgress } from "../mastery";

async function cleanup() {
  const supabase = getSupabaseClient();
  await supabase
    .from("mastery_topics")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
}

afterEach(async () => {
  await cleanup();
});

describe("mastery db service", () => {
  it("creates a new topic on first progress record", async () => {
    const topic = await recordMasteryProgress("Aortic Dissection", "adequate", [
      "Missed arch classification nuance.",
    ]);

    expect(topic.topic).toBe("Aortic Dissection");
    expect(topic.confidenceScore).toBe(65);
    expect(topic.sessionCount).toBe(1);
    expect(topic.weakAreas).toEqual(["Missed arch classification nuance."]);
  });

  it("blends confidence toward the new signal on repeat progress", async () => {
    await recordMasteryProgress("Aortic Dissection", "weak", ["Missed arch classification nuance."]);
    const updated = await recordMasteryProgress("Aortic Dissection", "strong", ["Missed timing of repair."]);

    // existing 35, blended 35*0.65 + 90*0.35 = 54.25
    expect(updated.confidenceScore).toBeCloseTo(54.25, 2);
    expect(updated.sessionCount).toBe(2);
    expect(updated.weakAreas[0]).toBe("Missed timing of repair.");
    expect(updated.weakAreas).toContain("Missed arch classification nuance.");
  });

  it("lists topics ordered by ascending confidence", async () => {
    await recordMasteryProgress("Strong Topic", "strong", []);
    await recordMasteryProgress("Weak Topic", "weak", []);

    const topics = await listMasteryTopics();
    const names = topics.map((t) => t.topic);
    expect(names.indexOf("Weak Topic")).toBeLessThan(names.indexOf("Strong Topic"));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/services/db/__tests__/mastery.test.ts
```

Expected: FAIL — `Cannot find module '../mastery'`.

- [ ] **Step 3: Implement the service**

Create `src/services/db/mastery.ts`:

```typescript
import { getSupabaseClient } from "@/lib/supabase/server";
import type { MasteryTopic, QualitySignal } from "@/types/database";

interface MasteryTopicRow {
  id: string;
  topic: string;
  confidence_score: number;
  session_count: number;
  weak_areas: string[];
}

function toMasteryTopic(row: MasteryTopicRow): MasteryTopic {
  return {
    id: row.id,
    topic: row.topic,
    confidenceScore: row.confidence_score,
    sessionCount: row.session_count,
    weakAreas: row.weak_areas,
  };
}

const QUALITY_SCORES: Record<QualitySignal, number> = {
  strong: 90,
  adequate: 65,
  weak: 35,
};

const RECENCY_WEIGHT = 0.35;
const MAX_WEAK_AREAS = 5;

export async function listMasteryTopics(): Promise<MasteryTopic[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("mastery_topics")
    .select()
    .order("confidence_score", { ascending: true });

  if (error) throw new Error(`Failed to list mastery topics: ${error.message}`);
  return (data as MasteryTopicRow[]).map(toMasteryTopic);
}

export async function recordMasteryProgress(
  topic: string,
  qualitySignal: QualitySignal,
  newMissedConcepts: string[]
): Promise<MasteryTopic> {
  const supabase = getSupabaseClient();

  const { data: existingRow, error: fetchError } = await supabase
    .from("mastery_topics")
    .select()
    .eq("topic", topic)
    .maybeSingle();

  if (fetchError) throw new Error(`Failed to fetch mastery topic "${topic}": ${fetchError.message}`);

  const existing = existingRow ? toMasteryTopic(existingRow as MasteryTopicRow) : null;
  const signalScore = QUALITY_SCORES[qualitySignal];

  const nextConfidence = existing
    ? existing.confidenceScore * (1 - RECENCY_WEIGHT) + signalScore * RECENCY_WEIGHT
    : signalScore;

  const nextWeakAreas = mergeWeakAreas(existing?.weakAreas ?? [], newMissedConcepts);

  const { data: savedRow, error: saveError } = await supabase
    .from("mastery_topics")
    .upsert(
      {
        id: existing?.id,
        topic,
        confidence_score: Math.round(nextConfidence * 100) / 100,
        session_count: (existing?.sessionCount ?? 0) + 1,
        weak_areas: nextWeakAreas,
      },
      { onConflict: "topic" }
    )
    .select()
    .single();

  if (saveError) throw new Error(`Failed to save mastery topic "${topic}": ${saveError.message}`);
  return toMasteryTopic(savedRow as MasteryTopicRow);
}

function mergeWeakAreas(existing: string[], incoming: string[]): string[] {
  const merged = [...incoming.filter((area) => area.trim().length > 0), ...existing];
  const deduped = Array.from(new Set(merged.map((area) => area.trim())));
  return deduped.slice(0, MAX_WEAK_AREAS);
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx vitest run src/services/db/__tests__/mastery.test.ts
```

Expected: PASS — all three tests green.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: every test file passes (sources, sessions, responses-evaluations, mastery).

- [ ] **Step 6: Commit and push**

```bash
git add src/services/db/mastery.ts src/services/db/__tests__/mastery.test.ts
git commit -m "Add mastery_topics db service with confidence-blending logic"
git push
```

---

## Definition of Done

- `npm run dev` serves a dark-themed app shell at `/` with working nav links to `/capture`, `/training`, `/mastery` (these routes 404 until later plans build them — that's expected).
- `npm test` runs the full Vitest suite against the local Supabase instance and all tests pass.
- The database has all six MVP tables (`training_sources`, `training_sessions`, `questions`, `responses`, `evaluations`, `mastery_topics`) with working FK relationships and constraints.
- `services/db/*.ts` provides typed, tested CRUD functions for every entity, ready for the AI service layer (next plan) to build on.
- All work is committed and pushed to the private GitHub repo `cardiac-mastery-os`.

## What's Next

The next plan ("Capture → Generate → Train → Evaluate") builds the AI service layer (`services/ai/generateSession.ts`, `services/ai/evaluateResponse.ts`), the corresponding API routes, and the Capture/Training screens that complete the core deliberate-practice loop end-to-end — using the db services and schema this plan establishes.
