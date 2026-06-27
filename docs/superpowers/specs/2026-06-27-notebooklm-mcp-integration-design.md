# V1.5: NotebookLM Integration via MCP — Design

## Context

`docs/V2/Cardiac_Mastery_OS_2.0_Training_Engine_Overview.md` and `docs/Roadmap.md` (V1.5 — "NotebookLM Integration") describe NotebookLM as the source-grounded knowledge layer beneath the deliberate-practice engine: notebook synchronization, source-grounded question generation, citation-aware training, reading-to-training pipelines, and topic-specific notebook connections.

NotebookLM has no public consumer API. The only programmatic options are the NotebookLM Enterprise API (Google Cloud, org licensing, not viable for a solo user) or community MCP servers (e.g. `notebooklm-mcp`) that drive the consumer product via real browser automation against an authenticated Google session. That automation is inherently fragile (breaks on NotebookLM UI changes) and outside Google's supported surface, so it must never sit on the critical path of an actual training session.

Decisions locked in during brainstorming:
- Integrate via an MCP server (`notebooklm-mcp`), not the Enterprise API or raw scraping.
- **Sync model**: pull notebook content into Cardiac Mastery OS's own Supabase tables; question generation reads the cache, never NotebookLM live.
- **Manual trigger only**: no scheduled/background sync.
- **Local CLI only**: sync runs as a script on Thomas's own machine, where the authenticated Google/Chrome session lives. The deployed Vercel app never calls NotebookLM or the MCP server — it only reads Supabase. No new production attack surface, no hosting cost for a persistent browser session.

The roadmap's "topic-specific notebook connections" is interpreted as **domain**-level, not the existing free-text `topic` field. Today `topic` (`mastery_topics.topic`, `training_sessions.topic`) is AI-generated per session from arbitrary content (e.g. "Post-op Tamponade Management") — there's no stable taxonomy to hang a notebook mapping off of. NotebookLM notebooks are organized by the 7 domains from the V2 doc (Foundations, Aortic Surgery, Valve Surgery, Coronary Surgery, Heart Failure/LVAD/Transplant, Critical Care/ECMO/Perfusion, Cardiac Oncology), which already exist and are populated. This design introduces `domain` as a new, separate, fixed-key concept used only for notebook mapping — it does not replace or constrain the existing per-session `topic`.

## Goals

1. Pull a citation-backed teaching synthesis from a domain's existing NotebookLM notebook into Cardiac Mastery OS, on demand.
2. Turn that synthesis into a training session using the existing generate → train → evaluate → mastery pipeline, unmodified in spirit.
3. Surface citations during training so answers can be traced back to source material ("citation-aware training").

## Non-goals

- No in-app "Sync" button, no scheduled/automatic sync (manual local CLI only, per decision above).
- No changes to evaluation logic, mastery scoring, or the training UI's question/response flow beyond rendering citations.
- No NotebookLM notebook *creation* or source upload — notebooks already exist and are populated; this only reads from them (`ask_question`).
- No podcast, oral boards, teach-back, or ChatGPT mastery-coach features from the V2 doc — those are separate, later roadmap items.
- No retry/backoff logic for MCP/browser-automation failures — this is a manual, occasional command; on failure it errors out and Thomas re-runs it.

## Architecture

```
Thomas's machine                                  Supabase (shared with prod)
─────────────────                                 ──────────────────────────
sync-notebook.ts  --(MCP stdio, ask_question)-->   notebook_knowledge (cache)
  spawns `npx notebooklm-mcp`                            |
  (real Chrome, authenticated                            | read
   Google session, one-time login)                       v
                                                   train-from-notebook.ts
                                                     --> createSource (existing)
                                                     --> generateSession (existing)
                                                     --> createSessionWithQuestions (existing)
                                                            |
                                                            v
                                                   training_sessions / questions
                                                   (read normally by deployed app)
```

The deployed Vercel app and its API routes are untouched by the sync mechanism — they only ever read rows that already exist in Supabase, same as today. The only new runtime dependency on NotebookLM/MCP lives in two local scripts Thomas runs manually.

## Data model changes

New migration, e.g. `supabase/migrations/20260627000000_notebooklm_integration.sql`:

```sql
create table notebook_knowledge (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique,
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

alter table training_sources
  add column domain text,
  add column citations jsonb not null default '[]'::jsonb;
```

`src/types/database.ts`:
- Extend `SourceType` with `"notebook_sync"`.
- Add `Citation { text: string; sourceTitle: string }`.
- Add `domain: string | null` and `citations: Citation[]` to `TrainingSource`.
- Add `NotebookKnowledge { id: string; domain: string; content: string; citations: Citation[]; syncedAt: string }`.

`/api/generate-session/route.ts`'s `VALID_SOURCE_TYPES` allow-list is **not** extended — `"notebook_sync"` sources are only ever created by the local script calling `createSource` directly, never through the user-facing Capture form/API.

## Components

**`scripts/notebook-domains.ts`** (new) — static config mapping domain keys to NotebookLM notebook IDs:

```ts
export const DOMAIN_NOTEBOOKS: Record<string, string> = {
  foundations: "<notebook-id>",
  aortic_surgery: "<notebook-id>",
  valve_surgery: "<notebook-id>",
  coronary_surgery: "<notebook-id>",
  heart_failure_lvad_transplant: "<notebook-id>",
  critical_care_ecmo_perfusion: "<notebook-id>",
  cardiac_oncology: "<notebook-id>",
};
```

