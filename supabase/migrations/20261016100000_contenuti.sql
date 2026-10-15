-- M4 · contenuti core: problemi, riformulazioni, schede, proposte, argomenti, ricerca, conteggi con soglia,
-- temi seguiti (D3) e mazzo del giorno (D4).
-- Scritture di testi: solo dal server (service role) con l'utente della sessione verificata, dopo il filtro
-- (guardContent): un client non può saltare il filtro chiamando l'RPC (come complete_onboarding in M3).

-- ---------------------------------------------------------------------------
-- 1. Config
-- ---------------------------------------------------------------------------
insert into public.platform_config (key, value, description) values
  ('daily_deck_size', '10', 'Proposte nel mazzo del giorno di ogni utente (almeno min_votes_participant)');

-- Limiti giornalieri anche per riformulazioni e schede: modifica registrata nel changelog con motivazione.
do $$
declare
  v_old jsonb;
  v_new jsonb;
begin
  select c.value into v_old from public.platform_config c where c.key = 'rate_limits';
  v_new := v_old || '{"reformulations": 3, "facts": 5}'::jsonb;
  perform pg_catalog.set_config('arengo.config_via_rpc', 'on', true);
  update public.platform_config c set value = v_new, updated_at = now() where c.key = 'rate_limits';
  perform pg_catalog.set_config('arengo.config_via_rpc', 'off', true);
  insert into public.config_changelog (key, old_value, new_value, reason, changed_by)
  values ('rate_limits', v_old, v_new, 'M4: limiti giornalieri per riformulazioni e schede', null);
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Controlli per le scritture dal server (uid esplicito al posto di auth.uid())
-- ---------------------------------------------------------------------------
create or replace function private.assert_user_can_vote(uid uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if assert_user_can_vote.uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles p where p.id = assert_user_can_vote.uid;
  if not found then
    raise exception 'onboarding_incomplete';
  end if;
  if v_profile.deleted_at is not null then
    raise exception 'account_deleted';
  end if;
  if v_profile.adult_declared_at is null
     or v_profile.rules_version_accepted is null
     or v_profile.consent_art9_at is null then
    raise exception 'onboarding_incomplete';
  end if;
  if v_profile.status = 'banned'
     or (v_profile.status = 'suspended'
         and (v_profile.suspended_until is null or v_profile.suspended_until > now())) then
    raise exception 'account_not_active';
  end if;
  return assert_user_can_vote.uid;
end;
$$;
revoke execute on function private.assert_user_can_vote(uuid) from public, anon, authenticated;

create or replace function private.assert_can_write_user(uid uuid, content_type text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if assert_can_write_user.content_type is null or assert_can_write_user.content_type not in (
       'problem', 'reformulation', 'fact', 'proposal', 'argument', 'piazza', 'bar', 'handle', 'report') then
    raise exception 'invalid_value';
  end if;
  perform private.assert_user_can_vote(assert_can_write_user.uid);
  if private.writing_paused_until(assert_can_write_user.uid) is not null then
    raise exception 'writing_paused';
  end if;
  return assert_can_write_user.uid;
end;
$$;
revoke execute on function private.assert_can_write_user(uuid, text) from public, anon, authenticated;

-- Limite giornaliero (giorno Europe/Rome) da platform_config.rate_limits.<kind>.
-- Lock per utente e tipo fino a fine transazione: richieste parallele non superano il limite.
create or replace function private.assert_daily_limit(uid uuid, kind text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
  v_from timestamptz := (date_trunc('day', now() at time zone 'Europe/Rome')) at time zone 'Europe/Rome';
begin
  select (c.value ->> assert_daily_limit.kind)::integer into v_limit
  from public.platform_config c where c.key = 'rate_limits';
  if v_limit is null then
    raise exception 'config_missing';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('arengo_daily:' || assert_daily_limit.uid::text || ':' || assert_daily_limit.kind));
  case assert_daily_limit.kind
    when 'problems' then
      select count(*) into v_count from public.problems t
      where t.author_id = assert_daily_limit.uid and t.created_at >= v_from;
    when 'reformulations' then
      select count(*) into v_count from public.problem_reformulations t
      where t.author_id = assert_daily_limit.uid and t.created_at >= v_from;
    when 'facts' then
      select count(*) into v_count from public.problem_facts t
      where t.proposed_by = assert_daily_limit.uid and t.created_at >= v_from;
    when 'proposals' then
      select count(*) into v_count from public.proposals t
      where t.author_id = assert_daily_limit.uid and t.created_at >= v_from;
    when 'arguments' then
      select count(*) into v_count from public.arguments t
      where t.author_id = assert_daily_limit.uid and t.created_at >= v_from;
    else
      raise exception 'invalid_value';
  end case;
  if v_count >= v_limit then
    raise exception 'daily_limit_reached';
  end if;
end;
$$;
revoke execute on function private.assert_daily_limit(uuid, text) from public, anon, authenticated;

create or replace function private.nonblank(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select nonblank.t is not null and length(btrim(nonblank.t)) > 0 $$;
revoke execute on function private.nonblank(text) from public, anon, authenticated;

-- Fonte valida: url http(s), titolo, tipo tra quelli ammessi.
create or replace function private.assert_source(url text, title text, kind text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not private.nonblank(assert_source.url) or not private.nonblank(assert_source.title) or assert_source.kind is null then
    raise exception 'source_required';
  end if;
  if btrim(assert_source.url) !~ '^https?://[^\s]+$'
     or assert_source.kind not in ('istituzionale', 'primaria', 'studio', 'stampa') then
    raise exception 'invalid_source';
  end if;
end;
$$;
revoke execute on function private.assert_source(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Scritture di contenuti (solo service role)
-- ---------------------------------------------------------------------------
create or replace function public.create_problem(user_id uuid, topic_id uuid, title text, body text, affected text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_can_write_user(create_problem.user_id, 'problem');
  if not (private.nonblank(create_problem.title) and private.nonblank(create_problem.body)
          and private.nonblank(create_problem.affected)) then
    raise exception 'invalid_value';
  end if;
  perform 1 from public.topics t where t.id = create_problem.topic_id and t.is_active;
  if not found then
    raise exception 'unknown_topic';
  end if;
  perform private.assert_daily_limit(create_problem.user_id, 'problems');
  insert into public.problems (topic_id, title, body, affected, author_id)
  values (create_problem.topic_id, btrim(create_problem.title), btrim(create_problem.body),
          btrim(create_problem.affected), create_problem.user_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_problem(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_problem(uuid, uuid, text, text, text) to service_role;

create or replace function public.propose_reformulation(user_id uuid, problem_id uuid, title text, body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_can_write_user(propose_reformulation.user_id, 'reformulation');
  if not (private.nonblank(propose_reformulation.title) and private.nonblank(propose_reformulation.body)) then
    raise exception 'invalid_value';
  end if;
  perform 1 from public.problems p
  where p.id = propose_reformulation.problem_id and p.status in ('pending', 'active');
  if not found then
    raise exception 'item_not_votable';
  end if;
  perform private.assert_daily_limit(propose_reformulation.user_id, 'reformulations');
  insert into public.problem_reformulations (problem_id, title, body, author_id)
  values (propose_reformulation.problem_id, btrim(propose_reformulation.title), btrim(propose_reformulation.body),
          propose_reformulation.user_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.propose_reformulation(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.propose_reformulation(uuid, uuid, text, text) to service_role;

-- Scheda: fatto + fonte obbligatoria. Resta `proposed` finché i curatori (M8) non la approvano.
create or replace function public.propose_fact(
  user_id uuid, problem_id uuid, statement text,
  source_url text, source_title text, source_publisher text, source_kind text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_source uuid;
  v_id uuid;
begin
  perform private.assert_can_write_user(propose_fact.user_id, 'fact');
  if not private.nonblank(propose_fact.statement) then
    raise exception 'invalid_value';
  end if;
  perform private.assert_source(propose_fact.source_url, propose_fact.source_title, propose_fact.source_kind);
  perform 1 from public.problems p where p.id = propose_fact.problem_id and p.status in ('pending', 'active');
  if not found then
    raise exception 'item_not_votable';
  end if;
  perform private.assert_daily_limit(propose_fact.user_id, 'facts');
  insert into public.sources (url, title, publisher, kind, added_by)
  values (btrim(propose_fact.source_url), btrim(propose_fact.source_title), nullif(btrim(propose_fact.source_publisher), ''),
          propose_fact.source_kind, propose_fact.user_id)
  returning id into v_source;
  insert into public.problem_facts (problem_id, statement, source_id, proposed_by)
  values (propose_fact.problem_id, btrim(propose_fact.statement), v_source, propose_fact.user_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.propose_fact(uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.propose_fact(uuid, uuid, text, text, text, text, text) to service_role;

-- Proposta: solo su problemi attivi; tutti i campi obbligatori tranne l'esempio estero (che, se c'è, vuole la fonte).
create or replace function public.create_proposal(
  user_id uuid, problem_id uuid, what text, how text, cost_and_funding text, risks text,
  foreign_example text, foreign_source_url text, foreign_source_title text, foreign_source_kind text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_source uuid;
  v_id uuid;
  v_has_example boolean := private.nonblank(create_proposal.foreign_example);
begin
  perform private.assert_can_write_user(create_proposal.user_id, 'proposal');
  if not (private.nonblank(create_proposal.what) and private.nonblank(create_proposal.how)
          and private.nonblank(create_proposal.cost_and_funding) and private.nonblank(create_proposal.risks)) then
    raise exception 'invalid_value';
  end if;
  perform 1 from public.problems p where p.id = create_proposal.problem_id and p.status = 'active';
  if not found then
    raise exception 'problem_not_active';
  end if;
  if v_has_example then
    perform private.assert_source(create_proposal.foreign_source_url, create_proposal.foreign_source_title,
                                  create_proposal.foreign_source_kind);
  end if;
  perform private.assert_daily_limit(create_proposal.user_id, 'proposals');
  if v_has_example then
    insert into public.sources (url, title, kind, added_by)
    values (btrim(create_proposal.foreign_source_url), btrim(create_proposal.foreign_source_title),
            create_proposal.foreign_source_kind, create_proposal.user_id)
    returning id into v_source;
  end if;
  insert into public.proposals (problem_id, what, how, cost_and_funding, risks, foreign_example, foreign_source_id, author_id)
  values (create_proposal.problem_id, btrim(create_proposal.what), btrim(create_proposal.how),
          btrim(create_proposal.cost_and_funding), btrim(create_proposal.risks),
          case when v_has_example then btrim(create_proposal.foreign_example) end, v_source, create_proposal.user_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_proposal(uuid, uuid, text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_proposal(uuid, uuid, text, text, text, text, text, text, text, text) to service_role;

create or replace function public.create_argument(user_id uuid, proposal_id uuid, side text, body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_can_write_user(create_argument.user_id, 'argument');
  if create_argument.side is null or create_argument.side not in ('pro', 'contro')
     or not private.nonblank(create_argument.body) then
    raise exception 'invalid_value';
  end if;
  perform 1 from public.proposals pr where pr.id = create_argument.proposal_id and pr.status = 'open';
  if not found then
    raise exception 'item_not_votable';
  end if;
  perform private.assert_daily_limit(create_argument.user_id, 'arguments');
  insert into public.arguments (proposal_id, side, body, author_id)
  values (create_argument.proposal_id, create_argument.side, btrim(create_argument.body), create_argument.user_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_argument(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_argument(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Sostegni: attivazione del problema a problem_support_threshold
-- ---------------------------------------------------------------------------
create or replace function public.support_problem(problem_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pseudo text;
  v_threshold integer;
  v_count integer;
begin
  v_pseudo := private.pseudo(private.assert_can_vote());
  perform 1 from public.problems p
  where p.id = support_problem.problem_id and p.status in ('pending', 'active')
  for update;
  if not found then
    raise exception 'item_not_votable';
  end if;
  insert into public.problem_supports (problem_id, voter_pseudo)
  values (support_problem.problem_id, v_pseudo)
  on conflict on constraint problem_supports_pkey do nothing;

  select (c.value #>> '{}')::integer into v_threshold
  from public.platform_config c where c.key = 'problem_support_threshold';
  if v_threshold is null then
    raise exception 'config_missing';
  end if;
  select count(*) into v_count from public.problem_supports s where s.problem_id = support_problem.problem_id;
  if v_count >= v_threshold then
    update public.problems p set status = 'active', activated_at = now()
    where p.id = support_problem.problem_id and p.status = 'pending';
  end if;
end;
$$;
revoke execute on function public.support_problem(uuid) from public, anon, authenticated;
grant execute on function public.support_problem(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Riformulazioni: storico pubblico (senza autore) e accettazione sopra soglia
-- ---------------------------------------------------------------------------
create table public.problem_revisions (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  reformulation_id uuid references public.problem_reformulations (id) on delete set null,
  title text not null,
  body text not null,
  replaced_at timestamptz not null default now()
);
create index problem_revisions_problem_idx on public.problem_revisions (problem_id, replaced_at);
create index problem_revisions_reformulation_idx on public.problem_revisions (reformulation_id);
alter table public.problem_revisions enable row level security;
grant select on public.problem_revisions to anon, authenticated;
-- Le versioni precedenti seguono il problema: se è rimosso, spariscono anche loro.
create policy problem_revisions_read on public.problem_revisions for select to anon, authenticated
  using (exists (select 1 from public.problems p where p.id = problem_id and p.status <> 'removed'));

-- Fonti: leggibili solo se collegate a una scheda approvata o a una proposta non rimossa
-- (prima erano tutte pubbliche, anche quelle di schede in attesa dei curatori).
drop policy sources_read on public.sources;
create policy sources_read on public.sources for select to anon, authenticated using (
  exists (select 1 from public.problem_facts f where f.source_id = sources.id and f.status = 'approved')
  or exists (select 1 from public.proposals pr where pr.foreign_source_id = sources.id and pr.status <> 'removed'));

-- Accetta se la riformulazione ha almeno reformulation_min_votes voti e più "preferisco la riformulazione"
-- che "preferisco il testo attuale". Le altre aperte dello stesso problema si chiudono: erano votate sul testo vecchio.
create or replace function private.maybe_accept_reformulation(reformulation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_min integer;
  v_new integer;
  v_old integer;
  v_ref public.problem_reformulations%rowtype;
  v_problem public.problems%rowtype;
begin
  select (c.value #>> '{}')::integer into v_min from public.platform_config c where c.key = 'reformulation_min_votes';
  if v_min is null then
    raise exception 'config_missing';
  end if;
  select count(*) filter (where v.value = 1), count(*) filter (where v.value = -1) into v_new, v_old
  from public.problem_reformulation_votes v where v.reformulation_id = maybe_accept_reformulation.reformulation_id;
  if v_new + v_old < v_min or v_new <= v_old then
    return;
  end if;

  select * into v_ref from public.problem_reformulations r
  where r.id = maybe_accept_reformulation.reformulation_id and r.status = 'open' for update;
  if not found then
    return;
  end if;
  select * into v_problem from public.problems p where p.id = v_ref.problem_id for update;
  insert into public.problem_revisions (problem_id, reformulation_id, title, body)
  values (v_problem.id, v_ref.id, v_problem.title, v_problem.body);
  update public.problems p set title = v_ref.title, body = v_ref.body where p.id = v_problem.id;
  update public.problem_reformulations r set status = 'accepted' where r.id = v_ref.id;
  update public.problem_reformulations r set status = 'rejected'
  where r.problem_id = v_problem.id and r.status = 'open';
end;
$$;
revoke execute on function private.maybe_accept_reformulation(uuid) from public, anon, authenticated;

-- cast_vote: come in 20261013100300, più l'accettazione della riformulazione dopo ogni voto.
create or replace function public.cast_vote(item_type text, item_id uuid, value integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_pseudo text;
begin
  if cast_vote.value is null then
    raise exception 'invalid_value';
  end if;
  v_pseudo := private.pseudo(private.assert_can_vote());

  case cast_vote.item_type
    when 'proposal' then
      if cast_vote.value not in (-1, 0, 1) then
        raise exception 'invalid_value';
      end if;
      perform 1 from public.proposals pr where pr.id = cast_vote.item_id and pr.status = 'open';
      if not found then
        raise exception 'item_not_votable';
      end if;
      insert into public.proposal_votes (proposal_id, voter_pseudo, value)
      values (cast_vote.item_id, v_pseudo, cast_vote.value)
      on conflict on constraint proposal_votes_pkey
      do update set value = excluded.value, updated_at = now();

    when 'piazza' then
      if cast_vote.value not in (-1, 0, 1) then
        raise exception 'invalid_value';
      end if;
      perform 1 from public.piazza_messages m where m.id = cast_vote.item_id and m.status <> 'removed';
      if not found then
        raise exception 'item_not_votable';
      end if;
      insert into public.piazza_votes (message_id, voter_pseudo, value)
      values (cast_vote.item_id, v_pseudo, cast_vote.value)
      on conflict on constraint piazza_votes_pkey
      do update set value = excluded.value, updated_at = now();

    when 'reformulation' then
      if cast_vote.value not in (-1, 1) then
        raise exception 'invalid_value';
      end if;
      perform 1 from public.problem_reformulations r
      join public.problems p on p.id = r.problem_id and p.status in ('pending', 'active')
      where r.id = cast_vote.item_id and r.status = 'open';
      if not found then
        raise exception 'item_not_votable';
      end if;
      insert into public.problem_reformulation_votes (reformulation_id, voter_pseudo, value)
      values (cast_vote.item_id, v_pseudo, cast_vote.value)
      on conflict on constraint problem_reformulation_votes_pkey
      do update set value = excluded.value, updated_at = now();
      perform private.maybe_accept_reformulation(cast_vote.item_id);

    else
      raise exception 'invalid_item_type';
  end case;
end;
$$;
revoke execute on function public.cast_vote(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.cast_vote(text, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Conteggi con soglia minima (4.6): definer perché aggregano tabelle di voto illeggibili;
-- sotto min_votes_item i conteggi sono null e below_threshold = true. Mai voter_pseudo.
-- ---------------------------------------------------------------------------
create view public.problem_support_tallies with (security_invoker = false, security_barrier = true) as
with t as (
  select s.problem_id, count(*)::integer as supports
  from public.problem_supports s
  join public.problems p on p.id = s.problem_id and p.status <> 'removed'
  group by s.problem_id
), th as (
  select coalesce(t.supports < (select (c.value #>> '{}')::integer from public.platform_config c where c.key = 'min_votes_item'), true)
    as below, t.*
  from t
)
select th.problem_id,
  case when not th.below then th.supports end as supports,
  th.below as below_threshold
from th;

create view public.reformulation_tallies with (security_invoker = false, security_barrier = true) as
with t as (
  select v.reformulation_id,
    count(*) filter (where v.value = 1)::integer as prefer_new,
    count(*) filter (where v.value = -1)::integer as prefer_current,
    count(*)::integer as total
  from public.problem_reformulation_votes v
  join public.problem_reformulations r on r.id = v.reformulation_id and r.status <> 'removed'
  group by v.reformulation_id
), th as (
  select coalesce(t.total < (select (c.value #>> '{}')::integer from public.platform_config c where c.key = 'min_votes_item'), true)
    as below, t.*
  from t
)
select th.reformulation_id,
  case when not th.below then th.prefer_new end as prefer_new,
  case when not th.below then th.prefer_current end as prefer_current,
  case when not th.below then th.total end as total,
  th.below as below_threshold
from th;

revoke all on public.problem_support_tallies, public.reformulation_tallies from anon, authenticated;
grant select on public.problem_support_tallies, public.reformulation_tallies to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Ricerca full-text (italiano) su problemi, schede approvate, proposte
-- ---------------------------------------------------------------------------
alter table public.problems add column fts tsvector generated always as (
  to_tsvector('italian', title || ' ' || body || ' ' || affected)) stored;
alter table public.problem_facts add column fts tsvector generated always as (
  to_tsvector('italian', statement)) stored;
alter table public.proposals add column fts tsvector generated always as (
  to_tsvector('italian', what || ' ' || how || ' ' || cost_and_funding || ' ' || risks || ' ' || coalesce(foreign_example, '')))
  stored;
create index problems_fts_idx on public.problems using gin (fts);
create index problem_facts_fts_idx on public.problem_facts using gin (fts);
create index proposals_fts_idx on public.proposals using gin (fts);

-- Definer: legge le colonne fts senza concederle; restituisce solo campi già pubblici.
-- Solo service role (nessuna funzione è eseguibile da anon): la pagina /cerca la chiama lato server.
create or replace function public.search_content(q text)
returns table (kind text, id uuid, problem_id uuid, title text, rank real)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q tsquery;
begin
  if search_content.q is null or length(btrim(search_content.q)) = 0 or length(search_content.q) > 200 then
    return;
  end if;
  v_q := websearch_to_tsquery('italian', search_content.q);
  return query
  select r.kind, r.id, r.problem_id, r.title, r.rank from (
    select 'problem'::text as kind, p.id, p.id as problem_id, p.title, ts_rank(p.fts, v_q) as rank
    from public.problems p where p.fts @@ v_q and p.status <> 'removed'
    union all
    select 'fact', f.id, f.problem_id, f.statement, ts_rank(f.fts, v_q)
    from public.problem_facts f
    join public.problems fp on fp.id = f.problem_id and fp.status <> 'removed'
    where f.fts @@ v_q and f.status = 'approved'
    union all
    select 'proposal', pr.id, pr.problem_id, pr.what, ts_rank(pr.fts, v_q)
    from public.proposals pr
    join public.problems pp on pp.id = pr.problem_id and pp.status <> 'removed'
    where pr.fts @@ v_q and pr.status <> 'removed'
  ) r
  order by r.rank desc, r.id
  limit 50;
end;
$$;
revoke execute on function public.search_content(text) from public, anon, authenticated;
grant execute on function public.search_content(text) to service_role;

-- ---------------------------------------------------------------------------
-- 8. Temi seguiti (D3): visibili solo al proprietario; in export e cancellazione account.
-- ---------------------------------------------------------------------------
create table public.topic_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  topic_id uuid not null references public.topics (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, topic_id)
);
create index topic_follows_topic_idx on public.topic_follows (topic_id);
alter table public.topic_follows enable row level security;
-- Lettura diretta solo dei propri; scrittura solo via follow_topic (onboarding e stato verificati).
grant select on public.topic_follows to authenticated;
create policy topic_follows_own_read on public.topic_follows for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.follow_topic(topic_id uuid, follow boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_can_vote();
begin
  if follow_topic.follow is null then
    raise exception 'invalid_value';
  end if;
  if follow_topic.follow then
    perform 1 from public.topics t where t.id = follow_topic.topic_id and t.is_active;
    if not found then
      raise exception 'unknown_topic';
    end if;
    insert into public.topic_follows (user_id, topic_id) values (v_uid, follow_topic.topic_id)
    on conflict on constraint topic_follows_pkey do nothing;
  else
    delete from public.topic_follows f where f.user_id = v_uid and f.topic_id = follow_topic.topic_id;
  end if;
end;
$$;
revoke execute on function public.follow_topic(uuid, boolean) from public, anon, authenticated;
grant execute on function public.follow_topic(uuid, boolean) to authenticated;

create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_pseudo text;
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles p where p.id = v_uid;
  if not found then
    raise exception 'onboarding_incomplete';
  end if;
  if v_profile.deleted_at is not null then
    raise exception 'account_deleted';
  end if;
  v_pseudo := private.pseudo(v_uid);

  return jsonb_build_object(
    'exported_at', now(),
    -- Strike del filtro attivi: solo il numero (la tabella contiene solo utente e ora, mai testo).
    'filter_strikes_24h', (select count(*) from private.filter_strikes s where s.user_id = v_uid),
    'profile', jsonb_build_object(
      'handle', v_profile.handle, 'status', v_profile.status, 'suspended_until', v_profile.suspended_until,
      'rules_version_accepted', v_profile.rules_version_accepted, 'consent_art9_at', v_profile.consent_art9_at,
      'adult_declared_at', v_profile.adult_declared_at, 'created_at', v_profile.created_at),
    'topic_follows', coalesce((select jsonb_agg(jsonb_build_object('topic', tp.slug, 'since', f.created_at)
        order by f.created_at)
      from public.topic_follows f join public.topics tp on tp.id = f.topic_id where f.user_id = v_uid), '[]'),
    'problems', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'body', t.body,
        'affected', t.affected, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.problems t where t.author_id = v_uid), '[]'),
    'reformulations', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'problem_id', t.problem_id,
        'title', t.title, 'body', t.body, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.problem_reformulations t where t.author_id = v_uid), '[]'),
    'facts', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'problem_id', t.problem_id,
        'statement', t.statement, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.problem_facts t where t.proposed_by = v_uid), '[]'),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'url', t.url, 'title', t.title,
        'kind', t.kind, 'created_at', t.created_at) order by t.created_at)
      from public.sources t where t.added_by = v_uid), '[]'),
    'proposals', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'problem_id', t.problem_id,
        'what', t.what, 'how', t.how, 'cost_and_funding', t.cost_and_funding, 'risks', t.risks,
        'foreign_example', t.foreign_example, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.proposals t where t.author_id = v_uid), '[]'),
    'arguments', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'proposal_id', t.proposal_id,
        'side', t.side, 'body', t.body, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.arguments t where t.author_id = v_uid), '[]'),
    'piazza_messages', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'topic_id', t.topic_id,
        'parent_id', t.parent_id, 'body', t.body, 'status', t.status, 'created_at', t.created_at) order by t.created_at)
      from public.piazza_messages t where t.author_id = v_uid), '[]'),
    'bar_messages', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'topic_id', t.topic_id,
        'parent_id', t.parent_id, 'body', t.body, 'created_at', t.created_at) order by t.created_at)
      from public.bar_messages t where t.author_id = v_uid), '[]'),
    'votes', jsonb_build_object(
      'problem_supports', coalesce((select jsonb_agg(jsonb_build_object('problem_id', v.problem_id,
          'created_at', v.created_at)) from public.problem_supports v where v.voter_pseudo = v_pseudo), '[]'),
      'reformulation_votes', coalesce((select jsonb_agg(jsonb_build_object('reformulation_id', v.reformulation_id,
          'value', v.value, 'updated_at', v.updated_at)) from public.problem_reformulation_votes v
        where v.voter_pseudo = v_pseudo), '[]'),
      'proposal_votes', coalesce((select jsonb_agg(jsonb_build_object('proposal_id', v.proposal_id,
          'value', v.value, 'updated_at', v.updated_at)) from public.proposal_votes v
        where v.voter_pseudo = v_pseudo), '[]'),
      'piazza_votes', coalesce((select jsonb_agg(jsonb_build_object('message_id', v.message_id,
          'value', v.value, 'updated_at', v.updated_at)) from public.piazza_votes v
        where v.voter_pseudo = v_pseudo), '[]'),
      'argument_ratings', coalesce((select jsonb_agg(jsonb_build_object('argument_id', v.argument_id,
          'useful', v.useful, 'created_at', v.created_at)) from public.argument_ratings v
        where v.rater_pseudo = v_pseudo), '[]'))
  );
end;
$$;
revoke execute on function public.export_my_data() from public, anon, authenticated;
grant execute on function public.export_my_data() to authenticated;

-- delete_account: come in 20261015100000, più i temi seguiti.
create or replace function public.delete_account(user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := delete_account.user_id;
  v_pseudo text;
  v_mode text;
begin
  if v_uid is null then
    raise exception 'invalid_value';
  end if;
  select pc.value #>> '{}' into v_mode from public.platform_config pc where pc.key = 'account_deletion_mode';
  if v_mode is null or v_mode not in ('anonymize', 'delete') then
    raise exception 'config_invalid';
  end if;
  v_pseudo := private.pseudo(v_uid);

  delete from public.problem_supports v where v.voter_pseudo = v_pseudo;
  delete from public.problem_reformulation_votes v where v.voter_pseudo = v_pseudo;
  delete from public.proposal_votes v where v.voter_pseudo = v_pseudo;
  delete from public.piazza_votes v where v.voter_pseudo = v_pseudo;
  delete from public.argument_ratings v where v.rater_pseudo = v_pseudo;
  delete from private.filter_strikes s where s.user_id = v_uid;
  delete from public.topic_follows f where f.user_id = v_uid;

  delete from public.bar_messages b
  where b.author_id = v_uid
    and not exists (select 1 from public.bar_messages r where r.parent_id = b.id and r.author_id is distinct from v_uid);
  update public.bar_messages b set body = 'Messaggio eliminato.', author_id = null, status = 'removed'
  where b.author_id = v_uid;

  if v_mode = 'delete' then
    update public.piazza_messages t set body = 'Messaggio eliminato.', status = 'removed' where t.author_id = v_uid;
    update public.arguments t set body = 'Argomento eliminato.', status = 'removed' where t.author_id = v_uid;
  end if;

  update public.problems t set author_id = null where t.author_id = v_uid;
  update public.problem_reformulations t set author_id = null where t.author_id = v_uid;
  update public.problem_facts t set proposed_by = null where t.proposed_by = v_uid;
  update public.problem_facts t set reviewed_by = null where t.reviewed_by = v_uid;
  update public.sources t set added_by = null where t.added_by = v_uid;
  update public.proposals t set author_id = null where t.author_id = v_uid;
  update public.arguments t set author_id = null where t.author_id = v_uid;
  update public.piazza_messages t set author_id = null where t.author_id = v_uid;

  update public.profiles p set handle = null, deleted_at = now() where p.id = v_uid;
end;
$$;
revoke execute on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.delete_account(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 9. Mazzo del giorno (D4): proposte aperte su problemi attivi dei temi seguiti (tutti se nessuno),
-- non ancora votate, in ordine casuale stabile per utente e giorno.
-- Restituisce solo campi pubblici e nessun conteggio.
-- ---------------------------------------------------------------------------
create or replace function public.daily_deck()
returns table (proposal_id uuid, problem_id uuid, problem_title text, topic_slug text, topic_title text, what text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.assert_can_vote();
  v_pseudo text := private.pseudo(v_uid);
  v_size integer;
  v_day text := (now() at time zone 'Europe/Rome')::date::text;
  v_follows boolean;
begin
  select (c.value #>> '{}')::integer into v_size from public.platform_config c where c.key = 'daily_deck_size';
  if v_size is null then
    raise exception 'config_missing';
  end if;
  select exists (select 1 from public.topic_follows f where f.user_id = v_uid) into v_follows;

  return query
  select pr.id, p.id, p.title, tp.slug, tp.title, pr.what
  from public.proposals pr
  join public.problems p on p.id = pr.problem_id and p.status = 'active'
  join public.topics tp on tp.id = p.topic_id and tp.is_active
  where pr.status = 'open'
    and (not v_follows or exists (select 1 from public.topic_follows f where f.user_id = v_uid and f.topic_id = tp.id))
    and not exists (select 1 from public.proposal_votes v where v.proposal_id = pr.id and v.voter_pseudo = v_pseudo)
  -- Solo ordine casuale stabile: dare priorità a quelle sotto soglia renderebbe osservabile chi ha pochi voti.
  order by md5(v_pseudo || v_day || pr.id::text)
  limit v_size;
end;
$$;
revoke execute on function public.daily_deck() from public, anon, authenticated;
grant execute on function public.daily_deck() to authenticated;
