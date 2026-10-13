-- M1 · 1.1 — Schemi, tabelle core, vincoli, indici, RLS default deny.
-- Lunghezze massime dei campi strutturati sono vincoli di schema (spec M1);
-- le soglie operative (es. lunghezza Piazza/Bar, rate limit) stanno in platform_config.

-- ---------------------------------------------------------------------------
-- Default deny sui privilegi: Supabase concede di default ad anon/authenticated
-- tutto su tabelle e funzioni di public. Da qui in poi ogni grant è esplicito.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
-- Nota: l'EXECUTE a PUBLIC sulle funzioni è un default globale di Postgres e non si revoca per schema:
-- ogni funzione fa `revoke execute ... from public` esplicito.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- ---------------------------------------------------------------------------
-- Profili e configurazione
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text check (handle ~ '^[A-Za-z0-9_]{3,20}$'),
  status text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  suspended_until timestamptz,
  rules_version_accepted text,
  consent_art9_at timestamptz,
  adult_declared_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index profiles_handle_lower_key on public.profiles (lower(handle));
create index profiles_status_idx on public.profiles (status);

create table public.platform_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create table public.config_changelog (
  id bigint generated always as identity primary key,
  key text not null references public.platform_config (key),
  old_value jsonb,
  new_value jsonb not null,
  reason text not null check (length(btrim(reason)) > 0),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index config_changelog_key_idx on public.config_changelog (key, changed_at);

-- ---------------------------------------------------------------------------
-- Temi, problemi, riformulazioni, fonti, schede
-- ---------------------------------------------------------------------------
create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  selection_criterion text not null,
  sort integer not null default 0,
  is_active boolean not null default true
);

create table public.problems (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id),
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 1000),
  affected text not null check (char_length(affected) <= 300),
  status text not null default 'pending' check (status in ('pending', 'active', 'merged', 'archived')),
  merged_into uuid references public.problems (id),
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  check ((status = 'merged') = (merged_into is not null))
);
create index problems_topic_created_idx on public.problems (topic_id, created_at);
create index problems_status_idx on public.problems (status);
create index problems_author_idx on public.problems (author_id);
create index problems_merged_into_idx on public.problems (merged_into);

create table public.problem_supports (
  problem_id uuid not null references public.problems (id) on delete cascade,
  voter_pseudo text not null,
  created_at timestamptz not null default now(),
  primary key (problem_id, voter_pseudo)
);
create index problem_supports_pseudo_idx on public.problem_supports (voter_pseudo);

create table public.problem_reformulations (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 1000),
  author_id uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);
create index problem_reformulations_problem_idx on public.problem_reformulations (problem_id, status);
create index problem_reformulations_author_idx on public.problem_reformulations (author_id);

-- value: +1 = preferisco la riformulazione, -1 = preferisco il testo attuale.
create table public.problem_reformulation_votes (
  reformulation_id uuid not null references public.problem_reformulations (id) on delete cascade,
  voter_pseudo text not null,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (reformulation_id, voter_pseudo)
);
create index problem_reformulation_votes_pseudo_idx on public.problem_reformulation_votes (voter_pseudo);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  url text not null check (url ~ '^https?://'),
  title text not null,
  publisher text,
  kind text not null check (kind in ('istituzionale', 'primaria', 'studio', 'stampa')),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index sources_added_by_idx on public.sources (added_by);

create table public.problem_facts (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  statement text not null check (char_length(statement) <= 400),
  source_id uuid not null references public.sources (id),
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  proposed_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index problem_facts_problem_idx on public.problem_facts (problem_id, status);
create index problem_facts_source_idx on public.problem_facts (source_id);
create index problem_facts_proposed_by_idx on public.problem_facts (proposed_by);
create index problem_facts_reviewed_by_idx on public.problem_facts (reviewed_by);

-- ---------------------------------------------------------------------------
-- Piazza e Bar (prima delle proposte: proposals.origin_message_id → piazza_messages)
-- ---------------------------------------------------------------------------
create table public.piazza_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id),
  problem_id uuid references public.problems (id),
  parent_id uuid references public.piazza_messages (id) on delete cascade,
  depth smallint not null default 0 check (depth between 0 and 1),
  body text not null check (length(btrim(body)) > 0),
  author_id uuid references public.profiles (id) on delete set null,
  status text not null default 'visible' check (status in ('visible', 'collapsed_pending', 'removed')),
  bridging_score numeric,
  created_at timestamptz not null default now(),
  check ((parent_id is null) = (depth = 0))
);
create index piazza_messages_topic_created_idx on public.piazza_messages (topic_id, created_at);
create index piazza_messages_problem_idx on public.piazza_messages (problem_id);
create index piazza_messages_parent_idx on public.piazza_messages (parent_id);
create index piazza_messages_status_idx on public.piazza_messages (status);
create index piazza_messages_author_idx on public.piazza_messages (author_id);

