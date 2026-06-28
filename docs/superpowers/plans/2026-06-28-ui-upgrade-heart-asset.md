# UI Upgrade: Heart Asset + Ambient Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, layered heart illustration (one shape per `HeartRegion`) with a restrained ambient breathing motion, viewable on its own behind a temporary dev route — not yet wired into the real Home page.

**Architecture:** A pure data file holds the SVG path geometry; a static, dependency-free component (`HeartIllustration`) renders it with CSS-only highlight styling; a thin Framer Motion wrapper (`HeartHero`) adds the ambient pulse on top. A temporary route lets this be viewed and visually verified in a browser before Plan 3 wires real mastery data into it.

**Tech Stack:** SVG, Tailwind/CSS custom properties, Framer Motion (`motion` package, new dependency).

**Reference spec:** `docs/superpowers/specs/2026-06-28-ui-upgrade-home-design.md` (Visual System + Home Page Architecture sections)

**Process note:** Same worktree/branch as Plan 1 (`ui-upgrade-home`), building toward a single eventual review/merge after all 3 plans are done.

**Important framing for whoever executes this:** Task 2's SVG path data is a genuine first draft, hand-authored without a live visual design tool. It is very likely to need real visual iteration (adjusting coordinates after actually looking at it rendered) before it looks good — that's expected, not a sign anything is wrong. Task 2 explicitly includes a render-and-look step, and the implementer should keep adjusting the path data and re-rendering until it actually looks like a coherent, reasonably attractive heart with 10 distinguishable regions, not just declare victory once it compiles. If you have screenshot/browser-viewing capability, use it — don't approve this from reading coordinates alone.

---

## Task 1: Visual system tokens

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

No automated tests — pure CSS/font config.

- [ ] **Step 1: Add the new color tokens**

In `src/app/globals.css`, inside the existing `.dark { ... }` block, add these four lines (anywhere inside the block — e.g. right after `--ring: hsl(350 65% 47%);`):

```css
--claret: hsl(350 55% 28%);
--oxidized-blood: hsl(10 30% 20%);
--bone: hsl(40 22% 90%);
--steel: hsl(215 10% 45%);
```

- [ ] **Step 2: Add the Fraunces display font**

In `src/app/layout.tsx`, change the font import line from:

```ts
import { Geist, Geist_Mono } from "next/font/google";
```

to:

```ts
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
```

Then add a new font config below the existing `geistMono` config:

```ts
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});
```

Then change the `className` on `<body>` from:

```tsx
className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
```

to:

```tsx
className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased min-h-screen bg-background text-foreground`}
```

This makes `var(--font-fraunces)` available everywhere as a CSS variable (the same pattern already used for `--font-geist-sans`/`--font-geist-mono`) — it doesn't apply Fraunces anywhere yet, it just makes it available. A later plan's hero headline will use `className="font-[family-name:var(--font-fraunces)]"` or an equivalent Tailwind arbitrary-value class.

- [ ] **Step 3: Verify it builds**

Run: `npm run dev` (or `npx tsc --noEmit` for a faster check), confirm no errors. Stop the dev server when done (`Ctrl-C` or kill the background process) — don't leave it running.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "Add UI upgrade color tokens and Fraunces display font"
```

---

## Task 2: Heart region path data + static illustration component

**Files:**
- Create: `src/components/heart/heart-region-paths.ts`
- Create: `src/components/heart/heart-illustration.tsx`
- Create: `src/app/dev/heart-preview/page.tsx`

No automated tests — purely visual/presentational, consistent with this codebase's convention. Verification is a real render-and-look step (Step 4 below), not a test run.

- [ ] **Step 1: Write the path data file**

Create `src/components/heart/heart-region-paths.ts`:

