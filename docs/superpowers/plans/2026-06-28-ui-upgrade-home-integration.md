# UI Upgrade: Home Page Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the heart hero (from the previous plan) into the real Home page with a scroll-driven reveal into the existing three modules, restyled with the new visual tokens, and remove the now-superseded dev preview route.

**Architecture:** A new Client Component (`HomeScrollContainer`) wraps `HeartHero` with scroll-linked shrink/fade (Framer Motion's `useScroll`/`useTransform`) and renders the existing three modules as `children` passed straight through from the Server Component `page.tsx`, which now also computes `weakestRegion` from real mastery data.

**Tech Stack:** Next.js 16 (Server + Client Components), `motion` (already a dependency from the previous plan), Tailwind v4 CSS-based theming.

**Reference spec:** `docs/superpowers/specs/2026-06-28-ui-upgrade-home-design.md` (Home Page Architecture section, plus the two minor carry-over items from the previous plan's final review: `prefers-reduced-motion` and a default intrinsic size for `HeartHero`)

**Process note:** Same worktree/branch as Plans 1-2 (`ui-upgrade-home`). This is the last of the 3 plans — after this, the whole branch goes through a final holistic review and the merge/PR decision.

---

## Task 1: Register new tokens with Tailwind + add a glow-accent panel utility

**Files:**
- Modify: `src/app/globals.css`

No automated tests — pure CSS.

The previous plan added `--claret`, `--oxidized-blood`, `--bone`, `--steel` as raw CSS custom properties inside `.dark { ... }`, but never registered them with Tailwind's theme, so utility classes like `text-claret` or `border-claret` don't exist yet. This task fixes that gap and adds one new self-contained panel utility (avoiding any ambiguity about whether a Tailwind `border-color` utility would actually override `.glass-panel`'s `border` shorthand when both classes are present on one element — simpler to just have one complete class with no competing declarations).

- [ ] **Step 1: Register the 4 tokens in the `@theme inline` block**

In `src/app/globals.css`, inside the existing `@theme inline { ... }` block, add these 4 lines (anywhere among the other `--color-*` entries, e.g. right after `--color-card: var(--card);`):

```css
--color-claret: var(--claret);
--color-oxidized-blood: var(--oxidized-blood);
--color-bone: var(--bone);
--color-steel: var(--steel);
```

This makes `text-claret`, `bg-claret`, `border-claret`, `text-bone`, `text-steel`, etc. available as normal Tailwind utility classes (including opacity modifiers like `border-claret/40`), the same way `text-muted-foreground` already works today.

- [ ] **Step 2: Add the glow-accent panel utility**

In `src/app/globals.css`, inside the existing `@layer utilities { ... }` block, right after the `.glass-panel { ... }` rule, add:

```css
.glass-panel-accent {
  background-color: hsl(var(--card) / 0.6);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid color-mix(in srgb, var(--claret) 50%, transparent);
  border-radius: var(--radius);
  box-shadow: 0 0 30px -12px var(--claret);
}
```

This is `.glass-panel` with a claret-tinted border and a soft outer glow instead of the plain neutral border — used by the next task's module restyle. It's a separate, complete class (not an extension of `.glass-panel` via composition) specifically so there's no ambiguity about which rule's `border` declaration wins when both classes would otherwise be applied to the same element.

- [ ] **Step 3: Verify it builds**

Run: `npx tsc --noEmit` (should be unaffected, this is CSS-only) and `npm run dev`, confirm it starts without error, then stop it.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "Register UI upgrade color tokens with Tailwind theme, add glow-accent panel utility"
```

---

## Task 2: Heart hero safeguards (reduced motion + default sizing)

**Files:**
- Modify: `src/components/heart/heart-hero.tsx`

No automated tests — behavioral/visual, verified manually.

Two small fixes carried over from the previous plan's final review, both flagged as "fine to defer until this component is wired into the real, public Home page" — which is exactly what this plan does, so they need to land now, before Task 3.

- [ ] **Step 1: Read the current file**

Read `src/components/heart/heart-hero.tsx` to confirm its current exact content before editing (it should match what was committed at the end of the previous plan — a `HeartHero` component using `motion.div` for a glow layer and a scale-pulse wrapper around `HeartIllustration`).

- [ ] **Step 2: Add `useReducedMotion` and a default aspect ratio**

Change the import line from:

```ts
import { motion } from "motion/react";
```

to:

```ts
import { motion, useReducedMotion } from "motion/react";
```

Verify this import resolves: `node -e 'const m = require("motion/react"); console.log(typeof m.useReducedMotion)'` should print `function`. If it doesn't, check `node_modules/motion/dist/cjs/react.js`'s exports directly for the correct name/path rather than guessing.

Inside the `HeartHero` function body, before the `return`, add:

```ts
const shouldReduceMotion = useReducedMotion();
const pulseScale = shouldReduceMotion ? [1, 1, 1] : [1, 1.015, 1];
const glowOpacity = shouldReduceMotion ? [0.25, 0.25, 0.25] : [0.15, 0.35, 0.15];
```

Then change the outer wrapper's className from:

```tsx
<div className={`relative ${className ?? ""}`}>
```

to:

```tsx
<div className={`relative aspect-[5/6] ${className ?? ""}`}>
```

(`aspect-[5/6]` matches the heart illustration's `400 480` viewBox ratio — a sane default if a future caller forgets to pass explicit dimensions via `className`; callers that do pass explicit width/height, like this plan's own usage, are unaffected since Tailwind's `aspect-*` only constrains when width/height aren't otherwise fixed.)

Then change the two `animate` props from:

```tsx
animate={{ opacity: [0.15, 0.35, 0.15] }}
```

to:

```tsx
animate={{ opacity: glowOpacity }}
```

and:

```tsx
animate={{ scale: [1, 1.015, 1] }}
```

to:

```tsx
animate={{ scale: pulseScale }}
```

The full file after this change:

```tsx
"use client";

import { motion, useReducedMotion } from "motion/react";
import type { HeartRegion } from "@/types/database";
import { HeartIllustration } from "./heart-illustration";

interface HeartHeroProps {
  highlightedRegion?: HeartRegion | null;
  className?: string;
}

export function HeartHero({ highlightedRegion, className }: HeartHeroProps) {
  const shouldReduceMotion = useReducedMotion();
  const pulseScale = shouldReduceMotion ? [1, 1, 1] : [1, 1.015, 1];
  const glowOpacity = shouldReduceMotion ? [0.25, 0.25, 0.25] : [0.15, 0.35, 0.15];

  return (
    <div className={`relative aspect-[5/6] ${className ?? ""}`}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ opacity: glowOpacity }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ scale: pulseScale }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <HeartIllustration highlightedRegion={highlightedRegion} className="relative h-full w-full" />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit` (clean) and `npm test` (50/50, unchanged — this component has no automated tests). To actually confirm the reduced-motion path works, you can temporarily emulate it: in a browser dev tools, enable "Emulate CSS prefers-reduced-motion: reduce" (Chrome DevTools → Rendering tab → Emulate CSS media feature), reload the dev preview route (still present until Task 5 removes it), and confirm the heart no longer visibly pulses/glows-shifts — it should sit static. Then disable the emulation and confirm normal pulsing resumes.

- [ ] **Step 4: Commit**

```bash
git add src/components/heart/heart-hero.tsx
git commit -m "Respect prefers-reduced-motion and add a default size to HeartHero"
```

---

## Task 3: Scroll-driven hero + wire into the real Home page

**Files:**
- Create: `src/components/home-scroll-container.tsx`
- Modify: `src/app/page.tsx`

No automated tests — this is the core visual/interactive piece of this plan; verification is a real render-and-look step (Step 4).

- [ ] **Step 1: Read the current Home page**

Read `src/app/page.tsx` to confirm its current exact content (it should be the existing async Server Component computing `topics`/`sessions`/`recommended`/`weakestTopics`/`recentSessions` and rendering three sections: a Recommended Focus link, a Topic Mastery grid, and a Recent Activity list — unchanged since before this whole UI Upgrade project started).

- [ ] **Step 2: Write the scroll container**

Create `src/components/home-scroll-container.tsx`:

```tsx
"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import type { HeartRegion } from "@/types/database";
import { HeartHero } from "@/components/heart/heart-hero";

interface HomeScrollContainerProps {
  weakestRegion: HeartRegion;
  recommendedTopic: string;
  children: React.ReactNode;
}

export function HomeScrollContainer({ weakestRegion, recommendedTopic, children }: HomeScrollContainerProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.75]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="space-y-12">
      <div ref={heroRef} className="flex min-h-[70vh] flex-col items-center justify-center gap-8 text-center">
        <motion.div style={{ scale: heroScale, opacity: heroOpacity }} className="flex flex-col items-center gap-8">
          <HeartHero highlightedRegion={weakestRegion} className="w-64" />
          <div className="space-y-4">
            <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-bone">
              Train the judgment of a cardiac surgeon.
            </h1>
            <Link
              href={`/capture?topic=${encodeURIComponent(recommendedTopic)}`}
              className="inline-block rounded-full border border-primary px-6 py-2 text-sm text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              Continue: {recommendedTopic}
            </Link>
          </div>
        </motion.div>
      </div>
      {children}
    </div>
  );
}
```

`children` is the three existing modules, rendered server-side by `page.tsx` and passed straight through — this component never inspects or clones them, just renders `{children}` opaquely, which is the standard, fully-supported way to mix Server and Client Components in the App Router.

- [ ] **Step 3: Wire it into `page.tsx`**

In `src/app/page.tsx`, add an import:

```ts
import { HomeScrollContainer } from "@/components/home-scroll-container";
```

After the line `const recentSessions = sessions.slice(0, 3);`, add:

```ts
const weakestRegion = recommended.region ?? "whole_heart";
```

Then wrap the existing returned JSX (the outer `<div className="space-y-8">...</div>` containing the three modules) in `HomeScrollContainer`, passing the two new props. The full new return statement:

```tsx
return (
  <HomeScrollContainer weakestRegion={weakestRegion} recommendedTopic={recommended.topic}>
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
  </HomeScrollContainer>
);
```

Note: the three modules' own styling is untouched in this task — that's Task 4's job. This task is purely about getting the hero + scroll mechanics wired in correctly.

- [ ] **Step 4: Render it, scroll it, and look at it — required, not optional**

Run `npm run dev`, open `http://localhost:3000/` in a browser (this is your real Home page now, with your real mastery data — 3 topics with real regions from Plan 1's backfill). If you have screenshot/browser tooling, use it: take a screenshot at the very top of the page, then scroll down partway and screenshot again, then scroll past the hero entirely and screenshot a third time.

Check:
- At the top: does the heart render centered with the headline and CTA below it, roughly filling a tall first screen (not tiny, not overflowing awkwardly)? Does the heart show a highlighted region (the CTA text should mention your actual weakest topic, e.g. "Continue: <topic name>" — confirm the highlighted region in the heart matches what you'd expect for that topic, or `whole_heart` as a reasonable fallback if it doesn't map cleanly)?
- Partway down: has the hero visibly shrunk and started fading, with the Recommended Focus / Topic Mastery / Recent Activity modules becoming visible below it?
- Fully scrolled past: is the hero mostly/fully faded out, with the three modules now the clear focus, looking like the same module layout that existed before this plan (just not yet restyled — that's next)?
- Does scrolling feel smooth, not janky or stuttering?

If anything is off (hero too large/small, scroll range feels wrong, modules appear before/after they should), adjust the `min-h-[70vh]`, the `useTransform` input/output ranges, or the `heroRef` offset values directly, then re-check. When satisfied, stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/home-scroll-container.tsx src/app/page.tsx
git commit -m "Add scroll-driven heart hero to the real Home page"
```

---

## Task 4: Restyle the three Home modules

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/mastery-topic-card.tsx`

No automated tests — purely visual restyle of existing, already-working data rendering.

- [ ] **Step 1: Restyle the Recommended Focus and Recent Activity sections in `page.tsx`**

In `src/app/page.tsx`, change the Recommended Focus `<Link>`'s className from:

```tsx
className="glass-panel block space-y-2 p-6 transition-opacity hover:opacity-80"
```

to:

```tsx
className="glass-panel-accent block space-y-2 p-6 transition-opacity hover:opacity-80"
```

and inside it, change:

```tsx
<p className="text-sm text-muted-foreground">Recommended Focus</p>
<p className="text-xl font-medium text-foreground">{recommended.topic}</p>
<p className="text-sm text-muted-foreground">Confidence: {Math.round(recommended.confidenceScore)}</p>
```

to:

```tsx
<p className="text-sm uppercase tracking-wide text-steel">Recommended Focus</p>
<p className="text-xl font-medium text-bone">{recommended.topic}</p>
<p className="text-sm text-steel">Confidence: {Math.round(recommended.confidenceScore)}</p>
```

Change both `<h2>` section labels from:

```tsx
<h2 className="text-sm font-medium text-muted-foreground">Topic Mastery</h2>
```

and

```tsx
<h2 className="text-sm font-medium text-muted-foreground">Recent Activity</h2>
```

to:

```tsx
<h2 className="text-sm uppercase tracking-wide text-steel">Topic Mastery</h2>
```

and

```tsx
<h2 className="text-sm uppercase tracking-wide text-steel">Recent Activity</h2>
```

respectively (same text, new classes).

Change the Recent Activity `<li>`'s className from:

```tsx
<li key={session.id} className="glass-panel p-4">
```

to:

```tsx
<li key={session.id} className="glass-panel-accent p-4">
```

and inside it, change:

```tsx
<span className="text-foreground">{session.topic ?? "Untitled Session"}</span>
<span className="text-sm text-muted-foreground">
```

to:

```tsx
<span className="text-bone">{session.topic ?? "Untitled Session"}</span>
<span className="text-sm text-steel">
```

- [ ] **Step 2: Restyle `MasteryTopicCard`**

In `src/components/mastery-topic-card.tsx`, change the outer `<div>`'s className from:

```tsx
<div className="glass-panel space-y-3 p-4">
```

to:

```tsx
<div className="glass-panel-accent space-y-3 p-4">
```

and change:

```tsx
<span className="font-medium text-foreground">{topic.topic}</span>
<span className="text-sm text-muted-foreground">{Math.round(topic.confidenceScore)}</span>
```

to:

```tsx
<span className="font-medium text-bone">{topic.topic}</span>
<span className="text-sm text-steel">{Math.round(topic.confidenceScore)}</span>
```

and change:

```tsx
<p className="text-xs text-muted-foreground">
```

to:

```tsx
<p className="text-xs text-steel">
```

Leave the confidence bar (`bg-muted`/`bg-primary`) and the `Badge` weak-areas pills untouched — those already use semantic tokens that work fine with the new palette.

- [ ] **Step 3: Render it and look at it**

Run `npm run dev`, open `http://localhost:3000/`, scroll past the hero to see the three modules. Confirm:
- Each module now has a visible warm claret-tinted border and soft glow (from `.glass-panel-accent`), distinct from a flat neutral panel.
- Text labels ("Recommended Focus", "Topic Mastery", "Recent Activity", confidence numbers, session dates) read in the cooler `--steel` tone, and primary content (topic names) read in the warmer `--bone` tone — confirm this is actually legible (sufficient contrast against the dark background) and not muddy.
- The Topic Mastery grid (`MasteryTopicCard`) and Recent Activity list both got the same treatment consistently.

Adjust the `.glass-panel-accent` glow intensity (in `globals.css`, from Task 1) or any of these className choices directly if something doesn't read well, then stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/mastery-topic-card.tsx
git commit -m "Restyle Home modules with the new visual tokens"
```

---

## Task 5: Remove the temporary dev preview route

**Files:**
- Delete: `src/app/dev/heart-preview/page.tsx`

No automated tests.

This route was always documented as temporary (see Plan 2's Task 2) — it exists only so the heart illustration could be visually verified before real integration. Now that the real Home page renders it with real data, this route has no remaining purpose.

- [ ] **Step 1: Delete the file**

```bash
git rm src/app/dev/heart-preview/page.tsx
```

If this leaves `src/app/dev/` as an empty directory, that's fine — Next.js doesn't require route directories to exist, and git doesn't track empty directories anyway.

- [ ] **Step 2: Verify nothing else references it**

```bash
grep -rn "heart-preview" src/ docs/ 2>/dev/null
```

Expected: no output (only this plan and the previous plan's docs mention it, which is fine — historical record, not live code).

- [ ] **Step 3: Run the full test suite and a final build check**

Run: `npm test` (expect 50/50, unchanged) and `npx tsc --noEmit` (clean).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Remove temporary heart preview route, now superseded by the real Home page"
```

---

## Self-review notes

- **Spec coverage:** the design spec's remaining Home Page Architecture requirements — `weakestRegion` computed from real data and passed to the hero, scroll-driven reveal, restyled modules — are covered by Tasks 3-4. The two carry-over items from Plan 2's final review (`prefers-reduced-motion`, default sizing) are covered by Task 2, landing exactly where that review recommended. Task 5 closes out the "temporary route" loose end the previous plan explicitly left open.
- **Placeholder scan:** none found — all code and commands are concrete.
- **Type consistency:** `HeartRegion` is used identically in `home-scroll-container.tsx`, `page.tsx`, and the already-shipped `heart-hero.tsx`/`heart-illustration.tsx`. `recommended.region` (typed `HeartRegion | null` per Plan 1's `MasteryTopic`) is narrowed to `HeartRegion` via `?? "whole_heart"` before being passed to `weakestRegion`, matching `HomeScrollContainer`'s required (non-nullable) prop type.
- **Note for whoever executes this:** Task 3 and Task 4 are both genuinely visual/interactive — budget real time for the render-and-look steps, the same way the previous plan's heart illustration needed real iteration. Don't rubber-stamp from reading the code alone.
