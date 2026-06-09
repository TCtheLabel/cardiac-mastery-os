# Cardiac Mastery OS — Plan B: Capture → Generate → Train → Evaluate

Status: Approved
Date: 2026-06-08
Builds on: `docs/superpowers/specs/2026-06-06-mvp-build-design.md`
Prerequisite: Plan A complete (all db services, schema, scaffold in place)

## Summary

Build the full deliberate-practice loop end-to-end: the user captures a reflection/case note → AI generates a training session → the user answers questions one at a time → AI evaluates each answer → mastery is updated. This plan delivers a working, usable product for the first time.

## 1. AI Service Layer

Two services in `src/services/ai/`. Both use `response_format: { type: "json_schema" }` — no free-text parsing. Both throw on API error; callers handle and return HTTP error responses.

### `src/services/ai/generateSession.ts`

- Input: a `TrainingSource` (content + sourceType)
- One OpenAI call (GPT-4o) with a system prompt instructing the model to read the content, extract a primary topic (session title), and generate a balanced set of questions across the five categories: `decision_making`, `operative_planning`, `complication_management`, `pattern_recognition`, `reflection`
- Question count is AI-decided based on content richness (typically 3–6)
- Returns: `{ topic: string, questions: Array<{ category: QuestionCategory, prompt: string }> }`
- JSON schema enforces: `topic` (string), `questions` (array of objects with `category` enum and `prompt` string)

### `src/services/ai/evaluateResponse.ts`

- Input: `{ responseText: string, question: Question, source: TrainingSource }`
- One OpenAI call with the question, source content, and user response for context
- Returns: `{ strengths: string, missedConcepts: string, improvements: string, principle: string, qualitySignal: QualitySignal }`
- JSON schema enforces `qualitySignal` as enum: `"strong" | "adequate" | "weak"`

## 2. API Routes

All routes validate required fields → return `400` for missing input, `500` with `{ error: message }` for service failures.

### `POST /api/generate-session`

- Body: `{ content: string, sourceType: SourceType }`
- Creates `training_source` row via `createSource()`
- Calls `generateSession()` service
- Persists `training_session` + `questions` via `createSessionWithQuestions()`
- Returns: `{ sessionId: string }`

### `POST /api/evaluate-response`

- Body: `{ questionId: string, responseText: string }`
- Creates `responses` row via `createResponse()`
- Fetches question + originating source for AI context
- Calls `evaluateResponse()` service
- Persists `evaluation` via `createEvaluation()`
- Calls `recordMasteryProgress()` to update mastery topic
- Returns: full `Evaluation` object

### `GET /api/sessions/[sessionId]`

- Fetches session + questions via `getSessionWithQuestions()`
- Returns: `{ session: TrainingSession, questions: Question[] }`
- Used by the `/training/[sessionId]` Client Component on mount

### `GET /api/mastery`

- Returns all mastery topics via `listMasteryTopics()` ordered by `confidence_score` ascending
- No body params
- Used by Home + Mastery pages in Plan C — built here because it's trivial and completes the backend

## 3. Screens

### `/capture` — `src/app/capture/page.tsx`

Client Component. Single-page form with local state.

**Layout:**
- Source-type pill buttons: Reflection / Case Note / Article Summary / Insight — one active at a time, Aortic Red when selected, muted border when inactive
- If `?topic=<topic>` in URL: small muted line above textarea "Focus: [topic]" — a nudge, not a constraint
- Large `Textarea` (shadcn) for content
- "Generate Training Session" button (full-width, primary/red)

**Validation:** Button disabled until source type selected AND textarea ≥ 20 characters.

**Submit flow:**
1. Button disabled + text → "Generating…"
2. `POST /api/generate-session`
3. Success → `router.push(/training/${sessionId})`
4. Error → re-enable button + inline error message

**shadcn components:** `Textarea`, `Card`

### `/training/[sessionId]` — `src/app/training/[sessionId]/page.tsx`

Client Component. Fetches session data on mount, manages question progression with local state.

**Layout:**
- Progress indicator: "Question N of M" (muted text, top)
- Glass-panel card: question category (Badge, muted) + question prompt (large text)
- Response `Textarea` below card
- "Submit Answer" button (primary/red)

**Submit flow:**
1. Button disabled + text → "Evaluating…"
2. `POST /api/evaluate-response` with `{ questionId, responseText }`
3. Evaluation slides in below textarea (read-only after submit):
   - Four labeled sections: Strengths / Missed Concepts / Improvements / Principle
   - Quality signal Badge: Strong (gold) / Adequate (blue) / Weak (red)
4. "Next Question →" button appears

**Session complete state:** After last question's evaluation, replace "Next Question" with a completion card showing session topic, question count, and a link back to `/capture`.

**Error:** Inline error + "Try again" button — re-enables submission without clearing textarea.

**Data fetching:** `GET /api/sessions/[sessionId]` on mount. Loading skeleton while fetching.

**shadcn components:** `Badge`, `Separator`

### `/training` — `src/app/training/page.tsx`

Server Component. Calls `listSessions()` directly (no API route needed).

**Layout:**
- List of past sessions: topic, formatted date, link to `/training/[sessionId]`
- Empty state if no sessions yet

## 4. shadcn Components to Add

Added per-screen as needed (not all upfront):

| Component | Added in |
|---|---|
| `Textarea` | Capture screen task |
| `Card`, `CardContent`, `CardHeader` | Capture screen task |
| `Badge` | Training session task |
| `Separator` | Training session task |

## 5. Testing

One Vitest integration test file per API route. OpenAI client is mocked (no real API calls in tests); Supabase hits the real Cloud database (consistent with Plan A approach). Each test seeds required db rows, exercises the full route handler, and cleans up in `afterEach`.

- `src/app/api/generate-session/__tests__/route.test.ts`
- `src/app/api/evaluate-response/__tests__/route.test.ts`
- `src/app/api/mastery/__tests__/route.test.ts`

`GET /api/sessions/[sessionId]` is a direct pass-through to `getSessionWithQuestions()` which is already tested in Plan A — no additional test needed.

## 6. File Checklist

```
src/
├── services/ai/
│   ├── generateSession.ts
│   └── evaluateResponse.ts
├── app/
│   ├── capture/
│   │   └── page.tsx
│   ├── training/
│   │   ├── page.tsx                        (history list)
│   │   └── [sessionId]/
│   │       └── page.tsx                    (question flow)
│   └── api/
│       ├── generate-session/
│       │   └── route.ts
│       ├── evaluate-response/
│       │   └── route.ts
│       ├── sessions/
│       │   └── [sessionId]/
│       │       └── route.ts
│       └── mastery/
│           └── route.ts
```

## 7. Open Decisions

| Decision | Resolution |
|---|---|
| Generate flow | Wait on capture page (loading state) → redirect on success |
| Question advancement | Explicit "Next Question" button — user controls pace |
| Response persistence | Created inside `/api/evaluate-response` (single round trip) |
| Source creation | Inside `/api/generate-session` (single round trip from capture form) |
| AI model | GPT-4o with JSON schema structured output |
| Training history | Server Component, direct db call, no pagination for MVP |
| `/api/mastery` | Built in Plan B even though UI comes in Plan C |