```ts
import type { HeartRegion } from "@/types/database";

export const HEART_VIEWBOX = "0 0 400 480";

export const PERICARDIUM_PATH =
  "M200,460 C120,460 40,380 40,290 C40,210 90,150 150,140 C175,135 195,150 200,170 C205,150 225,135 250,140 C310,150 360,210 360,290 C360,380 280,460 200,460 Z";

interface RegionShape {
  paths: string[];
  strokeOnly?: boolean;
}

export const REGION_SHAPES: Record<HeartRegion, RegionShape> = {
  atria: {
    paths: [
      "M150,140 C110,140 75,170 70,210 C65,250 90,280 130,290 C150,295 165,280 170,260 C175,235 170,200 165,170 C162,155 158,145 150,140 Z",
      "M250,140 C290,140 325,170 330,210 C335,250 310,280 270,290 C250,295 235,280 230,260 C225,235 230,200 235,170 C238,155 242,145 250,140 Z",
    ],
  },
  right_ventricle: {
    paths: [
      "M145,255 C105,265 85,305 92,348 C99,392 135,415 170,418 C180,419 185,412 182,402 C175,375 170,330 168,295 C166,275 158,260 145,255 Z",
    ],
  },
  left_ventricle: {
    paths: [
      "M255,255 C310,265 335,315 328,365 C320,420 265,458 205,463 C193,464 188,455 194,444 C212,405 222,345 224,300 C226,278 238,262 255,255 Z",
    ],
  },
  aortic_root_great_vessels: {
    paths: [
      "M210,150 C212,110 225,75 260,60 C290,48 320,55 335,75 C345,88 340,100 328,98 C310,95 295,100 285,115 C270,138 265,160 262,180 C260,195 245,200 235,190 C225,180 215,170 210,150 Z",
      "M190,150 C185,115 165,90 135,85 C115,82 100,92 98,108 C97,118 108,122 118,118 C132,113 145,120 152,138 C160,158 165,175 175,185 C185,193 195,180 192,165 C191,160 190,155 190,150 Z",
    ],
  },
  coronary_arteries: {
    strokeOnly: true,
    paths: [
      "M200,250 C198,290 196,330 194,380 C193,410 195,430 198,450",
      "M200,280 C220,290 240,305 255,325",
      "M196,320 C178,335 162,355 152,378",
    ],
  },
  aortic_valve: {
    paths: ["M235,202 L246,213 L235,224 L224,213 Z"],
  },
  mitral_valve: {
    paths: ["M240,247 L253,259 L240,271 L227,259 Z"],
  },
  right_sided_valves: {
    paths: ["M160,247 L173,259 L160,271 L147,259 Z", "M170,162 L181,172 L170,182 L159,172 Z"],
  },
  pericardium: {
    strokeOnly: true,
    paths: [PERICARDIUM_PATH],
  },
  whole_heart: {
    strokeOnly: true,
    paths: [PERICARDIUM_PATH],
  },
};
```

Note `pericardium` and `whole_heart` intentionally share the same outer outline path — `pericardium` is a real anatomical region (sac around the heart, so the outer boundary is the right visual for it), and `whole_heart` is the catch-all that should glow the entire heart rather than any single internal structure, so reusing the same outer path is correct for both, not a copy-paste mistake.

- [ ] **Step 2: Write the static illustration component**

Create `src/components/heart/heart-illustration.tsx`:

