# UI Upgrade: Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every mastery topic a `region` (one of 10 fixed anatomical/systemic regions) so a future Home page redesign can highlight the heart region matching the trainee's weakest topic.

**Architecture:** Add a nullable `region` column to `mastery_topics`, a small structured-output AI classifier (`classifyTopicRegion`), a hook in `recordMasteryProgress` that classifies a topic exactly once (on first creation, never re-classified afterward), and a one-off backfill script for topics that already exist. No UI changes in this plan — this produces correct, testable data only.

**Tech Stack:** Existing OpenAI structured-output pattern (`response_format: json_schema`), Supabase, Vitest.

**Reference spec:** `docs/superpowers/specs/2026-06-28-ui-upgrade-home-design.md` (Region Taxonomy + Data Model section)

**Human checkpoint:** Task 1 (database migration) and the final real-data run in Task 5 require Thomas to take action outside automated execution — the Supabase CLI isn't linked in this environment, and Task 5's real backfill spends real OpenAI tokens against live data. A subagent cannot complete these steps — stop and wait for Thomas at each.

---

## Task 1: Database migration — `region` column on `mastery_topics`

**Human checkpoint:** the Supabase CLI is not linked in this environment (`supabase migration list` fails with "Cannot find project ref"). Applying this migration to the live Supabase Cloud database requires Thomas to run the SQL manually via the Supabase Dashboard. A subagent cannot do this step.

**Files:**
- Create: `supabase/migrations/20260628000000_heart_region_taxonomy.sql`

- [ ] **Step 1: Write the migration file**

```sql
alter table mastery_topics add column region text;

alter table mastery_topics add constraint mastery_topics_region_check
  check (region is null or region in (
    'aortic_valve',
    'mitral_valve',
    'right_sided_valves',
    'left_ventricle',
    'right_ventricle',
    'atria',
    'coronary_arteries',
    'aortic_root_great_vessels',
    'pericardium',
    'whole_heart'
  ));
```

- [ ] **Step 2: STOP — Thomas applies this manually**

Open the Supabase Dashboard for this project → SQL Editor → New Query. Paste the full contents of `supabase/migrations/20260628000000_heart_region_taxonomy.sql` and run it. Confirm it completes with no errors, then tell the implementing agent to continue.

- [ ] **Step 3: Verify the migration applied**

Run:

```bash
node -e '
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from("mastery_topics").select("region").limit(1).then(({ error }) => {
  console.log(error ? "ERROR: " + error.message : "OK, region column exists");
});
'
```

Expected: `OK, region column exists`. If it prints an error about the column not existing, Step 2 was not completed — stop and re-check with Thomas before continuing.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260628000000_heart_region_taxonomy.sql
git commit -m "Add region column and check constraint to mastery_topics"
```

---

## Task 2: `HeartRegion` type

**Files:**
- Modify: `src/types/database.ts`

No tests for this task — it's a pure type addition, verified by the type-checker in later tasks.

- [ ] **Step 1: Add the `HeartRegion` type and add `region` to `MasteryTopic`**

In `src/types/database.ts`, add this new type (place it near the other type unions, e.g. after `QualitySignal`):

```ts
export type HeartRegion =
  | "aortic_valve"
  | "mitral_valve"
  | "right_sided_valves"
  | "left_ventricle"
  | "right_ventricle"
  | "atria"
  | "coronary_arteries"
  | "aortic_root_great_vessels"
  | "pericardium"
  | "whole_heart";
```

Then change the existing `MasteryTopic` interface from:

```ts
export interface MasteryTopic {
  id: string;
  topic: string;
  confidenceScore: number;
  sessionCount: number;
  weakAreas: string[];
}
```

to:

```ts
export interface MasteryTopic {
  id: string;
  topic: string;
  confidenceScore: number;
  sessionCount: number;
  weakAreas: string[];
  region: HeartRegion | null;
}
```

- [ ] **Step 2: Run typecheck — expect new errors, that's correct for now**

Run: `npx tsc --noEmit`
Expected: errors in `src/services/db/mastery.ts` (the `toMasteryTopic` function no longer satisfies `MasteryTopic` — missing `region`). This is expected; Task 4 fixes it. Do not fix it in this task.

- [ ] **Step 3: Commit**

```bash
git add src/types/database.ts
git commit -m "Add HeartRegion type and region field to MasteryTopic"
```

---

## Task 3: `classifyTopicRegion` AI service

**Files:**
- Create: `src/services/ai/classifyTopicRegion.ts`
- Test: `src/services/ai/__tests__/classifyTopicRegion.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/services/ai/__tests__/classifyTopicRegion.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

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

