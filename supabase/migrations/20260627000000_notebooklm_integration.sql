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

alter table training_sources drop constraint if exists training_sources_source_type_check;
alter table training_sources add constraint training_sources_source_type_check
  check (source_type in ('reflection', 'case_note', 'article_summary', 'insight', 'notebook_sync'));
