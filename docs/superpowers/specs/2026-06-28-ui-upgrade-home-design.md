# UI Upgrade: Home Page Redesign — Design

## Context

`docs/UI_Upgrade/Cardiac-Mastery-OS-design-spec.md` is a creative brief (not a technical spec) describing a new visual identity for Cardiac Mastery OS: an "elite anatomical observatory" feel, centered on an anatomically-inspired heart that responds to the trainee's weakest mastery area. This document turns that brief into a buildable design, scoped to the Home page only (confirmed with Thomas 2026-06-28 — other pages keep their current look for this pass).

The existing Home page (`src/app/page.tsx`) already computes exactly the three modules the brief calls for — Recommended Focus, Topic Mastery, Recent Activity — from real data (`listMasteryTopics()`, `listSessions()`). This design doesn't change that data layer's shape; it adds a new hero above it, restyles the existing modules, and adds one new field (`region`) to `mastery_topics` to power the signature interaction.

## Goals

1. A tall, immersive hero on Home: an anatomically-inspired heart illustration, ambient restrained motion, a concise thesis line, one primary CTA.
2. As the user scrolls, the hero recedes and the page resolves into the three existing modules, restyled to match the new visual system.
3. Signature interaction: the heart highlights the anatomical region corresponding to the trainee's current weakest mastery topic — a real, data-driven connection between the centerpiece visual and actual mastery data, not decoration.
4. Visual system (palette + typography) introduced here should feel like a deepening of the existing dark theme, not a wholesale rebrand — `--background` and `--primary` already trend in this direction.

## Non-goals

- **No true interactive 3D.** Decided 2026-06-28: a fixed-camera, scripted animation (Framer Motion + layered SVG) reads as dimensional without the cost/risk of a real-time 3D engine.
- **No rebrand of other pages** (Capture, Training, Mastery, Train from Notebook) in this pass — they keep their current styling. A follow-on pass can extend the new tokens app-wide once this is proven.
- **No literal region-by-AI-guess accuracy guarantee.** The classifier can occasionally be wrong or land on the catch-all bucket; this is an accepted tradeoff, not a bug to eliminate (see Region Taxonomy below).
- **No generic medical blue, no floating SaaS dashboard cards, no horror-movie heartbeat** — per the original brief's non-goals, still in force.

## Visual System

Builds on existing tokens (`src/app/globals.css`, `.dark` block) rather than replacing them — `--background: hsl(222 12% 6%)` and `--primary: hsl(350 65% 47%)` already read as "obsidian black, arterial red." New tokens, added alongside the existing ones:

```css
--claret: hsl(350 55% 28%);          /* darker red — shadow/depth on the heart */
--oxidized-blood: hsl(10 30% 20%);   /* desaturated brown-red — recessed vessel tone */
--bone: hsl(40 22% 90%);             /* warm off-white — hero thesis text only */
--steel: hsl(215 10% 45%);           /* muted cool gray — instrument-style labels */
```

These are starting values; expect minor hue/lightness tuning once the heart illustration and hero are actually rendered — normal for visual work without a live preview tool, not an open question blocking implementation.

Typography: keep Geist Sans (body/UI) and Geist Mono (small precise labels) exactly as they are today. Add **Fraunces** (via `next/font/google`) as a new display serif, used only for the hero headline — gives the "controlled editorial display face" the brief asks for without touching any existing component's type.

## Region Taxonomy + Data Model

Ten regions, each corresponding to a distinct layer in the heart SVG:

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
  | "whole_heart"; // catch-all: ECMO, transplant, oncology, general/foundations topics
```

`whole_heart` exists specifically so topics that don't pin to one structure (e.g. "LVAD driveline infection management") aren't forced into a misleading literal mapping.

**Schema change:** add a nullable `region` text column to `mastery_topics`.

**Classification:** new `classifyTopicRegion(topic: string): Promise<HeartRegion>` in `src/services/ai/classifyTopicRegion.ts` — same structured-output pattern as `generateSession`/`evaluateResponse` (`response_format: json_schema`, enum-constrained to the 10 `HeartRegion` values, no free text).

**Hook point:** `recordMasteryProgress()` in `src/services/db/mastery.ts` calls `classifyTopicRegion(topic)` only when `existing` (the pre-upsert lookup already in that function) is `null` — i.e., the first time a topic string is ever seen. Topics get reused across many sessions, so this keeps the extra AI call rare, not per-session.

**Backfill:** a one-off script (`scripts/backfill-topic-regions.ts`, same style as `scripts/sync-notebook.ts`) that finds every `mastery_topics` row with `region IS NULL` and classifies it. Necessary because the "classify on first creation" hook only fires going forward — without this, any topic that already exists before this feature ships would sit at `region: null` forever.

## Home Page Architecture

```
src/app/page.tsx (Server Component, mostly unchanged)
  ├─ listMasteryTopics() / listSessions()         ← already exists, unchanged
  ├─ weakestRegion = topics[0]?.region ?? "whole_heart"   ← topics already sorted weakest-first
  └─ renders <HomeHero /> + restyled modules, passing weakestRegion + existing module data as props

