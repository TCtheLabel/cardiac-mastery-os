# Handoff: NotebookLM Integration + Train from Notebook Page

**Where:** worktree `.worktrees/notebooklm-mcp-integration`, branch `notebooklm-mcp-integration`, off `main` at `3d94a6d`.
**Written:** 2026-06-28, ahead of a context compaction, mid-way through a second (smaller) feature on top of the completed first one.

## To resume

```bash
cd "/Users/thomas/Desktop/Next Level/Projects/Cardiac Mastery OS/.worktrees/notebooklm-mcp-integration"
git log --oneline 3d94a6d..HEAD   # should show 22 commits, top one is "Add design spec for in-app Train from Notebook page"
npm test                          # should show 41/41 passing
git status                        # should be clean
```

## Status: two pieces of work, in two different states

### 1. Original 14-task NotebookLM MCP integration plan — COMPLETE, not yet merged

Plan: `docs/superpowers/plans/2026-06-27-notebooklm-mcp-integration.md` (all 14 tasks checked off). Design spec: `docs/superpowers/specs/2026-06-27-notebooklm-mcp-integration-design.md`.

All 14 tasks done via `superpowers:subagent-driven-development` (implementer → spec review → code-quality review per task), plus a final full-implementation review that said **"Ready to merge."** We were at the `superpowers:finishing-a-development-branch` decision point (merge / PR / keep / discard) when Thomas asked to test it manually first — that decision is **still pending**, don't forget to come back to it.

**Real-world testing after the formal review found two real bugs, both fixed:**
- `normalizeAskQuestionResult` (in `scripts/notebookLmClient.ts`) was rewritten in commit `8ea3674` because the real `notebooklm-mcp` envelope shape (`{success, data: {answer, sources}, error?}`, always delivered via a text content block, never `structuredContent`) differs completely from Task 9's speculative design. The old code silently cached a real auth-failure response as if it were valid content. **If you ever touch this file again, read the "Critical finding" section of the `project-notebooklm-v15-integration` memory before assuming the shape — it was verified empirically, not from any doc.**
- `ask_question`'s timeout needed bumping twice: 60s (SDK default) → 180s (`8ea3674`) → 300s (`9f7b591`), because some domains' synthesis generation legitimately took longer than the client was willing to wait. Note: a later retry of the *same* domain that had timed out at 180s succeeded in under a minute — so timeouts are partly genuine slowness and partly normal browser-automation flakiness; retrying is always reasonable.
- Also discovered: running bare `npx notebooklm-mcp@latest` in a terminal does **not** trigger Google login by itself — nothing happens until an MCP client calls the `setup_auth` tool. Thomas's first "I've done the one-time auth" turned out not to have actually authenticated anything, for exactly this reason.

**All 7 domains are now registered AND fully synced** (real content, real citations, confirmed via direct DB query): `aortic_surgery` (30 citations), `valve_surgery` (46), `foundations` (52), `coronary_surgery` (51), `heart_failure_lvad_transplant` (5 — lower count is normal variance, not an error), `critical_care_ecmo_perfusion` (45), `cardiac_oncology` (35). Real library ids are committed in `scripts/notebook-domains.ts`.

**One thing Thomas needs to know if it comes up again:** he initially tried running `npm run sync-notebook` from the **main project directory**, not the worktree — got `npm error Missing script`. The feature only exists on this branch/worktree until merged. If he reports a missing-script error again, check which directory his terminal is in first.

### 2. New feature: "Train from Notebook" page — DESIGN APPROVED, plan not yet written

Spec just written and committed: `docs/superpowers/specs/2026-06-28-train-from-notebook-page-design.md` (commit `4ad20ec`).

**What it is:** an in-app page (`/train-notebook`, new nav link) where Thomas picks a synced domain (pills) and optionally types a free-text topic to focus on, then generates a training session — without touching a terminal. Reuses the existing `createSource`/`generateSession`/`createSessionWithQuestions` pipeline unchanged; the topic hint is woven in by prepending `Focus area: {topic}\n\n` to the source content, not by changing any existing function's signature.

**Explicitly stays CLI-only:** syncing fresh content from NotebookLM (`sync-notebook`) is NOT part of this — that boundary was a deliberate decision from the original spec (no public hosting of the browser-automation tool) and this new page doesn't touch it. The page only ever reads the `notebook_knowledge` cache that already exists in Supabase.

**New pieces per the spec** (none built yet):
- `listNotebookKnowledge()` in `src/services/db/notebookKnowledge.ts`
- `src/app/api/train-notebook/route.ts`
- `src/app/train-notebook/page.tsx`
- One new line in `src/components/nav.tsx`
- Tests for the new service function and API route (pages aren't unit-tested in this codebase — established convention)

**Next step on resume:** the user has approved the spec in conversation but the brainstorming flow's formal "review the written spec" gate hasn't been explicitly re-confirmed after compaction — a quick "does this spec still look right?" before invoking `superpowers:writing-plans` is a reasonable resume point. Then write the plan, then execute it (likely via `subagent-driven-development` again, same pattern as the first feature — small enough that it might not even need a worktree-within-worktree; use judgment, it could just be done directly in this same worktree/branch).

## Open items when you resume

1. Confirm the Train from Notebook spec still looks right with Thomas, then `superpowers:writing-plans` → implement.
2. Once that's done (or if Thomas wants to defer it), come back to the **original pending decision**: merge / PR / keep-as-is / discard for the whole branch (both features would ship together at that point, or decide if they should be separate commits/PRs — that's worth asking explicitly since it wasn't decided before this second feature started).
3. Don't re-litigate anything in the "Real-world testing" section above as if it were new — it's resolved, just there for context on why the code looks the way it does.