```tsx
import type { HeartRegion } from "@/types/database";
import { HEART_VIEWBOX, PERICARDIUM_PATH, REGION_SHAPES } from "./heart-region-paths";

interface HeartIllustrationProps {
  highlightedRegion?: HeartRegion | null;
  className?: string;
}

const FILLED_REGION_COLOR = "var(--claret)";
const STROKE_REGION_COLOR = "var(--steel)";
const VALVE_COLOR = "var(--bone)";
const HIGHLIGHT_COLOR = "var(--primary)";

export function HeartIllustration({ highlightedRegion, className }: HeartIllustrationProps) {
  const regionEntries = Object.entries(REGION_SHAPES) as [HeartRegion, (typeof REGION_SHAPES)[HeartRegion]][];

  const isOuterOutlineHighlighted = highlightedRegion === "whole_heart" || highlightedRegion === "pericardium";

  return (
    <svg viewBox={HEART_VIEWBOX} className={className} role="img" aria-label="Stylized heart illustration">
      <path
        d={PERICARDIUM_PATH}
        fill="none"
        stroke={isOuterOutlineHighlighted ? HIGHLIGHT_COLOR : STROKE_REGION_COLOR}
        strokeWidth={isOuterOutlineHighlighted ? 3 : 1.5}
        opacity={isOuterOutlineHighlighted ? 0.9 : 0.4}
        style={{ transition: "stroke 0.6s ease, opacity 0.6s ease, stroke-width 0.6s ease" }}
      />
      {regionEntries
        .filter(([key]) => key !== "pericardium" && key !== "whole_heart")
        .map(([key, shape]) => {
          const isHighlighted = highlightedRegion === key;
          const isValve = key === "aortic_valve" || key === "mitral_valve" || key === "right_sided_valves";
          const baseColor = isValve ? VALVE_COLOR : FILLED_REGION_COLOR;

          return (
            <g key={key} data-region={key}>
              {shape.paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill={shape.strokeOnly ? "none" : isHighlighted ? HIGHLIGHT_COLOR : baseColor}
                  stroke={shape.strokeOnly ? (isHighlighted ? HIGHLIGHT_COLOR : "var(--primary)") : "var(--oxidized-blood)"}
                  strokeWidth={shape.strokeOnly ? (isHighlighted ? 4 : 2.5) : 1}
                  strokeOpacity={shape.strokeOnly ? (isHighlighted ? 0.95 : 0.55) : 1}
                  style={{
                    transition: "fill 0.6s ease, stroke 0.6s ease, stroke-width 0.6s ease, stroke-opacity 0.6s ease",
                    filter: isHighlighted ? "drop-shadow(0 0 10px var(--primary))" : "none",
                  }}
                />
              ))}
            </g>
          );
        })}
    </svg>
  );
}
```

- [ ] **Step 3: Create the temporary preview route**

