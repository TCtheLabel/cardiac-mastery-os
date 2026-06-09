# Cardiac Mastery OS — MVP Build Design

Status: Approved
Date: 2026-06-06
Source docs: `docs/ProductVision.md`, `docs/Architecture.md`, `docs/Agent.md`, `docs/Plan.md`, `docs/Roadmap.md`

## Summary

Build the V1.0 MVP of Cardiac Mastery OS exactly as scoped in `Agent.md`/`Plan.md`: a single-user,
deliberate-practice loop — Capture → AI-generated training session → Answer → AI evaluation →
Mastery tracking — with a calm, premium, dark-themed interface. This spec elaborates the parts the
existing docs leave open: concrete schema, AI architecture, screen-level UX, and visual system.

## 1. Project Setup & Structure

- Scaffold with `create-next-app` (TypeScript, Tailwind, App Router, `src/` dir), npm as package manager.
- `shadcn/ui` configured for **dark mode only** — no light theme, no theme toggle.
- **Local Supabase via CLI** (`supabase init` / `supabase start`, Docker-based) for development.
- `.env.local` (gitignored) holds `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` /
  `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.
- No git initialization for now (handled separately by the user later).

Folder structure (elaborates Architecture.md):

```
src/
├── app/                    # routes: /, /capture, /training, /training/[sessionId], /mastery
│   └── api/                # generate-session, evaluate-response, mastery
├── components/             # shared UI (shadcn primitives + composed components)
├── features/
│   ├── capture/            # capture form, source-type selector
│   ├── training/           # session view, question flow, response input
│   ├── evaluation/         # evaluation display components
│   └── mastery/            # topic cards, confidence visualizations
├── lib/                    # supabase client, utils
├── services/
│   ├── ai/                 # generateSession.ts, evaluateResponse.ts (OpenAI calls)
│   └── db/                 # data-access functions per entity, including mastery.ts update logic
└── types/                  # shared TS types/interfaces
```

**Deviation from Architecture.md:** `/api/generate-question` is dropped as a standalone route.
Since question count/category mix is decided by the AI as part of session generation (see §3),
a separate per-question generation endpoint would mean redundant AI calls. Question generation is
folded into `/api/generate-session`.

## 2. Database Schema

Supabase Postgres, managed via SQL migration files in `supabase/migrations/`.

```sql
training_sources
  id            uuid pk default gen_random_uuid()
  content       text not null
  source_type   text not null  -- 'reflection' | 'case_note' | 'article_summary' | 'insight'
  created_at    timestamptz default now()

training_sessions
  id            uuid pk
  source_id     uuid references training_sources
  topic         text           -- AI-extracted primary topic/title for the session
  created_at    timestamptz default now()

questions
  id            uuid pk
  session_id    uuid references training_sessions
  category      text not null  -- e.g. 'decision_making', 'operative_planning', 'complication_management',
                                --      'pattern_recognition', 'reflection' (AI-assigned, prompt-constrained)
  prompt        text not null
  order_index   int            -- sequencing within session

responses
  id            uuid pk
  question_id   uuid references questions
  response      text not null
  created_at    timestamptz default now()

evaluations
  id              uuid pk
  response_id     uuid references responses
  strengths       text
  missed_concepts text
  improvements    text
  principle       text
  quality_signal  text         -- AI-derived: 'strong' | 'adequate' | 'weak' — drives mastery scoring
  created_at      timestamptz default now()

mastery_topics
  id                uuid pk
  topic             text unique not null
  confidence_score  numeric default 0   -- running blended score, 0-100
  session_count     int default 0
  weak_areas        text[]              -- aggregated/deduped from missed_concepts, capped (e.g. 5)
