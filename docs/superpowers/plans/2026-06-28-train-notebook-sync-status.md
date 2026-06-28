# Train from Notebook: Last-Synced Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show "last synced" (relative time) under each domain pill on `/train-notebook`, so Thomas can see at a glance how stale each domain's cached content is before training from it.

**Architecture:** Pure presentational change. `listNotebookKnowledge()` already returns `syncedAt` per domain — thread it through `page.tsx` to `train-notebook-form.tsx`, format it with the browser's built-in `Intl.RelativeTimeFormat`, and render it as a second line inside each pill.

**Tech Stack:** Next.js 16 (Server + Client Components), `Intl.RelativeTimeFormat` (no new dependency).

**Reference spec:** `docs/superpowers/specs/2026-06-28-train-notebook-sync-status-design.md`

**Process note:** Building directly on `main`, no worktree — same as the parent feature this extends.

---

### Task 1: Surface last-synced status on domain pills

**Files:**
- Modify: `src/app/train-notebook/page.tsx`
- Modify: `src/app/train-notebook/train-notebook-form.tsx`

No automated tests for this task — purely presentational, consistent with this codebase's established convention (pages/UI aren't unit-tested; see the original `/train-notebook` page and the Plan C dashboard work for precedent). Verification is typecheck + manual browser check.

- [ ] **Step 1: Thread `syncedAt` through `page.tsx`**

In `src/app/train-notebook/page.tsx`, change the final line from:

```tsx
return <TrainNotebookForm domains={knowledge.map((row) => row.domain)} />;
```

to:

```tsx
return (
  <TrainNotebookForm
    domains={knowledge.map((row) => ({ domain: row.domain, syncedAt: row.syncedAt }))}
  />
);
```

Nothing else in this file changes.

- [ ] **Step 2: Update the props type in `train-notebook-form.tsx`**

Change:

```ts
interface TrainNotebookFormProps {
  domains: string[];
}
```

to:

```ts
interface TrainNotebookFormProps {
  domains: { domain: string; syncedAt: string }[];
}
```

- [ ] **Step 3: Add the relative-time formatter**

In `src/app/train-notebook/train-notebook-form.tsx`, add this function after the existing `DOMAIN_LABELS` constant (before the `TrainNotebookFormProps` interface):

```ts
function formatRelativeSync(syncedAt: string): string {
  const diffMs = Date.now() - new Date(syncedAt).getTime();
  const diffMinutes = Math.round(diffMs / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) return `Synced ${rtf.format(-diffMinutes, "minute")}`;
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return `Synced ${rtf.format(-diffHours, "hour")}`;
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return `Synced ${rtf.format(-diffDays, "day")}`;
  const diffMonths = Math.round(diffDays / 30);
  return `Synced ${rtf.format(-diffMonths, "month")}`;
}
```

- [ ] **Step 4: Update the pill markup**

In `src/app/train-notebook/train-notebook-form.tsx`, replace the existing pill block:

```tsx
        <div className="flex flex-wrap gap-2">
          {domains.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDomain(value)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                domain === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {DOMAIN_LABELS[value] ?? value}
            </button>
          ))}
        </div>
```

with:

```tsx
        <div className="flex flex-wrap gap-2">
          {domains.map(({ domain: value, syncedAt }) => (
            <button
              key={value}
              type="button"
              onClick={() => setDomain(value)}
              className={`rounded-xl border px-4 py-1.5 text-sm transition-colors ${
                domain === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="block">{DOMAIN_LABELS[value] ?? value}</span>
              <span className="block text-xs opacity-70">{formatRelativeSync(syncedAt)}</span>
            </button>
          ))}
        </div>
```

Nothing else in the file changes — `DOMAIN_LABELS`, the topic `Textarea`, submit handling, and error display stay exactly as they are.

- [ ] **Step 5: Run typecheck and the full test suite**

Run: `npx tsc --noEmit`
Expected: clean, no output

Run: `npm test`
Expected: same 46/46 passing as before (this task adds no tests and shouldn't break any existing ones)

- [ ] **Step 6: Commit and push**

```bash
git add src/app/train-notebook/page.tsx src/app/train-notebook/train-notebook-form.tsx
git commit -m "Show last-synced status on Train from Notebook domain pills"
git push
```

- [ ] **Step 7: Manual verification**

```bash
npm run dev
```

Then in a browser, go to `http://localhost:3000/train-notebook` and confirm:
1. Each of the 7 domain pills now shows two lines: the domain label, and a smaller "Synced X ago" line underneath (real data — these are Thomas's actually-synced domains).
2. The relative time looks plausible for each domain (compare against what you know about when each was last synced).
3. Pills are no longer fully-rounded ellipses — corners are visibly less round (`rounded-xl`) but it still reads clearly as a button.
4. Selecting a pill still highlights it (red background) and enables the submit button, exactly as before — clicking it does not need to be followed through to actual generation (that pipeline is unchanged and already covered by existing tests).

If anything looks off, stop and report back rather than considering this done.

---

## Self-review notes

- **Spec coverage:** all 3 spec sections (data flow, component changes, the `rounded-xl` adjustment) map directly to Steps 1, 2-4. Testing section ("none planned, manual verification") matches Steps 5 and 7.
- **Placeholder scan:** none found — every step has complete, copy-pasteable code.
- **Type consistency:** `TrainNotebookFormProps.domains` shape (`{ domain: string; syncedAt: string }[]`) matches exactly between Step 1's `page.tsx` mapping and Step 2's interface and Step 4's destructuring (`{ domain: value, syncedAt }`).
