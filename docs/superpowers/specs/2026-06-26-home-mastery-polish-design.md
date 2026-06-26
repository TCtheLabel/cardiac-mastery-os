# Plan C: Home + Mastery + Polish — Design

## Context

Plan A (Foundation + Data Layer) and Plan B (Capture → Generate → Train → Evaluate) are complete. The full deliberate-practice loop works end-to-end and has been verified with real OpenAI calls. Plan C is the last MVP phase per `docs/Roadmap.md` (Phases 6-8): Home dashboard, Mastery page, and Polish.

Currently:
- `/` (Home) is a placeholder ("Foundation scaffold running...").
- `/mastery` does not exist (404) even though the nav already links to it.
- `/api/mastery` (GET) already exists and returns `MasteryTopic[]` sorted by `confidence_score` ascending (weakest first).
- `listSessions()` already exists and returns `TrainingSession[]` sorted by `created_at` descending (most recent first).
- `/training` (Training History) already has a working empty-state pattern to follow.

## Goals

1. Build a Home dashboard that surfaces what to work on next.
2. Build a Mastery page that shows full topic-level mastery detail.
3. Add empty states to Home and Mastery for first-time users with no data, and factor out the existing Training History empty state into a shared component for consistency.

## Non-goals

- No new database tables, service functions, or API routes — `listMasteryTopics()` and `listSessions()` already return the right data in the right order.
- No loading.tsx / error.tsx route-level boundaries — deferred until real usage surfaces a need.
- No automated UI tests — this codebase tests services/API routes (Vitest against Supabase Cloud), not pages. No new business logic is introduced here (just rendering + array slicing), so manual verification is sufficient.

## Data fetching approach

Both pages are Server Components that call the existing service functions directly:

```ts
const topics = await listMasteryTopics(); // src/services/db/mastery.ts
const sessions = await listSessions();    // src/services/db/sessions.ts
```

This matches the existing `/training` (Training History) page's pattern. No client-side fetch, no loading spinners, no new API routes — `/api/mastery` remains available for any future client-side use but is not consumed by these pages.

## Home page (`/`)

Replaces `src/app/page.tsx`. Fetches `listMasteryTopics()` and `listSessions()` in parallel via `Promise.all`.

**Empty state** (zero mastery topics): renders `<EmptyState>` — "No training sessions yet" + CTA to `/capture`. No other sections render.

**Normal state**, three stacked sections:

1. **Recommended Focus** — hero card for `topics[0]` (lowest confidence_score, already sorted ascending). Shows topic name + confidence score. Links to `/capture?topic=<topic>`.
2. **Topic Mastery** — `topics.slice(0, 3)` (the 3 weakest, which includes the same topic as the recommendation), rendered with `<MasteryTopicCard compact href="/capture?topic=...">`. Each card links to `/capture?topic=<topic>`.
3. **Recent Activity** — `sessions.slice(0, 3)` (3 most recent), same row style as Training History: topic name + short date, linking to `/training/[sessionId]`.

It is acceptable and expected that the topic in "Recommended Focus" also appears in "Topic Mastery" — they answer different questions ("what next" vs. "where do things stand").

## Mastery page (`/mastery`)

New file: `src/app/mastery/page.tsx`. Fetches `listMasteryTopics()`.

**Empty state**: `<EmptyState>` — "No mastery data yet" + CTA to `/capture`.

**Normal state**: card grid, one `<MasteryTopicCard>` per topic (full, non-compact, no href — these cards are informational, not clickable), showing:
- Topic name
- Confidence score: number + horizontal progress bar (bar width = score%; no color-tier thresholds for V1)
- Session count
- Weak areas (up to 5, rendered as small tags)

## Shared components

**`src/components/empty-state.tsx`** (new)
Props: `title: string`, `message: string`, `ctaHref: string`, `ctaLabel: string`. Renders the `glass-panel` block currently inlined in Training History. Used by Home, Mastery, and Training History (refactored to use it).

**`src/components/mastery-topic-card.tsx`** (new)
Props: `topic: MasteryTopic`, `href?: string` (wraps card in `Link` when present), `compact?: boolean` (when true, hides the weak-areas tag list — used on Home; full detail by default on Mastery).

## Files touched

- `src/components/empty-state.tsx` — new
- `src/components/mastery-topic-card.tsx` — new
- `src/app/page.tsx` — rewritten (Home)
- `src/app/mastery/page.tsx` — new (Mastery)
- `src/app/training/page.tsx` — small refactor to use `<EmptyState>` instead of its inline block

## Verification

Manual, via dev server:
1. With existing seeded data: confirm Home shows recommendation, 3 weakest topics, 3 recent sessions, and all links navigate correctly.
2. Confirm Mastery shows all topics with correct confidence bars, session counts, and weak-area tags.
3. Temporarily point at an empty dataset (or reason about a fresh project) to confirm empty states render correctly on Home and Mastery, and that Training History's refactored empty state still renders identically.
