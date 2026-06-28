# Train from Notebook Page — Design

## Context

The NotebookLM MCP integration (`docs/superpowers/specs/2026-06-27-notebooklm-mcp-integration-design.md`, plan: `docs/superpowers/plans/2026-06-27-notebooklm-mcp-integration.md`) is complete: `npm run sync-notebook -- <domain>` pulls a citation-backed synthesis from NotebookLM into the `notebook_knowledge` Supabase table, and `npm run train-from-notebook -- <domain>` turns the cached synthesis into a real training session via the existing `createSource` → `generateSession` → `createSessionWithQuestions` pipeline. Both are CLI-only, run from a terminal in the project's git worktree.

After using this for real (6 of 7 domains synced, multiple real sessions generated and verified), Thomas wants the second half — generating a session from already-synced content — available as an in-app page, since it has no dependency on NotebookLM/browser automation at all (it only reads the Supabase cache). The first half (syncing fresh content from NotebookLM) stays CLI-only; that boundary was decided deliberately in the original spec (hosting `notebooklm-mcp` somewhere the deployed app could reach would cost real infrastructure and expose Thomas's Google session to the public internet) and is unchanged by this design.

## Goals

1. A new page where Thomas can pick a synced domain and generate a training session from it, without touching a terminal.
2. Optionally narrow the session's focus with a free-text topic, without re-querying NotebookLM (the cache holds one broad synthesis per domain; a topic just biases which parts of it the AI writes questions about).
3. Reuse the existing generate/train/evaluate pipeline exactly as the CLI script and Capture page already do — no parallel logic.

## Non-goals

- No live NotebookLM/notebooklm-mcp calls from the deployed app. The page only ever reads `notebook_knowledge` rows that already exist; syncing new content remains `npm run sync-notebook` from a terminal.
- No changes to `generateSession`, `createSource`, `createSessionWithQuestions`, or any other already-tested service function's signature.
- No curated/structured list of "topics per domain" — topic is free text, exactly as decided during brainstorming.
- No filtering of weak-area topics into the picker — considered and explicitly deferred (today's `mastery_topics` aren't linked to a domain, so a "relevant weak areas for this domain" list would be approximate at best).

## Architecture

```
Server Component (page.tsx)
  └─ listNotebookKnowledge() ─→ which domains are actually synced
       └─ passed as props to a Client Component form

Client Component (form)
  └─ domain picker (pills, same pattern as Capture's source-type picker)
  └─ topic input (free text, optional)
  └─ Submit → POST /api/train-notebook { domain, topic? }
       └─ wait for response, then redirect to /training/<sessionId>
            (same "wait then redirect" pattern as Capture — not a background redirect)

POST /api/train-notebook
  └─ getNotebookKnowledge(domain) — 404-equivalent error if not synced
  └─ build content: topic ? `Focus area: ${topic}\n\n${knowledge.content}` : knowledge.content
  └─ createSource(content, "notebook_sync", { domain, citations: knowledge.citations })
  └─ generateSession(source)            ← unchanged, existing function
  └─ createSessionWithQuestions(...)    ← unchanged, existing function
  └─ return { sessionId }
```

The topic hint is woven in by prepending `Focus area: {topic}` to the source content rather than threading a new parameter through `generateSession`. This was a deliberate choice over modifying `generateSession`'s signature: it achieves the same effect (the AI reads the hint as context when writing questions) without touching already-reviewed, already-tested code, and the prepended line becomes a useful breadcrumb if Thomas looks back at the source/citations for that session later.

## New pieces

**`listNotebookKnowledge()`** — new function in `src/services/db/notebookKnowledge.ts`:

```ts
export async function listNotebookKnowledge(): Promise<NotebookKnowledge[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("notebook_knowledge").select().order("domain", { ascending: true });

  if (error) throw new Error(`Failed to list notebook knowledge: ${error.message}`);
  return (data as NotebookKnowledgeRow[]).map(toNotebookKnowledge);
}
```

**`src/app/api/train-notebook/route.ts`** (new) — `POST` handler, mirrors `/api/generate-session/route.ts`'s validation/error shape (400 for bad input, 500 for pipeline failures, `{ sessionId }` on success). Validates `domain` is present and non-empty; `topic` is optional and trimmed.

**`src/app/train-notebook/page.tsx`** (new) — Server Component:
- Calls `listNotebookKnowledge()`.
- If empty: render `<EmptyState title="No notebooks synced yet" message="Run npm run sync-notebook -- <domain> from your terminal to pull content from NotebookLM." ctaHref="/" ctaLabel="Back to Home" />` (matches the existing `EmptyState` component's exact props; reused as-is, no changes to that component).
- Otherwise: renders a Client Component, passing the list of synced domains (with a small local `DOMAIN_LABELS` map for human-readable pill text, e.g. `aortic_surgery` → "Aortic Surgery" — scoped to this page only, same pattern as `CATEGORY_LABELS` in the training session page).

**Client form component** (`"use client"`, can live in the same `page.tsx` file split into a child component, following the existing `Capture` page's single-file pattern):
- Pills for domain selection (one per synced `NotebookKnowledge.domain`, labeled via `DOMAIN_LABELS`, falling back to the raw slug if a domain isn't in the map yet).
- A `Textarea` or `Input` for the optional topic.
- Submit button, disabled until a domain is selected; shows a loading state while waiting (matching Capture's `submitting` state pattern), then `router.push('/training/${sessionId}')` on success.

**Nav** (`src/components/nav.tsx`) — add `{ href: "/train-notebook", label: "Train from Notebook" }` between `/capture` and `/training`.

## Error handling

- Domain not present in `notebook_knowledge` (e.g. stale client state) → `/api/train-notebook` returns 400 with a clear message; surfaced inline on the form, same as Capture's existing error display.
- Empty topic string is treated identically to no topic (content isn't prefixed).
- No new error paths in `generateSession`/`createSource`/`createSessionWithQuestions` — those are unchanged and already handle their own failure modes.

## Testing

- `listNotebookKnowledge()` gets a Vitest integration test in `src/services/db/__tests__/notebookKnowledge.test.ts`, following the existing scoped-cleanup pattern from that file (test-distinctive domain names, delete by domain after each test).
- `/api/train-notebook` gets a Vitest test in `src/app/api/train-notebook/__tests__/route.test.ts`: success path (with and without topic, asserting the `Focus area:` prefix appears in the created source's content only when a topic was given), 400 for missing domain, 400 for an unsynced domain.
- The page itself: no automated test, consistent with this codebase's established convention (pages aren't unit tested — confirmed across Plan C and the original NotebookLM integration plan). Manual verification: load the page with at least one synced domain, generate a session with and without a topic, confirm redirect and that the resulting session's citations panel renders.

## Files touched

- `src/services/db/notebookKnowledge.ts` — add `listNotebookKnowledge`
- `src/services/db/__tests__/notebookKnowledge.test.ts` — add tests for it
- `src/app/api/train-notebook/route.ts` — new
- `src/app/api/train-notebook/__tests__/route.test.ts` — new
- `src/app/train-notebook/page.tsx` — new
- `src/components/nav.tsx` — one new link