Thomas fills in real notebook IDs at implementation time. Adding a domain later is a one-line edit, not a redesign.

**`src/services/db/notebookKnowledge.ts`** (new) — typed CRUD matching the existing `services/db/*.ts` pattern: `upsertNotebookKnowledge(domain, content, citations)`, `getNotebookKnowledge(domain)`.

**`scripts/sync-notebook.ts`** (new, run via `npm run sync-notebook -- <domain>`):
1. Look up notebook ID for `<domain>` in `DOMAIN_NOTEBOOKS`; error if missing.
2. Spawn `notebooklm-mcp` as an MCP server subprocess over stdio (`@modelcontextprotocol/sdk` `StdioClientTransport`, command `npx notebooklm-mcp@latest`).
3. Call its `ask_question` tool against the domain's notebook with a fixed synthesis prompt (below), requesting JSON-format citations.
4. Normalize whatever shape `ask_question` actually returns into `Citation[]` (`{ text, sourceTitle }`). The exact JSON citation schema `notebooklm-mcp` returns is unverified until implementation — this mapping step is expected to need a small adjustment once real output is seen.
5. Call `upsertNotebookKnowledge(domain, answer, citations)`.
6. Print a confirmation and exit. Close the MCP client/subprocess cleanly.

Synthesis prompt template:
> "Provide a comprehensive teaching synthesis on {domain} for a cardiac surgery resident studying for oral boards. Cover key concepts, areas of clinical controversy, and board-relevant nuances. Cite a specific source for each major claim."

**`scripts/train-from-notebook.ts`** (new, run via `npm run train-from-notebook -- <domain>`):
1. `getNotebookKnowledge(domain)`; error with a clear message ("run sync-notebook first") if no cached row exists.
2. `createSource(content, "notebook_sync", { domain, citations })` — `createSource` in `src/services/db/sources.ts` gains a third, optional `options?: { domain?: string; citations?: Citation[] }` parameter. Existing call sites (the 4 user-typed source types) omit it and are unaffected.
3. `generateSession(source)` — existing function, prompt tweak below.
4. `createSessionWithQuestions(source.id, generated.topic, generated.questions)` — existing, unchanged.
5. Print the resulting `/training/<sessionId>` URL.

Splitting sync from session-generation means one sync can back multiple training sessions without re-querying NotebookLM each time.

## Question generation change

`src/services/ai/generateSession.ts`'s `SYSTEM_PROMPT` currently opens with "Read the resident's submitted content (a reflection, case note, article summary, or insight)." Add a clause so `notebook_sync` content is framed correctly:

> "...or a source-grounded synthesis pulled from the resident's curated reference library (NotebookLM)."

No other change to question generation, category distribution, or output schema.

## Citation display ("citation-aware training")

- `/api/sessions/[sessionId]/route.ts`: alongside `session` and `questions`, also fetch the source (`getSourceById(session.sourceId)`) and include `citations` in the response when non-empty.
- `src/app/training/[sessionId]/page.tsx`: if `citations.length > 0`, render a collapsible "Sources" panel (title + list of `{ sourceTitle, text }`) below the session header. Sessions without citations (the existing reflection/case_note/article_summary/insight flow) render exactly as today — this is additive only.

## Files touched

- `supabase/migrations/20260627000000_notebooklm_integration.sql` — new
- `src/types/database.ts` — extend `SourceType`, `TrainingSource`; add `Citation`, `NotebookKnowledge`
- `src/services/db/sources.ts` — `createSource` gains optional `domain`/`citations` params
- `src/services/db/notebookKnowledge.ts` — new
- `src/services/ai/generateSession.ts` — system prompt clause addition
- `src/app/api/sessions/[sessionId]/route.ts` — include source citations in response
- `src/app/training/[sessionId]/page.tsx` — render citations panel when present
- `scripts/notebook-domains.ts` — new
- `scripts/sync-notebook.ts` — new
- `scripts/train-from-notebook.ts` — new
- `package.json` — `sync-notebook` and `train-from-notebook` script entries, `@modelcontextprotocol/sdk` dependency

## Error handling

- Missing domain in `DOMAIN_NOTEBOOKS`, missing cached `notebook_knowledge` row, or an MCP/`ask_question` failure all surface as a clear, immediate error message and a non-zero exit code. No retries, no fallback content — these are manual commands Thomas re-runs himself.
- `setup_auth` (one-time Google login via `notebooklm-mcp`) is a documented manual prerequisite, not something the scripts automate.

## Testing & verification

- Unit test `createSource`'s new optional params against the existing test file pattern in `src/services/db/__tests__/`.
- Unit test the `generateSession` system-prompt addition the way existing AI service tests are mocked (`src/services/ai/__tests__/`) — assert `notebook_sync` sources don't break the existing schema/category contract.
- Manual end-to-end verification (per the Supabase-outage caveat already tracked in project memory): run `sync-notebook` against one real domain notebook, then `train-from-notebook`, confirm a real session is generated, complete it through to evaluation, and confirm citations render on the training page.
- No automated test for the MCP/browser-automation step itself — it's a thin, manual, local-only integration; the existing Vitest suite targets services and API routes, not external browser automation.
