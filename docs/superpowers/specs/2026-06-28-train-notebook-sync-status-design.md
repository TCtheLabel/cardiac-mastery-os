# Train from Notebook: Last-Synced Status — Design

## Context

The `/train-notebook` page (shipped earlier today, `docs/superpowers/specs/2026-06-28-train-from-notebook-page-design.md`) lets Thomas pick a synced domain and generate a training session from it. `notebook_knowledge.synced_at` has existed since the original NotebookLM sync feature but isn't surfaced anywhere in the app — Thomas has no way to tell, without checking the DB directly, how stale a given domain's cached content is before training from it.

## Goal

Show "last synced" per domain directly on the `/train-notebook` page, where Thomas is already picking a domain — no new page, no new API.

## Non-goals

- No new dependency for date formatting — `Intl.RelativeTimeFormat` (built into the JS runtime) covers it.
- No staleness warnings/thresholds (e.g., flagging domains synced >30 days ago) — not requested, pure display.
- No changes to `sync-notebook` itself, `listNotebookKnowledge()`, or any other page (`training`, `mastery`, `capture`) — `syncedAt` is already returned by `listNotebookKnowledge()`, just unused by the client until now.

## Architecture / data flow

No DB or API changes. `src/app/train-notebook/page.tsx` already calls `listNotebookKnowledge()`, which returns `NotebookKnowledge[]` (each with `domain` and `syncedAt` among other fields). Today it narrows that down to `domains: string[]` before handing off to the client form; this change keeps `syncedAt` alongside each domain instead of discarding it.

## Component changes

**`src/app/train-notebook/page.tsx`** — change the prop passed to `TrainNotebookForm`:

```tsx
return (
  <TrainNotebookForm
    domains={knowledge.map((row) => ({ domain: row.domain, syncedAt: row.syncedAt }))}
  />
);
```

**`src/app/train-notebook/train-notebook-form.tsx`**:

1. Update the props interface:

```ts
interface TrainNotebookFormProps {
  domains: { domain: string; syncedAt: string }[];
}
```

2. Add a relative-time formatter (module scope, alongside `DOMAIN_LABELS`):

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

`Intl.RelativeTimeFormat`'s `numeric: "auto"` gives idiomatic phrasing for small values (e.g. "yesterday", "today") and falls back to "N days ago"/"N months ago" otherwise — no extra casing logic needed.

3. Update the pill rendering to destructure `{ domain, syncedAt }`, switch corner radius from `rounded-full` to `rounded-xl` (a two-line label reads oddly in a fully-rounded pill), and render the sync caption as a second line that inherits the pill's current text color at reduced opacity (so it stays legible in both the selected and unselected states without a separate color rule):

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

Nothing else in the file changes — `DOMAIN_LABELS`, the topic textarea, submit handling, and error display are all untouched.

## Error handling

None needed beyond what already exists. `syncedAt` is always present on every row `listNotebookKnowledge()` returns (it's set on every `upsertNotebookKnowledge` call, including the very first sync) — no null/missing case to guard against.

## Testing

None planned — purely presentational, consistent with this codebase's established convention that pages/UI aren't unit-tested (confirmed across the Plan C dashboard work and the `/train-notebook` page itself). Verified manually instead: load `/train-notebook`, confirm each pill shows a plausible relative time, confirm selecting/submitting still works exactly as before.

## Files touched

- `src/app/train-notebook/page.tsx` — pass `syncedAt` through
- `src/app/train-notebook/train-notebook-form.tsx` — props type, new formatter, two-line pill markup