src/components/heart-hero.tsx (new, Client Component)
  ├─ layered SVG (one <path>/<g> per HeartRegion)
  ├─ ambient loop (Framer Motion): restrained scale/glow pulse, every few seconds,
  │    constant regardless of mastery data — this is the brief's "Motion" section
  └─ highlight layer: stronger glow/stroke on whichever <g> matches weakestRegion —
       this is the brief's "Signature Interaction," data-driven, separate from the ambient loop

Scroll-driven reveal: Framer Motion's useScroll/useTransform, scoped to a wrapping
container around hero + modules — shrinks/fades the hero and reveals the modules
as the user scrolls, instead of a hard cut between two stacked sections.
```

The three existing modules (Recommended Focus, Topic Mastery via `MasteryTopicCard`, Recent Activity) keep their current data and structure entirely — only their styling changes (claret borders, bone-white headers, steel-gray meta text, a subtle glow-framed panel treatment instead of the current flat `glass-panel` background) to read as "derived from the anatomy" per the brief.

**New dependency:** Framer Motion (`motion` package) — no clean way to do scroll-linked, data-driven animation with Tailwind/CSS alone.

## Error Handling

- Zero mastery topics: keep using the existing `EmptyState` exactly as today — the hero only renders once there's at least one real topic to point at (nothing to highlight otherwise).
- `topics[0]?.region` is `null` (a topic that predates the backfill, or a backfill that failed for one row): fall back to the `whole_heart` layer rather than rendering nothing or crashing.
- `classifyTopicRegion` failure during a live session (network/API error): `recordMasteryProgress` should not let a classification failure block saving mastery progress itself — catch and fall back to `region: "whole_heart"` for that row rather than throwing, since the core mastery-tracking write is far more important than the cosmetic region tag.

## Testing

- `classifyTopicRegion` + its hook in `recordMasteryProgress`: integration test mocking the AI call (same pattern as existing `generateSession` test mocks) — verifies a brand-new topic gets classified and stored, and an existing topic is never reclassified on a second call.
- Backfill script: manually run and verified against real data (one-off operational script, not unit-tested — consistent with `sync-notebook.ts`'s precedent).
- Hero/animation/restyled modules: no automated tests — purely presentational, consistent with this codebase's established convention. Verified manually: load Home, confirm the hero renders, scroll and confirm the reveal transition, confirm the highlighted region matches the actual weakest topic's region.

## Suggested implementation sequencing

This is large enough to warrant 2-3 sequential plans rather than one (same pattern as the original Plans A/B/C):

1. **Data foundation**: `region` column, `HeartRegion` type, `classifyTopicRegion`, the `recordMasteryProgress` hook, the backfill script, and its test. Ships independently — produces correct, testable data with no visual changes yet.
2. **Heart asset + ambient motion**: the layered SVG, `heart-hero.tsx`, the ambient pulse loop, the new color tokens and Fraunces font. Can be visually verified on its own (e.g. behind a temporary route) before wiring into Home.
3. **Home integration**: scroll-driven reveal, restyled modules, wiring `weakestRegion` through `page.tsx` into the highlight layer — the final assembly.

## Files touched (indicative, finalized per-plan during planning)

- `src/app/globals.css` — new color tokens
- `src/app/layout.tsx` — add Fraunces font
- `src/types/database.ts` — `HeartRegion` type, `region` on `MasteryTopic`
- `src/services/ai/classifyTopicRegion.ts` — new
- `src/services/db/mastery.ts` — hook + `region` column read/write
- `src/services/db/__tests__/mastery.test.ts` — new test(s)
- `scripts/backfill-topic-regions.ts` — new
- `src/components/heart-hero.tsx` — new
- `src/app/page.tsx` — wire `weakestRegion`, restyle module rendering
- `src/components/mastery-topic-card.tsx` — restyle only
- Supabase migration — add `region` column to `mastery_topics`