create table public.piazza_votes (
  message_id uuid not null references public.piazza_messages (id) on delete cascade,
  voter_pseudo text not null,
  value smallint not null check (value in (-1, 0, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (message_id, voter_pseudo)
);
create index piazza_votes_pseudo_idx on public.piazza_votes (voter_pseudo);

create table public.bar_messages (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics (id),
  parent_id uuid references public.bar_messages (id) on delete cascade,
  depth smallint not null default 0 check (depth between 0 and 1),
  body text not null check (length(btrim(body)) > 0),
  author_id uuid references public.profiles (id) on delete set null,
  status text not null default 'visible' check (status in ('visible', 'collapsed_pending', 'removed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check ((parent_id is null) = (depth = 0))
);
create index bar_messages_topic_created_idx on public.bar_messages (topic_id, created_at);
create index bar_messages_parent_idx on public.bar_messages (parent_id);
create index bar_messages_expires_idx on public.bar_messages (expires_at);
create index bar_messages_author_idx on public.bar_messages (author_id);

-- ---------------------------------------------------------------------------
-- Proposte, voti, argomenti, rating
-- ---------------------------------------------------------------------------
create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id),
  what text not null check (char_length(what) <= 300),
  how text not null check (char_length(how) <= 1200),
  cost_and_funding text not null check (char_length(cost_and_funding) <= 600),
  risks text not null check (char_length(risks) <= 600),
  foreign_example text check (char_length(foreign_example) <= 600),
  foreign_source_id uuid references public.sources (id),
  origin text not null default 'direct' check (origin in ('direct', 'piazza')),
  origin_message_id uuid references public.piazza_messages (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'archived')),
  created_at timestamptz not null default now(),
  check (origin = 'piazza' or origin_message_id is null)
);
create index proposals_problem_idx on public.proposals (problem_id, status);
create index proposals_status_idx on public.proposals (status);
create index proposals_author_idx on public.proposals (author_id);
create index proposals_foreign_source_idx on public.proposals (foreign_source_id);
create index proposals_origin_message_idx on public.proposals (origin_message_id);

create table public.proposal_votes (
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  voter_pseudo text not null,
  value smallint not null check (value in (-1, 0, 1)),
  voted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (proposal_id, voter_pseudo)
);
create index proposal_votes_pseudo_idx on public.proposal_votes (voter_pseudo);

create table public.arguments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  side text not null check (side in ('pro', 'contro')),
  body text not null check (char_length(body) <= 400 and length(btrim(body)) > 0),
  author_id uuid references public.profiles (id) on delete set null,
  status text not null default 'visible' check (status in ('visible', 'collapsed_pending', 'removed')),
  cross_utility numeric,
  created_at timestamptz not null default now()
);
create index arguments_proposal_idx on public.arguments (proposal_id, side);
create index arguments_status_idx on public.arguments (status);
create index arguments_author_idx on public.arguments (author_id);

create table public.argument_ratings (
  argument_id uuid not null references public.arguments (id) on delete cascade,
  rater_pseudo text not null,
  useful boolean not null,
  created_at timestamptz not null default now(),
  primary key (argument_id, rater_pseudo)
);
create index argument_ratings_pseudo_idx on public.argument_ratings (rater_pseudo);

-- ---------------------------------------------------------------------------
-- RLS ovunque, default deny
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platform_config enable row level security;
alter table public.config_changelog enable row level security;
alter table public.topics enable row level security;
alter table public.problems enable row level security;
alter table public.problem_supports enable row level security;
alter table public.problem_reformulations enable row level security;
alter table public.problem_reformulation_votes enable row level security;
alter table public.sources enable row level security;
alter table public.problem_facts enable row level security;
alter table public.piazza_messages enable row level security;
alter table public.piazza_votes enable row level security;
alter table public.bar_messages enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_votes enable row level security;
alter table public.arguments enable row level security;
alter table public.argument_ratings enable row level security;

-- Nessun privilegio implicito: si concede solo ciò che serve, colonna per colonna.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Lettura pubblica senza colonne di autore (author_id, added_by, proposed_by, reviewed_by).
grant select on public.platform_config to anon, authenticated;
grant select (id, key, old_value, new_value, reason, changed_at) on public.config_changelog to anon, authenticated;
grant select on public.topics to anon, authenticated;
grant select (id, topic_id, title, body, affected, status, merged_into, created_at, activated_at)
  on public.problems to anon, authenticated;
grant select (id, problem_id, title, body, status, created_at)
  on public.problem_reformulations to anon, authenticated;
grant select (id, url, title, publisher, kind, created_at) on public.sources to anon, authenticated;
grant select (id, problem_id, statement, source_id, status, created_at)
  on public.problem_facts to anon, authenticated;
grant select (id, problem_id, what, how, cost_and_funding, risks, foreign_example, foreign_source_id,
  origin, origin_message_id, status, created_at)
  on public.proposals to anon, authenticated;
grant select (id, proposal_id, side, body, status, cross_utility, created_at)
  on public.arguments to anon, authenticated;
-- Profilo: solo il proprio, solo da autenticato.
grant select on public.profiles to authenticated;

create policy platform_config_read on public.platform_config for select to anon, authenticated using (true);
create policy config_changelog_read on public.config_changelog for select to anon, authenticated using (true);
create policy topics_read on public.topics for select to anon, authenticated using (true);
create policy problems_read on public.problems for select to anon, authenticated using (true);
create policy problem_reformulations_read on public.problem_reformulations for select to anon, authenticated using (true);
create policy sources_read on public.sources for select to anon, authenticated using (true);
create policy problem_facts_read on public.problem_facts for select to anon, authenticated using (status <> 'rejected');
create policy proposals_read on public.proposals for select to anon, authenticated using (true);
create policy arguments_read on public.arguments for select to anon, authenticated using (status <> 'removed');
create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));

-- Tabelle di voto/sostegno/rating, piazza_messages, bar_messages: nessun grant e nessuna policy
-- per anon/authenticated. Lettura solo tramite viste aggregate o *_public; scrittura solo via RPC.
