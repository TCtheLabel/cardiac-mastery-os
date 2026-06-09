create table training_sources (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  source_type text not null check (source_type in ('reflection', 'case_note', 'article_summary', 'insight')),
  created_at timestamptz not null default now()
);

create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references training_sources(id) on delete cascade,
  topic text,
  created_at timestamptz not null default now()
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  category text not null check (category in (
    'decision_making', 'operative_planning', 'complication_management',
    'pattern_recognition', 'reflection'
  )),
  prompt text not null,
  order_index int not null default 0
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  response text not null,
  created_at timestamptz not null default now()
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references responses(id) on delete cascade,
  strengths text,
  missed_concepts text,
  improvements text,
  principle text,
  quality_signal text not null check (quality_signal in ('strong', 'adequate', 'weak')),
  created_at timestamptz not null default now()
);

create table mastery_topics (
  id uuid primary key default gen_random_uuid(),
  topic text not null unique,
  confidence_score numeric not null default 0,
  session_count int not null default 0,
  weak_areas text[] not null default '{}'
);