```

**Mastery update logic** (`services/db/mastery.ts`, invoked after each evaluation):
1. Blend the new evaluation's `quality_signal` ('strong'/'adequate'/'weak' → numeric weight) into the
   matching topic's `confidence_score` via a weighted average that favors recent results over history.
2. Increment `session_count`.
3. Fold the evaluation's `missed_concepts` into `weak_areas` (dedupe, cap at ~5 entries, drop stalest
   when over cap).

## 3. AI Service Layer & API Routes

All OpenAI calls (GPT-4o/4.1) use **structured JSON-schema responses**
(`response_format: { type: "json_schema", ... }`) — no manual free-text parsing.

**`services/ai/generateSession.ts`**
- Input: a `training_source` (content + sourceType).
- One structured call returning `{ topic: string, questions: [{ category, prompt }] }`.
- The model decides question count and category mix based on content richness, guided by a prompt
  listing the core categories (decision making, operative planning, complication management, pattern
  recognition, reflection) and asking for balanced difficulty.
- API route persists `training_session` + `questions` rows, returns the session with questions.

**`services/ai/evaluateResponse.ts`**
- Input: a `response`, its `question`, and the originating `training_source` for context.
- One structured call returning `{ strengths, missedConcepts, improvements, principle, qualitySignal }`.
- API route persists the `evaluation` row, then calls `services/db/mastery.ts` to update the
  matching `mastery_topics` row.

**API routes** (thin: validate → call service → persist → respond):
- `POST /api/generate-session` — `{ sourceId }` → session + questions
- `POST /api/evaluate-response` — `{ responseId }` → evaluation (and triggers mastery update)
- `GET /api/mastery` — all `mastery_topics`, sorted by `confidence_score` ascending

## 4. Screens & UX Flow

**`/` — Home**
- Daily recommendation card: lowest-confidence `mastery_topic`, with a "Capture something on
  [topic]" action that links to `/capture?topic=<topic>`. The capture screen reads that query
  param and displays a small contextual hint above the text area (e.g., "Focus: Aortic Dissection
  Management") — generation still requires a fresh source, so this nudges what the user writes
  about rather than auto-generating from old sources.
- Topic mastery cards: compact glanceable confidence overview.
- Recent activity: last few captures/sessions.

**`/capture`**
- Source-type selector (pill buttons: Reflection / Case Note / Article Summary / Insight).
- Large freeform text area.
- Single primary action: "Generate Training Session" → `/api/generate-session` →
  redirect to `/training/[sessionId]`.

**`/training/[sessionId]`**
- One question at a time (one primary action per screen).
- Response input → submit → `/api/evaluate-response` → inline evaluation display
  (strengths / missed concepts / improvements / principle) before advancing.
- Progress indicator ("Question 2 of 4"), session-complete state at the end.

**`/training`**
- Lightweight history list of past sessions (topic, date, completion status).

**`/mastery`**
- Full topic list: confidence scores, weak areas, session counts (detail view Home's cards summarize).

**Empty / loading / error states** (designed in from the start, polished in Phase 8):
- Empty Home before any captures exist.
- Calm progress indicators during AI calls (which can take several seconds).
- Error states with retry for failed AI calls.

## 5. Visual Design System

**Palette** (dark mode only; mapped to Tailwind/shadcn CSS variables):
- Background: Surgical Black / Deep Charcoal gradient base.
- Surfaces: frosted glass panels — semi-transparent charcoal + backdrop-blur over the dark base.
- Primary accent: **Aortic Red** — used sparingly: the single primary action per screen, key
  data points (active progress, critical confidence indicators).
- Secondary: **Steel Blue** — secondary actions, links, informational elements.
- Highlight: **Warm Gold** — mastery milestones, positive evaluation signals.

**Components:** shadcn/ui base, restyled with generous rounded corners, soft gradients,
glass/frosted surfaces (backdrop-blur + subtle borders), generous whitespace.

**Typography:** Geist (Next.js default) — premium, calm, restrained weight contrast. No extra
font setup needed.

**Motion:** subtle, slow transitions — calm and immersive, explicitly avoiding snappy/gamified
animation (which would read as Quizlet/LMS, contrary to the brief).

**Layout principles on every screen:** large whitespace, one clear focal action, minimal chrome
(quiet top-level navigation, no dense nav bars/sidebars).

## 6. Build Order

Mirrors `Plan.md` phase-for-phase; this becomes the basis for the implementation plan.

1. **Foundation** — Next.js + Tailwind + shadcn/ui scaffold, dark theme tokens, local Supabase
   via CLI, env wiring, base layout/navigation shell.
2. **Core Data Layer** — migrations for all 6 tables, `services/db/` data-access functions,
   Supabase client setup.
3. **Capture Experience** — `/capture` screen: source-type selector, text input, generate action.
4. **AI Training Engine** — `generateSession` service, `/api/generate-session`,
   `/training/[sessionId]` question flow UI.
5. **Evaluation Engine** — `evaluateResponse` service, `/api/evaluate-response`, evaluation
   display UI, mastery-update logic.
6. **Home Dashboard** — recommendation card, mastery cards, recent activity.
7. **Mastery Tracking** — `/mastery` view, `/api/mastery`, confidence/weak-area visualizations.
8. **Polish** — empty states, loading states, error handling/retry, visual refinement pass.

## Open Decisions Resolved During Brainstorming

| Decision | Resolution |
|---|---|
| Visual companion | Declined — text-only design discussion |
| Build scope | Follow Plan.md/Agent.md as-is, full V1.0 MVP |
| Supabase setup | Local via CLI (Docker-based) |
| Theme | Dark mode only |
| AI model | GPT-4o / GPT-4.1 |
| Question count/categories | AI-decided per session (not fixed) |
| Mastery scoring | AI-derived quality signal, blended into running confidence score |
| Capture source type | User selects via pill buttons before writing |
| Home recommendation | Lowest-confidence topic |
| Git / package manager | Skip git init for now; npm |