import { classifyTopicRegion } from "../classifyTopicRegion";

describe("classifyTopicRegion", () => {
  it("parses the OpenAI response into a region", async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ region: "mitral_valve" }) } }],
    });

    const region = await classifyTopicRegion("Mitral Valve Repair Technique");

    expect(region).toBe("mitral_valve");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4o",
        response_format: expect.objectContaining({ type: "json_schema" }),
      })
    );
  });

  it("throws if OpenAI returns an empty response", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

    await expect(classifyTopicRegion("Some topic")).rejects.toThrow("empty response");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- classifyTopicRegion`
Expected: FAIL — cannot find module `../classifyTopicRegion` (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `src/services/ai/classifyTopicRegion.ts`:

```ts
import { getOpenAIClient } from "@/lib/openai/client";
import type { HeartRegion } from "@/types/database";

const HEART_REGIONS: HeartRegion[] = [
  "aortic_valve",
  "mitral_valve",
  "right_sided_valves",
  "left_ventricle",
  "right_ventricle",
  "atria",
  "coronary_arteries",
  "aortic_root_great_vessels",
  "pericardium",
  "whole_heart",
];

const SYSTEM_PROMPT = `You are classifying a cardiac surgery training topic into the single anatomical region of the heart it is most associated with.

Given a topic title, choose exactly one region from this fixed list:
- aortic_valve: aortic valve disease, repair, replacement
- mitral_valve: mitral valve disease, repair, replacement
- right_sided_valves: tricuspid or pulmonic valve disease, repair, replacement
- left_ventricle: left ventricular structure, function, or pathology
- right_ventricle: right ventricular structure, function, or pathology
- atria: left or right atrial structure, function, or pathology (including arrhythmia topics)
- coronary_arteries: coronary artery disease, bypass grafting, ischemia
- aortic_root_great_vessels: aortic root, ascending/descending aorta, arch, great vessels
- pericardium: pericardial disease, tamponade, effusion
- whole_heart: anything that doesn't pin to one specific structure above — systemic/procedural topics like ECMO, transplant, LVAD, oncology, general principles, or topics spanning multiple structures

Choose "whole_heart" rather than forcing an inaccurate specific match.`;

export async function classifyTopicRegion(topic: string): Promise<HeartRegion> {
  const client = getOpenAIClient();

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Topic: ${topic}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "topic_region",
        strict: true,
        schema: {
          type: "object",
          properties: {
            region: { type: "string", enum: HEART_REGIONS },
          },
          required: ["region"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response for classifyTopicRegion");
  }

  return (JSON.parse(content) as { region: HeartRegion }).region;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- classifyTopicRegion`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/ai/classifyTopicRegion.ts src/services/ai/__tests__/classifyTopicRegion.test.ts
git commit -m "Add classifyTopicRegion AI service"
```

---

## Task 4: Hook region classification into `recordMasteryProgress`

**Files:**
- Modify: `src/services/db/mastery.ts`
- Test: `src/services/db/__tests__/mastery.test.ts`

This task requires Task 1's migration to already be applied (the `region` column must exist on the live `mastery_topics` table) — confirm with whoever ran Task 1 before starting.

- [ ] **Step 1: Write the failing tests**

Add `classifyTopicRegion` mocking and three new tests to `src/services/db/__tests__/mastery.test.ts`. The full updated file:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseClient } from "@/lib/supabase/server";

const mockClassifyTopicRegion = vi.fn();

vi.mock("@/services/ai/classifyTopicRegion", () => ({
  classifyTopicRegion: mockClassifyTopicRegion,
}));

import { listMasteryTopics, recordMasteryProgress } from "../mastery";

const TEST_TOPICS = ["__test__ Aortic Dissection", "__test__ Strong Topic", "__test__ Weak Topic"];

afterEach(async () => {
  const supabase = getSupabaseClient();
  await supabase.from("mastery_topics").delete().in("topic", TEST_TOPICS);
  mockClassifyTopicRegion.mockReset();
});

describe("mastery db service", () => {
  it("creates a new topic on first progress record", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("aortic_root_great_vessels");

    const topic = await recordMasteryProgress("__test__ Aortic Dissection", "adequate", [
      "Missed arch classification nuance.",
    ]);

    expect(topic.topic).toBe("__test__ Aortic Dissection");
    expect(topic.confidenceScore).toBe(65);
    expect(topic.sessionCount).toBe(1);
    expect(topic.weakAreas).toEqual(["Missed arch classification nuance."]);
    expect(topic.region).toBe("aortic_root_great_vessels");
  });

  it("blends confidence toward the new signal on repeat progress", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("aortic_root_great_vessels");
    await recordMasteryProgress("__test__ Aortic Dissection", "weak", ["Missed arch classification nuance."]);
    const updated = await recordMasteryProgress("__test__ Aortic Dissection", "strong", ["Missed timing of repair."]);

    // existing 35, blended 35*0.65 + 90*0.35 = 54.25
    expect(updated.confidenceScore).toBeCloseTo(54.25, 2);
    expect(updated.sessionCount).toBe(2);
    expect(updated.weakAreas[0]).toBe("Missed timing of repair.");
    expect(updated.weakAreas).toContain("Missed arch classification nuance.");
  });

  it("lists topics ordered by ascending confidence", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("left_ventricle");
    mockClassifyTopicRegion.mockResolvedValueOnce("left_ventricle");
    await recordMasteryProgress("__test__ Strong Topic", "strong", []);
    await recordMasteryProgress("__test__ Weak Topic", "weak", []);

    const topics = await listMasteryTopics();
    const names = topics.map((t) => t.topic);
    expect(names.indexOf("__test__ Weak Topic")).toBeLessThan(names.indexOf("__test__ Strong Topic"));
  });

  it("classifies a topic's region only once, never on repeat progress", async () => {
    mockClassifyTopicRegion.mockResolvedValueOnce("mitral_valve");
    await recordMasteryProgress("__test__ Aortic Dissection", "adequate", []);

    // If called again, the mock would return undefined (no second mockResolvedValueOnce queued) —
    // a second classification call would surface as region becoming undefined/null, not "mitral_valve".
    const updated = await recordMasteryProgress("__test__ Aortic Dissection", "strong", []);

    expect(updated.region).toBe("mitral_valve");
    expect(mockClassifyTopicRegion).toHaveBeenCalledTimes(1);
  });

  it("falls back to whole_heart if classification fails", async () => {
    mockClassifyTopicRegion.mockRejectedValueOnce(new Error("OpenAI is down"));

    const topic = await recordMasteryProgress("__test__ Aortic Dissection", "adequate", []);

    expect(topic.region).toBe("whole_heart");
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test -- mastery`
Expected: the 3 pre-existing tests still pass (or fail to compile, since `MasteryTopic` now requires `region` and `toMasteryTopic` doesn't provide it yet); the 2 new tests fail because `recordMasteryProgress` doesn't call `classifyTopicRegion` at all yet.

- [ ] **Step 3: Write minimal implementation**

Replace the full contents of `src/services/db/mastery.ts` with:

```ts
import { getSupabaseClient } from "@/lib/supabase/server";
import { classifyTopicRegion } from "@/services/ai/classifyTopicRegion";
import type { HeartRegion, MasteryTopic, QualitySignal } from "@/types/database";

interface MasteryTopicRow {
  id: string;
  topic: string;
  confidence_score: number;
  session_count: number;
  weak_areas: string[];
  region: string | null;
}

function toMasteryTopic(row: MasteryTopicRow): MasteryTopic {
  return {
    id: row.id,
    topic: row.topic,
    confidenceScore: row.confidence_score,
    sessionCount: row.session_count,
    weakAreas: row.weak_areas,
    region: row.region as HeartRegion | null,
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

async function classifyRegionSafely(topic: string): Promise<HeartRegion> {
  try {
    return await classifyTopicRegion(topic);
  } catch {
    return "whole_heart";
  }
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

  const payload: Record<string, unknown> = {
    id: existing?.id,
    topic,
    confidence_score: Math.round(nextConfidence * 100) / 100,
    session_count: (existing?.sessionCount ?? 0) + 1,
    weak_areas: nextWeakAreas,
  };

  if (!existing) {
    payload.region = await classifyRegionSafely(topic);
  }

  const { data: savedRow, error: saveError } = await supabase
    .from("mastery_topics")
    .upsert(payload, { onConflict: "topic" })
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

The key change from the original: `payload` only includes `region` when `existing` is null (brand-new topic) — omitting a key from a Supabase `upsert()` payload means that column is left untouched on conflict, so an existing topic's `region` is never overwritten on subsequent calls, even though `classifyRegionSafely` is never even called for it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- mastery`
Expected: PASS (5 tests: the 3 original plus the 2 new ones)

Run: `npx tsc --noEmit`
Expected: clean (this also resolves the expected Task 2 errors)

- [ ] **Step 5: Commit**

```bash
git add src/services/db/mastery.ts src/services/db/__tests__/mastery.test.ts
git commit -m "Classify and store a region for new mastery topics"
```

---

## Task 5: Backfill script for existing topics

**Files:**
- Create: `scripts/backfill-topic-regions.ts`
- Modify: `package.json`

**Human checkpoint:** the script's actual real-data run (Step 4 below) spends real OpenAI tokens and writes to Thomas's live `mastery_topics` table. Build and verify the script's logic safely first (Steps 1-3, against an isolated `__test__`-prefixed row), then stop and let Thomas run the real backfill himself (or watch it run) — don't run Step 4 autonomously.

- [ ] **Step 1: Write the script**

Create `scripts/backfill-topic-regions.ts`:

```ts
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });

import { getSupabaseClient } from "../src/lib/supabase/server";
import { classifyTopicRegion } from "../src/services/ai/classifyTopicRegion";

async function main() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("mastery_topics").select("id, topic").is("region", null);

  if (error) throw new Error(`Failed to fetch topics needing backfill: ${error.message}`);
  if (!data || data.length === 0) {
    console.log("No topics need backfilling.");
    return;
  }

  console.log(`Backfilling region for ${data.length} topic(s)...`);

  for (const row of data as { id: string; topic: string }[]) {
    const region = await classifyTopicRegion(row.topic);
    const { error: updateError } = await supabase.from("mastery_topics").update({ region }).eq("id", row.id);
    if (updateError) {
      console.error(`Failed to update topic "${row.topic}": ${updateError.message}`);
      continue;
    }
    console.log(`  "${row.topic}" -> ${region}`);
  }

  console.log("Backfill complete.");
}

main().catch((error) => {
  console.error("backfill-topic-regions failed:", error);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`, add this line to `"scripts"` (alongside `sync-notebook`/`train-from-notebook`):

```json
"backfill-topic-regions": "tsx scripts/backfill-topic-regions.ts"
```

- [ ] **Step 3: Verify the script's query/update logic safely, against an isolated test row**

This is a manual verification, not an automated test (consistent with `sync-notebook.ts`/`train-from-notebook.ts` having no test files — one-off operational scripts aren't unit-tested in this codebase). Run this to create one throwaway untagged topic, confirm the script finds and tags exactly it, then clean up:

```bash
node -e '
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from("mastery_topics").insert({ topic: "__test__ Backfill Check", confidence_score: 50, session_count: 1, weak_areas: [] }).then(({ error }) => {
  console.log(error ? "ERROR: " + error.message : "test row inserted");
});
'
npm run backfill-topic-regions
node -e '
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from("mastery_topics").select("region").eq("topic", "__test__ Backfill Check").single().then(({ data, error }) => {
  console.log(error ? "ERROR: " + error.message : "region after backfill: " + data.region);
  return supabase.from("mastery_topics").delete().eq("topic", "__test__ Backfill Check");
}).then(() => console.log("test row cleaned up"));
'
```

Expected: the script logs finding and tagging `"__test__ Backfill Check" -> <some region>`, the follow-up query shows a non-null region, and the test row is deleted afterward. If any real (non-`__test__`) topics also got backfilled during this run, that's fine and expected — it means they needed it.

- [ ] **Step 4: STOP — hand off to Thomas for the real run**

Tell Thomas: the backfill script is built and verified. If Step 3 already backfilled his real topics as a side effect (likely, since the script processes every `region IS NULL` row, not just the test one), there's nothing further to run — confirm with him by checking `npm run backfill-topic-regions` again (expected: "No topics need backfilling." if everything's already tagged). If for some reason it still finds real topics, let Thomas decide whether to run it now or later himself.

- [ ] **Step 5: Commit**

```bash
git add scripts/backfill-topic-regions.ts package.json package-lock.json
git commit -m "Add backfill script for mastery_topics missing a region"
```

---

## Self-review notes

- **Spec coverage:** all 4 data-foundation requirements from the design spec are covered: schema change (Task 1), `HeartRegion` type (Task 2), `classifyTopicRegion` (Task 3), the classify-once hook + error-handling fallback (Task 4), and the backfill script (Task 5).
- **Placeholder scan:** none found — every step has complete, copy-pasteable code or exact commands.
- **Type consistency:** `HeartRegion` (Task 2) is used identically in `classifyTopicRegion.ts` (Task 3), `mastery.ts`'s `toMasteryTopic`/`classifyRegionSafely` (Task 4), and the backfill script (Task 5) — same 10-value union throughout, no drift.
- **Deviation from spec:** none — this plan implements the "Region Taxonomy + Data Model" section of the design spec exactly, deferring all UI/visual work to the next plan as the spec's own suggested sequencing calls for.