Create `src/app/dev/heart-preview/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { HeartIllustration } from "@/components/heart/heart-illustration";
import type { HeartRegion } from "@/types/database";

const REGIONS: HeartRegion[] = [
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

export default function HeartPreviewPage() {
  const [region, setRegion] = useState<HeartRegion | null>(null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-medium text-foreground">Heart Preview (dev only)</h1>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setRegion(null)}
          className={`rounded-full border px-3 py-1 text-sm ${region === null ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
        >
          none
        </button>
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            className={`rounded-full border px-3 py-1 text-sm ${region === r ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
          >
            {r}
          </button>
        ))}
      </div>
      <HeartIllustration highlightedRegion={region} className="mx-auto h-[480px] w-[400px]" />
    </div>
  );
}
```

This route is temporary — it will be deleted in the next plan once the real Home page integration replaces it as the way to view this component. It's deliberately placed under `/dev/` to signal that.

- [ ] **Step 4: Render it, look at it, and iterate on the path data until it looks right**

Run `npm run dev`, open `http://localhost:3000/dev/heart-preview` in a browser (or screenshot it if you're an agent with browser/screenshot tooling — use that capability here, this is exactly what it's for). Click through the region buttons.

Check for, and fix by directly editing the `d` coordinates in `heart-region-paths.ts` if needed:
- Does it read as a recognizable, reasonably attractive stylized heart (not a blob, not obviously broken/self-intersecting paths)?
- Are the two ventricle shapes and two atria lobes visually distinct from each other, not overlapping in a confusing way?
- Does clicking each region button visibly and distinctly highlight the right shape (valves should be small bone-colored diamonds that turn red/glow; chambers should turn from deep claret to brighter red with a glow; `pericardium`/`whole_heart` should glow the outer outline)?
- Does the coronary artery linework look like thin vessel lines over the ventricle surface, not a stray scribble?

Keep adjusting coordinates and re-rendering until this all looks genuinely good, not just "technically renders." This is the single most important verification step in this plan — don't skip or rush it. When you're done, stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/heart/heart-region-paths.ts src/components/heart/heart-illustration.tsx src/app/dev/heart-preview/page.tsx
git commit -m "Add layered heart illustration with per-region highlighting"
```

If you made coordinate adjustments during Step 4 before committing, that's expected and fine — commit the final, looks-good version.

---

## Task 3: Ambient motion wrapper

**Files:**
- Modify: `package.json` (new dependency)
- Create: `src/components/heart/heart-hero.tsx`
- Modify: `src/app/dev/heart-preview/page.tsx`

No automated tests — animation behavior, verified visually (Step 4).

- [ ] **Step 1: Install Framer Motion**

Run: `npm install motion`

This installs the current "Motion" package (the actively maintained successor to the older `framer-motion` package name). Verify the React entry point resolves before continuing:

```bash
node -e 'console.log(require.resolve("motion/react"))'
```

Expected: prints a path inside `node_modules/motion/...` with no error. If this fails (e.g., the import path has changed since this plan was written), check `node_modules/motion/package.json`'s `"exports"` field for the correct React-specific subpath, and use that import path instead of `"motion/react"` in Step 2 below — don't guess, check the installed package directly.

- [ ] **Step 2: Write the ambient motion wrapper**

Create `src/components/heart/heart-hero.tsx`:

```tsx
"use client";

import { motion } from "motion/react";
import type { HeartRegion } from "@/types/database";
import { HeartIllustration } from "./heart-illustration";

interface HeartHeroProps {
  highlightedRegion?: HeartRegion | null;
  className?: string;
}

export function HeartHero({ highlightedRegion, className }: HeartHeroProps) {
  return (
    <div className={`relative ${className ?? ""}`}>
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, var(--primary) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        animate={{ scale: [1, 1.015, 1] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <HeartIllustration highlightedRegion={highlightedRegion} className="relative h-full w-full" />
      </motion.div>
    </div>
  );
}
```

The glow layer and the scale pulse share the same 4.5s duration so they breathe in sync — this is the brief's "restrained beat every few seconds, with subtle systolic contraction and faint vascular light response." The region-highlight color transition itself stays a plain CSS `transition` (already built into `HeartIllustration` from Task 2) rather than a second Framer Motion animation — it only changes when `highlightedRegion` changes (rare), so a CSS transition is simpler and sufficient.

- [ ] **Step 3: Wire it into the preview route**

In `src/app/dev/heart-preview/page.tsx`, change the import from:

```ts
import { HeartIllustration } from "@/components/heart/heart-illustration";
```

to:

```ts
import { HeartHero } from "@/components/heart/heart-hero";
```

And change the final line from:

```tsx
<HeartIllustration highlightedRegion={region} className="mx-auto h-[480px] w-[400px]" />
```

to:

```tsx
<HeartHero highlightedRegion={region} className="mx-auto h-[480px] w-[400px]" />
```

- [ ] **Step 4: Render it and look at the motion**

Run `npm run dev`, open `http://localhost:3000/dev/heart-preview`, and actually watch it for at least 10 seconds (or take 2-3 screenshots a couple seconds apart if you're working from static screenshots, to confirm the scale/glow are actually animating between frames, not frozen).

Check:
- Does the heart visibly, gently pulse (scale up and back down) every ~4.5 seconds? It should be subtle — if it looks like a heart attack or a cartoonish bounce, slow the duration down or reduce the scale range (e.g. `[1, 1.008, 1]`) by editing `heart-hero.tsx` directly.
- Does the background glow breathe in sync with the pulse?
- Click through regions again — do highlights still transition smoothly on top of the ambient motion, without fighting/jittering against it?

Iterate on the `transition`/`animate` values directly if anything feels off, then stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/heart/heart-hero.tsx src/app/dev/heart-preview/page.tsx
git commit -m "Add ambient breathing motion to the heart illustration"
```

---

## Self-review notes

- **Spec coverage:** the design spec's Visual System (palette/typography) is covered by Task 1; the heart asset, region taxonomy mapping to SVG layers, and "Motion" (ambient, data-independent) are covered by Tasks 2-3; the "Signature Interaction" (wiring `weakestRegion` from real mastery data) is explicitly deferred to the next plan, per the spec's own suggested sequencing — `HeartHero`/`HeartIllustration` already accept a `highlightedRegion` prop ready for that wiring, so no rework is needed there.
- **Placeholder scan:** none — all path data, component code, and commands are concrete.
- **Type consistency:** `HeartRegion` (from Plan 1, already shipped) is used identically across `heart-region-paths.ts`, `heart-illustration.tsx`, `heart-hero.tsx`, and the preview route.
- **Known risk, called out explicitly at the top of this plan:** the SVG path data is a first draft. Whoever executes Task 2 should expect to iterate on it after actually seeing it rendered, not treat the coordinates given here as final.
