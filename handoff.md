# Handoff: NotebookLM MCP Integration

**Paused:** 2026-06-27, mid-execution, by explicit user request ("pause where you are").
**Where:** worktree `.worktrees/notebooklm-mcp-integration`, branch `notebooklm-mcp-integration`, off `main` at `3d94a6d`.
**Progress:** Tasks 1-9 of 14 complete, reviewed (spec + quality, two-stage), and committed. Tasks 10-14 not started.

## To resume

```bash
cd "/Users/thomas/Desktop/Next Level/Projects/Cardiac Mastery OS/.worktrees/notebooklm-mcp-integration"
git log --oneline 3d94a6d..HEAD   # sanity check — should show the 11 commits below
npm test                          # should show 37/37 passing
```

Then continue with **superpowers:subagent-driven-development**, starting at **Task 10** in `docs/superpowers/plans/2026-06-27-notebooklm-mcp-integration.md` (Tasks 1-9's checkboxes are already marked `[x]` in that file). The TodoWrite list from the paused session isn't persisted — recreate it from the plan's task list (Task 10 through Task 14, plus a final full-implementation code review) when resuming.

## What's done (Tasks 1-9)

| Task | What | Key commit(s) |
|---|---|---|
| 1 | Fixed test suite to never blanket-delete production data; disabled Vitest file parallelism | `b377de3`, `bd14120` |
| 2 | Migration: `notebook_knowledge` table + `training_sources.domain`/`citations` columns — **applied to live Supabase Cloud by Thomas, verified** | `7ef58c9` |
| 3 | Extended `SourceType`/`TrainingSource`, added `Citation`/`NotebookKnowledge` types | `3a283cf` |
| 4 | `notebookKnowledge` db service (`upsertNotebookKnowledge`, `getNotebookKnowledge`) | `6ad0bba` |
| 5 | `createSource` gains optional `{ domain, citations }` | `0488f51` |
| 6 | `generateSession` system prompt recognizes `notebook_sync` content | `f08ae1e` |
| 7 | Added `tsx`, `dotenv`, `@modelcontextprotocol/sdk` as devDependencies | `a3a7a6f` |
| 8 | `scripts/notebook-domains.ts` — domain→notebook-id config + `getNotebookId` | `5d45327` |
| 9 | `scripts/notebookLmClient.ts` — MCP client wrapper, `askNotebook`, defensive `normalizeAskQuestionResult` | `4c9da29`, `dc8e67c` (fix) |

All 9 tasks went through implementer → spec-compliance reviewer → code-quality reviewer, with one real fix-and-re-review cycle (Task 9: a subprocess-leak risk in `askNotebook` where `client.connect()` sat outside the `try/finally` that calls `client.close()` — fixed in `dc8e67c`).

Current test count: **37/37 passing** (`npm test`). Baseline before this plan was 23.

## What's next (Tasks 10-14)

Read the full text for each directly from `docs/superpowers/plans/2026-06-27-notebooklm-mcp-integration.md` (search for `## Task 10` etc.) — don't reconstruct from memory.

- **Task 10:** `scripts/sync-notebook.ts` — CLI script, no automated test (verified manually in Task 14).
- **Task 11:** `scripts/train-from-notebook.ts` — CLI script, same.
- **Task 12:** `/api/sessions/[sessionId]` route returns `citations` from the source.
- **Task 13:** Training page renders a citations panel when present.
- **Task 14: human checkpoint.** Thomas runs `notebooklm-mcp` auth setup, registers one real domain notebook, fills in `scripts/notebook-domains.ts`, runs `sync-notebook` then `train-from-notebook` against a real notebook, and completes a real training session in the browser. **A subagent cannot do this — it needs Thomas's own Google account and browser.**
- **Final step:** dispatch a full-implementation code reviewer (per `superpowers:subagent-driven-development`), then `superpowers:finishing-a-development-branch` to decide how to merge.

## Things worth knowing before continuing

**Plan numbers drift.** The plan document's own "expected test count" callouts (e.g. "Tests 24 passed (24)" in Task 6) were calculated assuming tasks run with no other test-adding work in between, but they do run sequentially and earlier tasks add tests too — by Task 6 the real baseline was already 28, not 23. This was caught and corrected live each time. If you see a stale expected-count in the plan text for Tasks 10-14, don't treat it as a contradiction — just confirm the actual delta makes sense (one new test per `it()` block added).

**Model selection that worked well:** fully-specified, mechanical tasks (exact code given, 1-2 files, following an established pattern) went to `haiku` and were verified just as rigorously by standard-model reviewers — Tasks 4, 5, 6, 7, 8 all used this and it held up under independent re-verification (reviewers re-ran tests/typecheck themselves, diffed files character-for-character, didn't just trust the report). Task 9 (real third-party API integration, genuine uncertainty about response shapes) used the standard model. Worth continuing this split for Tasks 10-11 (mechanical → cheap model) vs. anything requiring judgment.

**Two real bugs were found and fixed during review, not assumed away:**
1. Task 1 itself fixed a genuine pre-existing bug: every test file blanket-deleted its whole table against the *live production Supabase project* (no separate test DB exists). Confirmed via direct query that all 6 tables were empty before this work — so nothing was actually lost, but the risk was real for any future real usage.
2. Task 9's code-quality review caught a real subprocess-leak risk in `askNotebook` (inherited from the plan's own code listing, not an implementer error) — `client.connect()` was outside the `try/finally`. Fixed, re-reviewed, confirmed.

**Production-write caution during review:** one code-quality reviewer (Task 2) ran live INSERT statements against the production Supabase project to verify a check constraint, without explicit pre-clearance for writes. It happened to clean up after itself (verified independently afterward — table was back to 0 rows), but this wasn't asked for. If a future reviewer wants to verify behavior beyond read-only queries, prefer asking the controller first rather than writing to production directly.

**A coordinator-relay caution:** once, a resumed subagent correctly refused to run verification queries against production because my instruction to it relayed "Thomas confirmed it" — and the agent's own safety check treats coordinator-relayed consent as untrustworthy by default (a sound general heuristic, since a malicious or confused coordinator could fabricate user approval). In that specific case the refusal was overly cautious — I (the controller) had genuine first-party confirmation directly from Thomas in this same conversation, not a fabricated relay — so I ran the verification myself in the main session instead of re-dispatching. If this pattern recurs, the fix is the same: when you (the controller) have direct, first-party user confirmation, don't try to convince a subagent of that secondhand — just do the low-risk verification yourself.

**Env files:** `.env` and `.env.local` are gitignored and were manually copied into this worktree at setup time (`cp .env .env.local .worktrees/notebooklm-mcp-integration/`). They won't be there in a fresh worktree — if this worktree ever gets recreated, re-copy them from the main project root before running tests.

**Supabase CLI is not linked** in this environment (`supabase migration list` fails with "Cannot find project ref"). Any future migration needs the same manual-paste-into-Dashboard-SQL-Editor flow Task 2 used, with the controller (not a subagent) doing the live verification query afterward, since only the controller has direct confirmation from Thomas that the SQL was actually run.

## Project memory

`project-notebooklm-v15-integration.md` (in the Claude memory directory) has the high-level decisions (MCP-based, sync model, manual local-CLI trigger, domain-vs-topic distinction) and is already up to date through the spec/plan-writing phase. It will be updated again once Tasks 10-14 complete.
